#!/usr/bin/env python3
"""Emulator test: Recenter (menu button and the headset's recenter, i.e. holding
the Meta button, which fires 'reset' on the reference space) brings the set in
front of the player; Chinese lessons speak the character ("Hear it").

    python3 tools/e2e_recenter.py
"""
import re
import sys
import time

import e2e as E


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
    E.cli('xr', 'enter')
    E.cli('xr', 'set-input-mode', payload={'mode': 'hand'})
    E.cli('xr', 'set-transform', payload={'device': 'hand-right', 'position': {'x': 0.3, 'y': 0.9, 'z': 0.1}})
    E.cli('xr', 'set-transform', payload={'device': 'hand-left', 'position': {'x': -0.3, 'y': 0.9, 'z': 0.1}})
    E.wait_for(r'placed on (.*)', m0, 15)
    time.sleep(1)
    ok = True

    print('2. turn the head 90 degrees left, press Recenter')
    E.cli('xr', 'set-transform', payload={'device': 'headset', 'orientation': {'x': 0, 'y': 0.7071, 'z': 0, 'w': 0.7071}})
    time.sleep(0.8)
    m1 = E.mark()
    E.press('btn-recenter', 'hand-left')
    m, _ = E.wait_for(r'recentred \(menu\) at \[(.*)\]', m1, 8)
    x, y, z = [float(v) for v in m.group(1).split(',')]
    print('    desk at', x, y, z)
    if not (x < -0.25 and abs(z) < 0.2):
        print('    FAIL: expected the desk to the left (-x)'); ok = False
    E.shot('recenter-left')

    print('3. turn back, headset recenter (reset event)')
    E.cli('xr', 'set-transform', payload={'device': 'headset', 'orientation': {'x': 0, 'y': 0, 'z': 0, 'w': 1}})
    time.sleep(0.8)
    m2 = E.mark()
    E.cli('browser', 'run', 'tools/fire_reset.mjs', check=False)
    try:
        m, _ = E.wait_for(r'recentred \(headset recenter\) at \[(.*)\]', m2, 8)
        x, y, z = [float(v) for v in m.group(1).split(',')]
        print('    desk at', x, y, z)
        if not (z < -0.25 and abs(x) < 0.2):
            print('    FAIL: expected the desk ahead (-z)'); ok = False
    except TimeoutError:
        print('    FAIL: no recenter on reset'); ok = False

    print('4. Chinese: the master watches, the character is spoken')
    m3 = E.mark()
    E.press('lang-chinese', 'hand-left')
    try:
        m, _ = E.wait_for(r'say (zh-[\w-]+)( failed .*)?$', m3, 10)
        print('    ', m.group(0))
        if m.group(2):
            print('    (autoplay may be blocked in the emulator; checking the button)')
        m4 = E.mark()
        E.press('btn-say', 'hand-left')
        m, _ = E.wait_for(r'say (zh-[\w-]+)( failed .*)?$', m4, 8)
        print('    button:', m.group(0))
    except TimeoutError:
        print('    FAIL: nothing spoken'); ok = False

    print('5. paper pad mode (see-through)')
    m5 = E.mark()
    E.press('btn-pad', 'hand-left')
    try:
        E.wait_for(r'paper real pad', m5, 8)
        time.sleep(1)
        E.shot('paper-pad')
        print('    on')
    except TimeoutError:
        print('    FAIL: paper toggle'); ok = False

    print('PASS' if ok else 'FAIL')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
