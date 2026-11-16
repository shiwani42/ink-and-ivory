#!/usr/bin/env python3
"""
End-to-end helpers for IWSDK (WebXR) apps in the IWSDK emulator (IWER), hands only.
Copy to <repo>/scripts/e2e/xr_e2e_lib.py (or tools/), then write a journey script:

    from xr_e2e_lib import *
    pin_page()                       # after the dev server is up (reloads the page)
    enter_hands(seat=True)
    m = wait_for(r' placing ')       # regex on the text after the tag
    select()                         # pinch tap to place
    check('placed', bool(wait_for(r' intro ', 10)))
    finish()                         # prints a summary, exits 1 on any FAIL

App contract (dev builds only, stripped from production):
    console.info(`[${TAG}] #${pageId}.${seq} <event> key=value ... layout=${JSON.stringify(points)}`)
  - pageId: random per page load; seq: increments on every line.
  - Lines without `#pageId.seq` still work, matched by timestamp only.

Waits ask the CLI for `browser logs {"since": <ms>, "pattern": "[TAG]"}`, pin the newest page
load, and accept only lines with seq above the last one consumed, so a test never matches a
stale line (the browser log buffer survives reloads).

Configure with env vars:
  XR_LOG_TAG      log tag without brackets (default 'app')
  XR_PROJECT_DIR  repo root (default: nearest ancestor of this file with a package.json)
Requires a running dev server: `npx @iwsdk/cli dev up --ai-mode agent` (headless)
or `--ai-mode collaborate` (headed). Never edit src/ while a run is going.
"""
import json
import math
import os
import pathlib
import random
import re
import subprocess
import sys
import time


def _project_dir():
    env = os.environ.get('XR_PROJECT_DIR')
    if env:
        return env
    for p in pathlib.Path(__file__).resolve().parents:
        if (p / 'package.json').exists():
            return str(p)
    return os.getcwd()


ROOT = _project_dir()
TAG = os.environ.get('XR_LOG_TAG', 'app')
_LOCAL = os.path.join(ROOT, 'node_modules', '.bin', 'iwsdk')
CLI = [_LOCAL] if os.path.exists(_LOCAL) else ['npx', '@iwsdk/cli']
ENV = dict(os.environ, ONNXRUNTIME_NODE_INSTALL_CUDA='skip')
SEQUENCE_CHUNK_S = 18.0   # IWER gives up on a run-sequence 28 s after dispatch (30 s bridge)

CUR = {'page': None, 'seq': 0, 'since': 0}
RESULTS = {}


# ---------------------------------------------------------------- CLI and logs

def cli(*args, payload=None, timeout=90, check=True):
    """Run one IWSDK CLI command; return its JSON envelope ({'ok':..., 'data':...})."""
    cmd = CLI + list(args)
    if payload is not None:
        cmd += ['--input-json', json.dumps(payload)]
    try:
        proc = subprocess.run(cmd, cwd=ROOT, env=ENV, capture_output=True, text=True, timeout=timeout)
        out = proc.stdout or proc.stderr
    except subprocess.TimeoutExpired:
        out = ''
    try:
        data = json.loads(out)
    except (json.JSONDecodeError, TypeError):
        data = {'ok': False, 'raw': (out or '')[:400]}
    if check and not data.get('ok'):
        print('  ! command failed:', ' '.join(args), str(data.get('error', data))[:300], flush=True)
    return data


def now_ms():
    return int(time.time() * 1000)


def logs(since=None, pattern=None, count=200):
    """[(timestamp_ms, message)] for lines carrying the tag, newest last. count is capped at 200."""
    payload = {'count': min(count, 200), 'pattern': pattern or re.escape(f'[{TAG}]')}
    if since:
        payload['since'] = since
    data = cli('browser', 'logs', payload=payload, check=False)
    res = data.get('data') or {}
    res = res.get('result', res)
    lines = res if isinstance(res, list) else (res.get('logs') or [])
    out = []
    for line in lines:
        if not isinstance(line, dict):
            continue
        msg = str(line.get('message') or line.get('text') or '')
        if f'[{TAG}]' in msg:
            out.append((int(line.get('timestamp') or 0), msg))
    return out


def _page_seq(msg):
    g = re.search(r'#(\w+)\.(\d+)', msg)
    return (g.group(1), int(g.group(2))) if g else (None, 0)


def _body(msg):
    """The text after '[TAG] #page.seq'."""
    msg = msg.split(f'[{TAG}]', 1)[-1]
    return re.sub(r'^\s*#\w+\.\d+', '', msg)


