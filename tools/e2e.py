#!/usr/bin/env python3
"""
End-to-end test in the IWSDK emulator (IWER), hands only.

Plays every lesson the way a judge would: start from a clean slate, enter mixed
reality, let the master demonstrate, calibrate on the seal, write every stroke
with the emulated right index fingertip, press "Next lesson" by poking it, and
check the scores the app logs. Screenshots go to artifacts/e2e-*.png.

Prerequisites: `npm run dev` (or `npx iwsdk dev up --headless`) is running.
Usage: python3 tools/e2e.py [--lessons N] [--jitter MM]
"""
import argparse
import json
import math
import os
import random
import re
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLI = [os.path.join(ROOT, 'node_modules', '.bin', 'iwsdk')]
ENV = dict(os.environ, ONNXRUNTIME_NODE_INSTALL_CUDA='skip')
CONTACT = 0.0085  # fingertip anchor height above the paper when touching


def cli(*args, payload=None, check=True):
    cmd = CLI + list(args)
    if payload is not None:
        cmd += ['--input-json', json.dumps(payload)]
    out = subprocess.run(cmd, cwd=ROOT, env=ENV, capture_output=True, text=True)
    out = out.stdout or out.stderr
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        data = {'ok': False, 'raw': out[:400]}
    if check and not data.get('ok'):
        print('  ! command failed:', ' '.join(args), str(data)[:300])
    return data


def logs(count=150):
    """[(timestamp_ms, message)] for recent console lines."""
    data = cli('browser', 'logs', payload={'count': count}, check=False)
    result = (data.get('data') or {}).get('result') or []
    return [(int(l.get('timestamp', 0)), str(l.get('message', ''))) for l in result if isinstance(l, dict)]


def wait_for(pattern, since_ms, timeout=30.0):
    """Wait for a [hoam] line matching `pattern` logged after `since_ms`."""
    rx = re.compile(pattern)
    end = time.time() + timeout
    while time.time() < end:
        for ts, msg in logs():
            if ts > since_ms and msg.startswith('[hoam] '):
                m = rx.search(msg[len('[hoam] '):])
                if m:
                    return m, ts
        time.sleep(0.4)
    raise TimeoutError(f'timed out waiting for /{pattern}/')


def mark():
    return int(time.time() * 1000) - 50


def shot(name):
    cli('browser', 'screenshot', '--output-file', f'artifacts/e2e-{name}.png', check=False)


def hand_to(pos, duration=0.3, device='hand-right'):
    cli('xr', 'animate-to', payload={
        'device': device, 'anchor': 'index-tip',
        'position': {'x': pos[0], 'y': pos[1], 'z': pos[2]},
        'duration': duration, 'easing': 'minimum-jerk'})


def draw(points, duration, jitter, device='hand-right'):
    """Lift above the start, touch down, trace the polyline in time, lift."""
    y = points[0][1] + CONTACT
    sx, _, sz = points[0]
    hand_to((sx, y + 0.06, sz), 0.5, device)
    hand_to((sx, y, sz), 0.2, device)
    # Total arc length, to spread the duration along the stroke.
    segs = [math.dist(points[i], points[i + 1]) for i in range(len(points) - 1)]
    total = sum(segs) or 1
    steps = []
    for i, p in enumerate(points[1:]):
        jx = random.uniform(-jitter, jitter)
        jz = random.uniform(-jitter, jitter)
        steps.append({'label': f'p{i}', 'anchor': 'index-tip',
                      'position': {'x': p[0] + jx, 'y': y, 'z': p[2] + jz},
                      'duration': max(0.05, duration * segs[i] / total)})
    cli('xr', 'run-sequence', payload={'device': device, 'steps': steps})
    ex, _, ez = points[-1]
    hand_to((ex, y + 0.07, ez), 0.3, device)


def play_song(lay, device):
    """Tap every note of the song on its key, in time, in one natural hand sequence."""
    beat = lay['beat']
    steps = []
    for name, beats in lay['notes']:
        k = lay['keys'][name]
        above = {'x': k[0], 'y': k[1] + CONTACT + 0.035, 'z': k[2]}
        down = {'x': k[0], 'y': k[1] + CONTACT - 0.002, 'z': k[2]}
        travel = max(0.08, beats * beat - 0.2)
        steps.append({'label': f'{name}-over', 'anchor': 'index-tip', 'position': above, 'duration': travel})
        steps.append({'label': f'{name}-tap', 'anchor': 'index-tip', 'position': down, 'duration': 0.1})
        steps.append({'label': f'{name}-up', 'anchor': 'index-tip', 'position': above, 'duration': 0.1})
    # Play with a pointing hand (one finger, the way a beginner plays a melody).
    cli('xr', 'set-hand-pose', payload={'device': device, 'poseId': 'point'})
    # run-sequence is capped at 25 s: send the song in chunks of about 18 s.
    chunk, total = [], 0.0
    for st in steps:
        chunk.append(st)
        total += st['duration']
        if total > 18 and st['label'].endswith('-up'):
            cli('xr', 'run-sequence', payload={'device': device, 'steps': chunk})
            chunk, total = [], 0.0
    if chunk:
        cli('xr', 'run-sequence', payload={'device': device, 'steps': chunk})


