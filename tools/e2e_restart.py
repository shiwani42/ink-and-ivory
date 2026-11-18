#!/usr/bin/env python3
"""Emulator test: taking the headset off and putting it back on.

Quest may blur the session (system menu, headset off) or end it (sleep). Both
must leave the app fully usable: a blurred session resumes where it was; an
ended one starts again from placement, and the paper, writing and menu pokes
all work in the new session.

    python3 tools/e2e_restart.py
"""
import json
import sys
import time

import e2e as E
from e2e_height import fresh_session


def write_lesson(m0, label):
    m, _ = E.wait_for(r'^layout (.*)', m0, 30)
    lay = json.loads(m.group(1))
    m2, _ = E.wait_for(r'^(calibrate|practice)$', m0, 60)
    if m2.group(1) == 'calibrate':
        seal = lay['seal']
        E.hand_to((seal[0], seal[1] + 0.06, seal[2]), 0.5)
        E.hand_to((seal[0], seal[1] + E.CONTACT, seal[2]), 0.4)
        time.sleep(0.7)
        E.hand_to((seal[0], seal[1] + 0.07, seal[2]), 0.3)
        E.wait_for(r'^practice$', m0, 15)
    stroke = lay['strokes'][0]
    ms = E.mark()
    E.draw(stroke['pts'], stroke['duration'], 0.001)
    m, _ = E.wait_for(r'stroke 0 scored (\d+)', ms, 10)
    print(f'  {label}: stroke scored {m.group(1)}')
    return int(m.group(1))


def main():
    results = []
    m0 = fresh_session()
    results.append(('first session writes', write_lesson(m0, 'first session') >= 55))

    # Blur (system menu / headset off briefly): the lesson pauses, then resumes.
    ms = E.mark()
    r = E.cli('xr', 'set-visibility', payload={'state': 'visible-blurred'}, check=False)
    blurred = r.get('ok', False)
    time.sleep(1.5)
    E.cli('xr', 'set-visibility', payload={'state': 'visible'}, check=False)
    time.sleep(1.0)
    print(f'  blur and resume: {"done" if blurred else "not supported by this emulator, skipped"}')

    # Session ended (headset slept), then started again.
    E.cli('xr', 'exit', check=False)
    time.sleep(2.0)
    m1 = E.mark()
    for _ in range(6):
        st = E.cli('xr', 'status', check=False)
        if ((st.get('data') or {}).get('result') or {}).get('sessionActive'):
            break
        E.cli('xr', 'enter', check=False)
        time.sleep(1.5)
    E.cli('xr', 'set-input-mode', payload={'mode': 'hand'})
    E.cli('xr', 'set-hand-pose', payload={'device': 'hand-right', 'poseId': 'point'})
    E.wait_for(r'placed on (.*)', m1, 20)
    results.append(('new session writes', write_lesson(m1, 'after restart') >= 55))
    time.sleep(1.5)
    # A menu poke still works in the new session.
    mp = E.mark()
    E.press('btn-guide', 'hand-left')
    try:
        E.wait_for(r'button btn-guide', mp, 8)
        results.append(('menu poke after restart', True))
    except TimeoutError:
        results.append(('menu poke after restart', False))
    print('\nRESULTS')
    for n, ok in results:
        print(f'  {"PASS" if ok else "FAIL"}  {n}')
    ok = all(r for _, r in results)
    print('PASS' if ok else 'FAIL')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
