#!/usr/bin/env python3
"""
Generic end-to-end test harness for IWSDK (WebXR) apps in the IWSDK emulator (IWER).
Copy to <project>/tools/e2e.py and write main() for your app's journey.

Contract with the app (dev builds only):
  console.info('[<TAG>] <event> ...')         state transitions, scores, results
  console.info('[<TAG>] layout {json}')       world-space coordinates of everything the test must touch
  Shift+R                                      clears saved progress and reloads (fresh first-time user)

Prerequisite: the dev server is running (`npm run dev` or `npx iwsdk dev up --headless`).
Proven on Hands of a Master: 6 lessons, 15 strokes, negative cases, left hand, ~6 minutes.
"""
import json
import math
import os
import random
import re
import subprocess
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLI = [os.path.join(ROOT, 'node_modules', '.bin', 'iwsdk')]
ENV = dict(os.environ, ONNXRUNTIME_NODE_INSTALL_CUDA='skip')
TAG = '[app] '  # change to your app's log prefix, e.g. '[hoam] '


def cli(*args, payload=None, check=True):
    """Run one IWSDK CLI command and return its JSON envelope. Errors may come on stderr."""
    cmd = CLI + list(args)
    if payload is not None:
        cmd += ['--input-json', json.dumps(payload)]
    proc = subprocess.run(cmd, cwd=ROOT, env=ENV, capture_output=True, text=True)
    out = proc.stdout or proc.stderr
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        data = {'ok': False, 'raw': out[:400]}
    if check and not data.get('ok'):
        print('  ! command failed:', ' '.join(args), str(data)[:300])
    return data


def logs(count=150):
    """[(timestamp_ms, message)]. The CLI caps count at 200 and returns a sliding window."""
    data = cli('browser', 'logs', payload={'count': min(count, 200)}, check=False)
    result = (data.get('data') or {}).get('result') or []
    return [(int(l.get('timestamp', 0)), str(l.get('message', ''))) for l in result if isinstance(l, dict)]


def mark():
    """A time mark; wait_for only accepts lines logged after it."""
    return int(time.time() * 1000) - 50


def wait_for(pattern, since_ms, timeout=30.0):
    rx = re.compile(pattern)
    end = time.time() + timeout
    while time.time() < end:
        for ts, msg in logs():
            if ts > since_ms and msg.startswith(TAG):
                m = rx.search(msg[len(TAG):])
                if m:
                    return m
        time.sleep(0.4)
    raise TimeoutError(f'timed out waiting for /{pattern}/')


def shot(name):
    cli('browser', 'screenshot', '--output-file', f'artifacts/e2e-{name}.png', check=False)


def reset_and_enter(hand_pose='point', writer='hand-right'):
    """Fresh first-time user, immersive session, hands only. Returns the time mark of entry."""
    cli('xr', 'exit', check=False)
    cli('browser', 'reload')
    cli('runtime', 'wait')
    cli('browser', 'interact', payload={'steps': [
        {'action': 'keyDown', 'key': 'Shift'}, {'action': 'press', 'key': 'R'}, {'action': 'keyUp', 'key': 'Shift'}]}, check=False)
    time.sleep(2)
    cli('runtime', 'wait')
    time.sleep(1)
    cli('xr', 'set-device-state', check=False)
    m0 = mark()
    cli('xr', 'exit', check=False)  # world.xr.offer "always": re-offered after exit
    time.sleep(1.5)
    status = cli('xr', 'status', check=False)
    if not ((status.get('data') or {}).get('result') or {}).get('sessionActive'):
        cli('xr', 'enter')
    cli('xr', 'set-input-mode', payload={'mode': 'hand'})
    cli('xr', 'set-hand-pose', payload={'device': writer, 'poseId': hand_pose})
    # Park both hands away from the work area (entering resets device poses).
    cli('xr', 'set-transform', payload={'device': 'hand-right', 'position': {'x': 0.3, 'y': 0.9, 'z': 0.1}})
    cli('xr', 'set-transform', payload={'device': 'hand-left', 'position': {'x': -0.3, 'y': 0.9, 'z': 0.1}})
    return m0


def tip_to(pos, duration=0.3, device='hand-right'):
    """Move the index fingertip exactly to an XR-origin position (metres)."""
    cli('xr', 'animate-to', payload={
        'device': device, 'anchor': 'index-tip',
        'position': {'x': pos[0], 'y': pos[1], 'z': pos[2]},
        'duration': duration, 'easing': 'minimum-jerk'})


def trace(points, duration, height, jitter_m=0.0, device='hand-right', lift=0.06):
    """Lift above the first point, touch down, follow the polyline in `duration` seconds, lift."""
    sx, sy, sz = points[0]
    tip_to((sx, sy + height + lift, sz), 0.5, device)
    tip_to((sx, sy + height, sz), 0.2, device)
    segs = [math.dist(points[i], points[i + 1]) for i in range(len(points) - 1)]
    total = sum(segs) or 1
    steps = [{'label': f'p{i}', 'anchor': 'index-tip',
              'position': {'x': p[0] + random.uniform(-jitter_m, jitter_m), 'y': p[1] + height,
                           'z': p[2] + random.uniform(-jitter_m, jitter_m)},
              'duration': max(0.05, duration * segs[i] / total)}
             for i, p in enumerate(points[1:])]
    # Note: during run-sequence the OTHER hand drops to the hip; it may cross your surfaces.
    cli('xr', 'run-sequence', payload={'device': device, 'steps': steps})
    ex, ey, ez = points[-1]
    tip_to((ex, ey + height + lift + 0.01, ez), 0.3, device)


def press(target, device='hand-left'):
    """Poke a UI element by id (see `iwsdk xr list-targets`), then move the hand away."""
    cli('xr', 'run-sequence', payload={'device': device, 'steps': [
        {'label': 'press', 'target': target, 'press': {}},
        {'label': 'rest', 'position': {'relativeTo': 'head', 'x': -0.3, 'y': -0.6, 'z': 0.05}, 'duration': 0.3}]})


def look_at(point, head=(0.0, 1.5, 0.05)):
    """Point the emulated headset at something for screenshots (place the head after entering)."""
    cli('xr', 'set-transform', payload={'device': 'headset', 'position': {'x': head[0], 'y': head[1], 'z': head[2]}})
    cli('xr', 'look-at', payload={'device': 'headset', 'target': {'x': point[0], 'y': point[1], 'z': point[2]}})


def main():
    os.makedirs(os.path.join(ROOT, 'artifacts'), exist_ok=True)
    m0 = reset_and_enter()
    layout = json.loads(wait_for(r'^layout (.*)', m0, 15).group(1))
    print('layout keys:', list(layout))
    shot('00-entered')
    # Example journey (adapt):
    # target = layout['targets'][0]
    # ms = mark(); trace(target['pts'], target['duration'], height=0.0085)
    # m = wait_for(r'scored (\d+)', ms, 8); assert int(m.group(1)) >= 55
    # ms = mark(); press('btn-next'); wait_for(r'^layout', ms, 10)
    print('PASS')


if __name__ == '__main__':
    main()
