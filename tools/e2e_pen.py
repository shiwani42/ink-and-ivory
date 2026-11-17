#!/usr/bin/env python3
"""Emulator test for "Write with: a real pen (beta)".

The emulated right hand takes a tripod (pen) grip. A real pen can't be
emulated, so the test decides where the pen's tip is: D below and in front
of the index knuckle. It rests that tip on the seal to calibrate, then writes
lesson 1's strokes by moving the knuckle so that the tip follows each stroke.
The app must learn the offset and score the strokes like fingertip writing.

    python3 tools/e2e_pen.py
"""
import json
import sys
import time

import e2e as E

KNUCKLE = 'index-finger-phalanx-proximal'
D = (0.025, 0.075, 0.045)  # knuckle position relative to the pen tip (up, right, toward you)
ORIENT = {}  # the hand's orientation, held fixed like a steady writing hand


def knuckle_to(tip, duration=0.4):
    E.cli('xr', 'animate-to', payload={
        'device': 'hand-right', 'anchor': KNUCKLE,
        'position': {'x': tip[0] + D[0], 'y': tip[1] + D[1], 'z': tip[2] + D[2]},
        **({'orientation': ORIENT['q']} if ORIENT else {}),
        'duration': duration, 'easing': 'minimum-jerk'})


def write(points, duration):
    sx, sy, sz = points[0]
    knuckle_to((sx, sy + 0.05, sz), 0.5)
    knuckle_to((sx, sy, sz), 0.25)
    segs = [((points[i + 1][0] - points[i][0]) ** 2 + (points[i + 1][2] - points[i][2]) ** 2) ** 0.5 for i in range(len(points) - 1)]
    total = sum(segs) or 1
    steps = [{'label': f'p{i}', 'anchor': KNUCKLE,
              'position': {'x': p[0] + D[0], 'y': sy + D[1], 'z': p[2] + D[2]},
              'orientation': ORIENT['q'],
              'duration': max(0.05, duration * segs[i] / total)} for i, p in enumerate(points[1:])]
    E.cli('xr', 'run-sequence', payload={'device': 'hand-right', 'steps': steps})
    ex, ey, ez = points[-1]
    knuckle_to((ex, ey + 0.06, ez), 0.3)


def main():
    print('1. reset and enter')
    E.cli('xr', 'exit', check=False)
    E.cli('browser', 'reload')
    E.cli('runtime', 'wait')
    E.cli('browser', 'interact', payload={'steps': [
        {'action': 'keyDown', 'key': 'Shift'}, {'action': 'press', 'key': 'R'}, {'action': 'keyUp', 'key': 'Shift'}]}, check=False)
    time.sleep(2)
    E.cli('runtime', 'wait')
    time.sleep(2)
    E.cli('xr', 'set-device-state', check=False)
    m0 = E.mark()
    E.cli('xr', 'exit', check=False)
    time.sleep(1.5)
    st = E.cli('xr', 'status', check=False)
    if not ((st.get('data') or {}).get('result') or {}).get('sessionActive'):
        E.cli('xr', 'enter')
    E.cli('xr', 'set-input-mode', payload={'mode': 'hand'})
    E.cli('xr', 'set-transform', payload={'device': 'hand-right', 'position': {'x': 0.3, 'y': 0.9, 'z': 0.1}})
    E.cli('xr', 'set-transform', payload={'device': 'hand-left', 'position': {'x': -0.3, 'y': 0.9, 'z': 0.1}})
    E.wait_for(r'placed on (.*)', m0, 15)
    E.wait_for(r'^calibrate$', m0, 40)

    print('2. switch to "a real pen"')
    m1 = E.mark()
    E.press('btn-tool', 'hand-left')
    E.wait_for(r'write with pen', m1, 8)
    m, _ = E.wait_for(r'^layout (.*)', m1, 10)
    layout = json.loads(m.group(1))
    E.wait_for(r'^calibrate$', m1, 20)

    print('3. pen grip, tip on the seal, keep still')
    E.cli('xr', 'set-hand-pose', payload={'device': 'hand-right', 'poseId': 'tripod'})
    seal = layout['seal']
    knuckle_to((seal[0], seal[1] + 0.08, seal[2]), 0.6)
    t = E.cli('xr', 'get-transform', payload={'device': 'hand-right'})
    ORIENT['q'] = t['data']['result']['orientation']
    knuckle_to((seal[0], seal[1] + 0.05, seal[2]), 0.6)
    knuckle_to((seal[0], seal[1], seal[2]), 0.4)
    time.sleep(1.2)
    knuckle_to((seal[0], seal[1] + 0.06, seal[2]), 0.3)
    m, _ = E.wait_for(r'pen calibrated (.*)', m1, 8)
    print('   ', m.group(1), f'(expected {((D[0]**2 + D[1]**2 + D[2]**2) ** 0.5) * 100:.1f} cm)')

    print('4. write lesson 1 with the pen')
    E.wait_for(r'^practice$', m1, 20)
    scores = []
    for i, stroke in enumerate(layout['strokes']):
        for attempt in range(3):
            ms = E.mark()
            write(stroke['pts'], stroke['duration'])
            m, _ = E.wait_for(rf'stroke {i} scored (\d+) (.*)', ms, 8)
            print(f'    stroke {i + 1}: {m.group(1)} {m.group(2)}')
            time.sleep(1.5)
            if 'Try again' not in m.group(2):
                scores.append(int(m.group(1)))
                break
    E.wait_for(r'lesson complete', m1, 8)
    E.shot('pen-complete')

    print('5. back to the fingertip')
    m2 = E.mark()
    E.press('btn-tool', 'hand-left')
    E.wait_for(r'write with finger', m2, 8)
    ok = len(scores) == len(layout['strokes']) and all(s >= 55 for s in scores)
    print('RESULTS', scores, 'PASS' if ok else 'FAIL')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