def look_at_paper(layout):
    seal = layout['seal']
    centre = (seal[0] - 0.088, seal[1], seal[2] - 0.138)
    cli('xr', 'set-transform', payload={'device': 'headset', 'position': {'x': centre[0], 'y': centre[1] + 0.32, 'z': centre[2] + 0.42}})
    cli('xr', 'look-at', payload={'device': 'headset', 'target': {'x': centre[0], 'y': centre[1], 'z': centre[2] - 0.03}})


def press(target, hand='hand-left'):
    cli('xr', 'run-sequence', payload={'device': hand, 'steps': [
        {'label': 'press', 'target': target, 'press': {}},
        {'label': 'rest', 'position': {'relativeTo': 'head', 'x': -0.3, 'y': -0.6, 'z': 0.05}, 'duration': 0.3}]})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lessons', type=int, default=6)
    ap.add_argument('--jitter', type=float, default=2.0, help='random fingertip error in mm')
    ap.add_argument('--negative', action='store_true', help='first try wrong strokes and expect specific hints')
    ap.add_argument('--hand', default='right', choices=['right', 'left'], help='writing hand')
    ap.add_argument('--piano', type=int, default=0, help='also play N piano songs after the calligraphy lessons')
    ap.add_argument('--compose', action='store_true', help='at the piano, play a tune of our own and check the master learns and teaches it')
    ap.add_argument('--watch', action='store_true', help='keep the emulated head looking at the paper (for a human watching)')
    args = ap.parse_args()
    jitter = args.jitter / 1000
    writer = f'hand-{args.hand}'
    other = 'hand-left' if args.hand == 'right' else 'hand-right'
    os.makedirs(os.path.join(ROOT, 'artifacts'), exist_ok=True)
    results = []
    negatives = []

    print('1. reset progress and reload')
    cli('xr', 'exit', check=False)
    cli('browser', 'reload')
    cli('runtime', 'wait')
    cli('browser', 'interact', payload={'steps': [
        {'action': 'keyDown', 'key': 'Shift'}, {'action': 'press', 'key': 'R'}, {'action': 'keyUp', 'key': 'Shift'}]}, check=False)
    time.sleep(2)
    cli('runtime', 'wait')
    time.sleep(2)
    shot('00-browser')

    print('2. enter mixed reality, hands only')
    # With world.xr.offer "always" the emulator re-enters as soon as a session ends,
    # so mark first, then exit and let it (or us) start a fresh session.
    cli('xr', 'set-device-state', check=False)
    m0 = mark()
    cli('xr', 'exit', check=False)
    time.sleep(1.5)
    status = cli('xr', 'status', check=False)
    if not ((status.get('data') or {}).get('result') or {}).get('sessionActive'):
        cli('xr', 'enter')
    cli('xr', 'set-input-mode', payload={'mode': 'hand'})
    cli('xr', 'set-hand-pose', payload={'device': writer, 'poseId': 'point'})
    cli('xr', 'set-transform', payload={'device': 'hand-right', 'position': {'x': 0.3, 'y': 0.9, 'z': 0.1}})
    cli('xr', 'set-transform', payload={'device': 'hand-left', 'position': {'x': -0.3, 'y': 0.9, 'z': 0.1}})
    m, _ = wait_for(r'placed on (.*)', m0, 15)
    print('   placed on', m.group(1))
    m, _ = wait_for(r'^layout (.*)', m0, 10)
    layout = json.loads(m.group(1))
    if args.watch:
        look_at_paper(layout)
    time.sleep(1.2)
    shot('01-watch')

    print('3. calibrate on the seal')
    m1 = mark()
    wait_for(r'^calibrate$', m0, 30)
    seal = layout['seal']
    hand_to((seal[0], seal[1] + 0.05, seal[2]), 0.6, writer)
    hand_to((seal[0], seal[1] + CONTACT, seal[2]), 0.4, writer)
    time.sleep(0.6)
    m, _ = wait_for(r'calibrated offset (.*)', m1, 6)
    print('   offset', m.group(1))
    hand_to((seal[0], seal[1] + 0.08, seal[2]), 0.3, writer)

    for lesson_no in range(args.lessons):
        m, _ = wait_for(r'^practice$', m0, 40)
        lesson = layout['lesson']
        print(f'4.{lesson_no + 1} lesson {lesson}: {len(layout["strokes"])} strokes')
        scores = []
        if args.negative and lesson_no == 0:
            stroke = layout['strokes'][0]
            pts = stroke['pts']
            cases = [
                ('reversed', list(reversed(pts)), stroke['duration'], 'Other direction'),
                ('off path', [[p[0], p[1], p[2] + 0.045] for p in pts], stroke['duration'], "closer to the master"),
                ('rushed', pts, stroke['duration'] / 8, 'Slower'),
            ]
            for name, bad, dur, expect in cases:
                ms = mark()
                draw(bad, dur, 0)
                m, _ = wait_for(r'stroke 0 scored (\d+) (.*)', ms, 8)
                ok = expect in m.group(2)
                print(f'     negative {name}: {m.group(1)} {m.group(2)} -> {"OK" if ok else "UNEXPECTED"}')
                negatives.append(ok)
                time.sleep(1.6)
            # The rushed stroke still passes, which completes lesson one: write it again.
            wait_for(r'lesson complete', ms, 6)
            ms = mark()
            press('btn-again', other)
            wait_for(r'^practice$', ms, 10)
        for i, stroke in enumerate(layout['strokes']):
            for attempt in range(3):
                ms = mark()
                if args.watch:
                    look_at_paper(layout)
                draw(stroke['pts'], stroke['duration'], jitter, writer)
                if i == 0 and attempt == 0 and lesson_no in (0, args.lessons - 1):
                    shot(f'{lesson_no + 2:02d}-{lesson}-stroke')
                m, _ = wait_for(rf'stroke {i} scored (\d+) (.*)', ms, 8)
                score = int(m.group(1))
                print(f'     stroke {i + 1}: {score}  {m.group(2)}')
                if score < 55:
                    cap = [msg for ts, msg in logs(40) if ts > ms and 'capture' in msg]
                    print('       ', cap[-1:] )
                time.sleep(1.5)  # caption cooldown
                if 'Try again' not in m.group(2):
                    scores.append(score)
                    break
            else:
                print('     stroke failed three times')
                scores.append(0)
        wait_for(r'lesson complete', m0, 6)
        if args.watch:
            look_at_paper(layout)
            time.sleep(2.0)
        time.sleep(0.8)
        shot(f'{lesson_no + 2:02d}-{lesson}-complete')
        results.append((lesson, scores))
        if lesson_no < args.lessons - 1:
            m0 = mark()
            press('btn-next', other)
            m, _ = wait_for(r'^layout (.*)', m0, 10)
            layout = json.loads(m.group(1))

    if args.piano or args.compose:
        m0 = mark()
        press('craft-piano', other)
        lay = None
        for song_no in range(args.piano):
            m, _ = wait_for(r'^piano-layout (.*)', m0, 15)
            lay = json.loads(m.group(1))
            print(f'5.{song_no + 1} piano {lay["song"]}: {len(lay["notes"])} notes')
            if args.watch:
                look_at_paper(lay)
            wait_for(r'^practice$', m0, 60)
            ms = mark()
            play_song(lay, writer)
            m, _ = wait_for(r'lesson complete score (\d+) accuracy ([\d.]+) rhythm ([\d.]+)', ms, 20)
            score = int(m.group(1))
            print(f'     score {score} (accuracy {m.group(2)}, rhythm {m.group(3)})')
            results.append((lay['song'], [score]))
            time.sleep(1.0)
            shot(f'piano-{song_no + 1}-{lay["song"]}')
            if song_no < args.piano - 1:
                m0 = mark()
                press('btn-next', other)

        if args.compose:
            if lay is None:
                m, _ = wait_for(r'^piano-layout (.*)', m0, 15)
                lay = json.loads(m.group(1))
            ms = mark()
            press('btn-record', other)
            wait_for(r'^listen$', ms, 10)
            tune = [['C4', 1], ['E4', 1], ['G4', 1], ['E4', 0.5], ['D4', 0.5], ['C4', 2]]
            print(f'6. compose: play our own tune ({len(tune)} notes) to the master')
            play_song({'beat': 0.6, 'notes': tune, 'keys': lay['keys']}, writer)
            m, _ = wait_for(r'^learned (\d+) notes bpm (\d+)', ms, 15)
            print(f'     the master learned {m.group(1)} notes at {m.group(2)} bpm')
            m, _ = wait_for(r'^piano-layout (.*)', ms, 10)
            learned = json.loads(m.group(1))
            heard = [n for n, _ in learned['notes']]
            expect = [n for n, _ in tune]
            print(f'     notes {heard} (played {expect})')
            wait_for(r'^practice$', ms, 60)
            mp = mark()
            play_song(learned, writer)
            m, _ = wait_for(r'lesson complete score (\d+)', mp, 20)
            score = int(m.group(1)) if heard == expect else 0
            print(f'     played it back with the master: score {m.group(1)}')
            results.append(('your-tune', [score]))
            shot('piano-your-tune')

    print('\nRESULTS')
    ok = True
    for lesson, scores in results:
        avg = round(sum(scores) / len(scores)) if scores else 0
        print(f'  {lesson:9s} strokes {scores}  average {avg}')
        ok = ok and all(s >= 55 for s in scores)
    if negatives:
        print(f'  negative cases: {sum(negatives)}/{len(negatives)} gave the expected hint')
        ok = ok and all(negatives)
    print('PASS' if ok else 'FAIL')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
