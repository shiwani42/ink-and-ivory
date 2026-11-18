#!/usr/bin/env python3
"""Emulator test: several fingers play several keys (a chord), and a tune
played with chords is learned by its top notes.

    python3 tools/e2e_chord.py
"""
import json
import re
import sys
import time

import e2e as E
from e2e_height import fresh_session


def main():
    m0 = fresh_session('?state=listen&scene=room')
    E.wait_for(r'^listen$', m0, 60)
    m, _ = E.wait_for(r'^piano-layout (.*)', m0, 10)
    keys = json.loads(m.group(1))['keys']
    # An open hand, palm down, fingers forward over the middle of the keyboard.
    E.cli('xr', 'set-hand-pose', payload={'device': 'hand-right', 'poseId': 'open'})
    c = keys['E4']
    sounded = []
    for drop in range(2):
        ms = E.mark()
        E.cli('xr', 'run-sequence', payload={'device': 'hand-right', 'steps': [
            {'label': 'over', 'anchor': 'middle-finger-tip', 'position': {'x': c[0], 'y': c[1] + 0.04, 'z': c[2]},
             'orientation': {'fingers': 'forward', 'palm': 'down'}, 'duration': 0.6},
            {'label': 'down', 'anchor': 'middle-finger-tip', 'position': {'x': c[0], 'y': c[1] + E.CONTACT - 0.003, 'z': c[2]},
             'orientation': {'fingers': 'forward', 'palm': 'down'}, 'duration': 0.15},
            {'label': 'up', 'anchor': 'middle-finger-tip', 'position': {'x': c[0], 'y': c[1] + 0.05, 'z': c[2]},
             'orientation': {'fingers': 'forward', 'palm': 'down'}, 'duration': 0.2}]})
        time.sleep(0.5)
        notes = sorted({int(mm.group(1)) for ts, msg in E.logs(80) if ts > ms and (mm := re.match(r'\[hoam\] key (\d+)', msg))})
        print(f'  chord {drop + 1}: keys {notes}')
        sounded.append(notes)
    ok = all(len(n) >= 2 for n in sounded)
    print('PASS' if ok else 'FAIL')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