def mark():
    """Consume everything logged so far: later waits only see newer lines."""
    CUR['since'] = now_ms() - 50
    for _, msg in logs(since=CUR['since'] - 5000):
        page, seq = _page_seq(msg)
        if page and (CUR['page'] is None or page == CUR['page']):
            CUR['seq'] = max(CUR['seq'], seq)
    return CUR['since']


def pin_page(reload=True, settle=6.0):
    """Reload (optional) and pin waits to the newest page load."""
    t0 = now_ms() - 50
    if reload:
        cli('browser', 'reload')
        time.sleep(settle)
    lines = [m for _, m in logs(since=t0) if _page_seq(m)[0]]
    CUR['page'] = _page_seq(lines[-1])[0] if lines else None
    CUR['seq'] = 0
    CUR['since'] = t0
    print('page', CUR['page'], flush=True)
    return CUR['page']


def wait_for(pattern, timeout=30.0, consume=True):
    """Return the regex match on the first new line (after the tag) matching `pattern`."""
    rx = re.compile(pattern)
    end = time.time() + timeout
    while time.time() < end:
        for ts, msg in logs(since=CUR['since']):
            page, seq = _page_seq(msg)
            if CUR['page'] is not None and page is not None and page != CUR['page']:
                continue
            if page is not None and seq <= CUR['seq']:
                continue
            m = rx.search(_body(msg))
            if m:
                if consume:
                    if page is not None:
                        CUR['seq'] = seq
                    else:
                        CUR['since'] = ts + 1
                return m
        time.sleep(0.4)
    raise TimeoutError(f'timed out waiting for /{pattern}/')


def field(text, name):
    """Parse `name=<json>` (array, nested array or object) from a log line or match string."""
    if hasattr(text, 'string'):
        text = text.string
    g = re.search(re.escape(name) + r'=(\[\[.*?\]\]|\[[^\]]*\]|\{.*?\})(?:\s|$)', text)
    return json.loads(g.group(1)) if g else None


# ---------------------------------------------------------------- results

def check(name, ok, info=''):
    RESULTS[name] = bool(ok)
    print(('PASS ' if ok else 'FAIL ') + name, info, flush=True)
    return bool(ok)


def finish():
    failed = [k for k, v in RESULTS.items() if not v]
    print(f'\n{len(RESULTS) - len(failed)}/{len(RESULTS)} passed', ('FAILED: ' + ', '.join(failed)) if failed else '')
    sys.exit(1 if failed else 0)


# ---------------------------------------------------------------- session and devices

def enter_hands(pose='point', device='hand-right', seat=True,
                head=(0.0, 1.0, -1.25), head_quat=(-0.38, 0.0, 0.0, 0.925)):
    """Enter XR in hand mode, park both hands, optionally seat the headset looking down at a table."""
    status = cli('xr', 'status', check=False)
    if not ((status.get('data') or {}).get('result') or {}).get('sessionActive'):
        cli('xr', 'enter')
        time.sleep(2)
    cli('xr', 'set-input-mode', payload={'mode': 'hand'})
    cli('xr', 'set-hand-pose', payload={'device': device, 'poseId': pose})
    cli('xr', 'set-transform', payload={'device': 'hand-right', 'position': {'x': 0.3, 'y': 0.9, 'z': 0.1}})
    cli('xr', 'set-transform', payload={'device': 'hand-left', 'position': {'x': -0.3, 'y': 0.9, 'z': 0.1}})
    if seat:
        x, y, z = head
        qx, qy, qz, qw = head_quat
        cli('xr', 'set-transform', payload={'device': 'headset', 'position': {'x': x, 'y': y, 'z': z},
                                            'orientation': {'x': qx, 'y': qy, 'z': qz, 'w': qw}})


def key(k, shift=False):
    steps = [{'action': 'press', 'key': k}]
    if shift:
        steps = [{'action': 'keyDown', 'key': 'Shift'}] + steps + [{'action': 'keyUp', 'key': 'Shift'}]
    cli('browser', 'interact', payload={'steps': steps}, check=False)


def fresh_user(reset_key='R'):
    """Dev reset (Shift+R clears saved progress and reloads), then pin the new page."""
    cli('xr', 'exit', check=False)
    key(reset_key, shift=True)
    time.sleep(2)
    return pin_page(reload=False)


def select(device='hand-right'):
    """A pinch tap."""
    return cli('xr', 'select', payload={'device': device})


