#!/usr/bin/env python3
"""Emulator test: the real table is not where the room scan says (a standing
desk raised or lowered since Space Setup), and the piano calibrates on middle C.

The emulated finger rests DY above or below the seal (the "real" surface),
keeps still, then lifts. The app must move the paper onto that surface and
then score strokes written there. Then the piano: the master asks for a
fingertip on the glowing middle C, not a seal.

    python3 tools/e2e_height.py
"""
import json
import re
import sys
import time

import e2e as E


def fresh_session(m_query=None):
    E.cli('xr', 'exit', check=False)
    if m_query:
        with open('artifacts/goto-query.txt', 'w') as f:
            f.write(m_query)
        E.cli('browser', 'run', 'tools/goto.mjs', check=False)
    else:
        E.cli('browser', 'reload')
    E.cli('runtime', 'wait')
    E.cli('browser', 'interact', payload={'steps': [
        {'action': 'keyDown', 'key': 'Shift'}, {'action': 'press', 'key': 'R'}, {'action': 'keyUp', 'key': 'Shift'}]}, check=False) if not m_query else None
    time.sleep(3)
    E.cli('runtime', 'wait')
    E.cli('xr', 'set-device-state', check=False)
    m0 = E.mark()
    E.cli('xr', 'exit', check=False)
    time.sleep(1.5)
    for _ in range(5):
        st = E.cli('xr', 'status', check=False)
        if ((st.get('data') or {}).get('result') or {}).get('sessionActive'):
            break
        E.cli('xr', 'enter', check=False)
        time.sleep(1.5)
    E.cli('xr', 'set-input-mode', payload={'mode': 'hand'})
    E.cli('xr', 'set-hand-pose', payload={'device': 'hand-right', 'poseId': 'point'})
    E.cli('xr', 'set-transform', payload={'device': 'hand-right', 'position': {'x': 0.3, 'y': 0.9, 'z': 0.1}})
    E.cli('xr', 'set-transform', payload={'device': 'hand-left', 'position': {'x': -0.3, 'y': 0.9, 'z': 0.1}})
    return m0


def height_case(dy):
    print(f'== real table {dy * 100:+.0f} cm from the scanned one')
    m0 = fresh_session()
    m, _ = E.wait_for(r'^layout (.*)', m0, 25)
    layout = json.loads(m.group(1))
    E.wait_for(r'^calibrate$', m0, 40)
    seal = layout['seal']
    ms = E.mark()
    E.hand_to((seal[0], seal[1] + dy + 0.06, seal[2]), 0.6)
    E.hand_to((seal[0], seal[1] + dy + E.CONTACT, seal[2]), 0.4)
    time.sleep(1.0)
    E.hand_to((seal[0], seal[1] + dy + 0.07, seal[2]), 0.3)
    m, _ = E.wait_for(r'desk height corrected by (-?[\d.]+) cm', ms, 8)
    moved = float(m.group(1))
    print(f'   moved {moved:+.1f} cm')
    E.wait_for(r'^practice$', ms, 10)
    stroke = layout['strokes'][0]
    pts = [[p[0], p[1] + dy, p[2]] for p in stroke['pts']]
    ms = E.mark()
    E.draw(pts, stroke['duration'], 0.001)
    m, _ = E.wait_for(r'stroke 0 scored (\d+) (.*)', ms, 8)
    score = int(m.group(1))
    print(f'   stroke on the real table: {score} {m.group(2)}')
    E.shot(f'height-{int(dy * 100):+d}')
    return abs(moved - dy * 100) < 1.0 and score >= 55


def piano_case():
    print('== piano: calibrate on middle C')
    m0 = fresh_session('?state=watch&craft=piano&lesson=1&scene=room')
    E.wait_for(r'^calibrate$', m0, 60)
    m, _ = E.wait_for(r'^piano-layout (.*)', m0, 10)
    lay = json.loads(m.group(1))
    c4 = lay['keys']['C4']
    seal = lay['seal']
    ok_spot = abs(seal[0] - c4[0]) < 0.005 and abs(seal[2] - c4[2]) < 0.005
    print(f'   target is middle C: {ok_spot}')
    time.sleep(0.8)
    E.shot('height-piano-c')
    ms = E.mark()
    E.hand_to((seal[0], seal[1] + 0.06, seal[2]), 0.6)
    E.hand_to((seal[0], seal[1] + E.CONTACT, seal[2]), 0.4)
    m, _ = E.wait_for(r'calibrated offset (.*)', ms, 8)
    print(f'   calibrated {m.group(1)}')
    return ok_spot


def main():
    only = sys.argv[1:]
    cases = [('higher desk', lambda: height_case(0.10)), ('lower desk', lambda: height_case(-0.08)), ('piano middle C', piano_case)]
    results = [(n, f()) for n, f in cases if not only or any(n.startswith(o) for o in only)]
    print('\nRESULTS')
    for name, ok in results:
        print(f'  {"PASS" if ok else "FAIL"}  {name}')
    ok = all(r for _, r in results)
    print('PASS' if ok else 'FAIL')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