def microgesture(gesture='tap', device='hand-right'):
    """swipe-left | swipe-right | swipe-forward | swipe-backward | tap (raise the hand side-on first)."""
    return cli('xr', 'microgesture', payload={'device': device, 'gesture': gesture})


def look_at(point, head=(0.0, 1.5, 0.05)):
    cli('xr', 'set-transform', payload={'device': 'headset', 'position': {'x': head[0], 'y': head[1], 'z': head[2]}})
    cli('xr', 'look-at', payload={'device': 'headset', 'target': {'x': point[0], 'y': point[1], 'z': point[2]}})


def shot(name):
    os.makedirs(os.path.join(ROOT, 'artifacts'), exist_ok=True)
    cli('browser', 'screenshot', '--output-file', f'artifacts/e2e-{name}.png', check=False)


# ---------------------------------------------------------------- hands

def sequence(steps, device='hand-right'):
    """xr run-sequence, split into chunks of about 18 s of step time. The first positioned
    step of every chunk must name an anchor; this re-adds the last one seen."""
    chunks, cur, t, anchor = [], [], 0.0, None
    for s in steps:
        d = float(s.get('duration', 0.4))
        if cur and t + d > SEQUENCE_CHUNK_S:
            chunks.append(cur)
            cur, t = [], 0.0
        s = dict(s)
        anchor = s.get('anchor', anchor)
        if not cur and 'position' in s and 'anchor' not in s and anchor:
            s['anchor'] = anchor
        cur.append(s)
        t += d
    if cur:
        chunks.append(cur)
    result = None
    for c in chunks:
        result = cli('xr', 'run-sequence', payload={'device': device, 'steps': c}, timeout=60)
        if not result.get('ok'):
            print('SEQUENCE ERROR', str(result.get('error', result))[:300], flush=True)
            break
    return result


def tip_to(pos, duration=0.3, device='hand-right', anchor='index-tip'):
    """Move a hand anchor exactly to an XR-origin position (metres)."""
    cli('xr', 'animate-to', payload={'device': device, 'anchor': anchor,
                                     'position': {'x': pos[0], 'y': pos[1], 'z': pos[2]},
                                     'duration': duration, 'easing': 'minimum-jerk'})


def trace(points, duration, height=0.0, jitter_m=0.0, device='hand-right', lift=0.06):
    """Lift above the first point, touch down, follow the polyline in `duration` s, lift.
    During run-sequence the other hand drops to the hip and may cross your surfaces."""
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
    sequence(steps, device)
    ex, ey, ez = points[-1]
    tip_to((ex, ey + height + lift + 0.01, ez), 0.3, device)


def press(target, device='hand-left'):
    """Poke a UI element by id (from `xr list-targets`), then move the hand away."""
    return sequence([{'label': 'press', 'target': target, 'press': {}},
                     {'label': 'rest', 'position': {'relativeTo': 'head', 'x': -0.3, 'y': -0.6, 'z': 0.05},
                      'duration': 0.3}], device)


def grab_to(obj_pos, dest_pos, device='hand-right', carry=0.6):
    """Pinch-grab at a world position (grasp point), carry to another, release."""
    o = {'x': obj_pos[0], 'y': obj_pos[1], 'z': obj_pos[2]}
    d = {'x': dest_pos[0], 'y': dest_pos[1], 'z': dest_pos[2]}
    return sequence([{'label': 'reach', 'anchor': 'grasp', 'position': o, 'duration': 0.5,
                      'pinch': {'value': 1, 'at': 'arrival'}},
                     {'label': 'carry', 'position': d, 'duration': carry},
                     {'label': 'release', 'pinch': 0, 'duration': 0.15}], device)


def goto_preset(query, storage_key, script='tools/goto.mjs'):
    """Jump to a ?state= preset in the emulator (its managed browser drops URL queries).
    Needs `dev restart --allow-browser-automation` and scripts/goto_preset.mjs copied to `script`."""
    os.makedirs(os.path.join(ROOT, 'artifacts'), exist_ok=True)
    with open(os.path.join(ROOT, 'artifacts', 'goto-preset.json'), 'w') as f:
        json.dump({'key': storage_key, 'query': query}, f)
    t0 = now_ms() - 50
    r = cli('browser', 'run', script)
    time.sleep(4)
    lines = [m for _, m in logs(since=t0) if _page_seq(m)[0]]
    CUR.update(page=_page_seq(lines[-1])[0] if lines else None, seq=0, since=t0)
    return r


if __name__ == '__main__':
    print(__doc__)
