#!/usr/bin/env python3
"""
Mixed-reality placement in rooms we never tuned for, in the IWSDK emulator.

1. Rooms: switches IWER's simulated room (tools/room.mjs) through its built-in
   rooms, sits the emulated learner at every table-height surface the room
   reports, and places the paper there (dev key Shift+P). The paper must land
   on that surface (height within 2 cm, centre inside the surface). A room with
   no Space Setup at all ("none") must give the virtual desk.
2. Remembered spot: places on a real table, starts a new XR session (IWSDK
   restores its persistent anchor), sits down again 25 cm to the side and
   turned, and asks for the first-placement logic again (Shift+M). The paper
   must come back to the old spot (under 1 cm), not to where detection would
   now put it.

Screenshots (from the learner's eyes): artifacts/room-*.png.
Prerequisites: npx iwsdk dev up --headless --open --allow-browser-automation
Usage: python3 tools/e2e_room.py [--rooms a,b,c]
"""
import argparse
import math
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e2e import ROOT, cli, logs, mark, press, wait_for  # noqa: E402

ROOMS = ['sunlit_living_room', 'home_office', 'kitchen', 'bedroom', 'conference_room', 'music_studio']
PLANE_RX = re.compile(r'plane horizontal label=(\S*) pos \[(\S+), (\S+), (\S+)\] up \[\S+, (\S+), \S+\] size (\S+) x (\S+)')


def shot(name):
    cli('browser', 'screenshot', '--output-file', f'artifacts/room-{name}.png', check=False)


def key(k):
    cli('browser', 'interact', payload={'steps': [
        {'action': 'keyDown', 'key': 'Shift'}, {'action': 'press', 'key': k}, {'action': 'keyUp', 'key': 'Shift'}]}, check=False)


def switch_room(name):
    with open(os.path.join(ROOT, 'artifacts', 'room-name.txt'), 'w') as f:
        f.write(name)
    r = cli('browser', 'run', 'tools/room.mjs')
    time.sleep(1.5)
    return r


def planes():
    m0 = mark()
    key('L')
    time.sleep(1.5)
    found = []
    for ts, msg in logs(200):
        if ts > m0 and msg.startswith('[hoam] plane horizontal'):
            m = PLANE_RX.search(msg)
            if m:
                label = m.group(1)
                x, y, z, up, w, d = (float(v) for v in m.groups()[1:])
                found.append({'label': label, 'pos': (x, y, z), 'up': up, 'w': w, 'd': d})
    return found


def seat_at(p, centre=(0.0, -0.5), side=0.0, turn=0.0):
    """Sit facing surface p: on the side toward the room centre, eyes 0.45 m above it."""
    x, y, z = p['pos']
    dx, dz = centre[0] - x, centre[1] - z
    n = math.hypot(dx, dz) or 1
    dx, dz = dx / n, dz / n
    reach = abs(dx) * p['w'] / 2 + abs(dz) * p['d'] / 2 + 0.25
    hx, hz = x + dx * reach, z + dz * reach
    # sideways offset (perpendicular), for the remembered-spot test
    hx += -dz * side
    hz += dx * side
    head = {'x': hx, 'y': y + 0.45, 'z': hz}
    cli('xr', 'set-transform', payload={'device': 'headset', 'position': head})
    # look at the surface, then turn by `turn` degrees
    ang = math.atan2(x - hx, z - hz) + math.radians(turn)
    cli('xr', 'look-at', payload={'device': 'headset', 'target': {'x': hx + math.sin(ang) * 0.45, 'y': y, 'z': hz + math.cos(ang) * 0.45}})
    return head


def place(k='P', timeout=12):
    m0 = mark()
    key(k)
    m, _ = wait_for(r'^placed on (.*?) \(', m0, timeout)
    how = m.group(1)
    c, _ = wait_for(r'paper centre \[(\S+), (\S+), (\S+)\]', m0, 8)
    return how, tuple(float(v) for v in c.groups()), m0


def on_surface(p, c):
    x, y, z = p['pos']
    half = math.hypot(p['w'], p['d']) / 2
    return abs(c[1] - y) < 0.02 and math.hypot(c[0] - x, c[2] - z) <= half + 0.01


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rooms', default=','.join(ROOMS))
    args = ap.parse_args()
    os.makedirs(os.path.join(ROOT, 'artifacts'), exist_ok=True)
    fails = []

    print('setup: reset, enter mixed reality, hands only')
    cli('xr', 'exit', check=False)
    cli('browser', 'reload')
    cli('runtime', 'wait')
    key('R')
    time.sleep(2)
    cli('runtime', 'wait')
    time.sleep(2)
    cli('xr', 'set-device-state', check=False)
    m0 = mark()
    cli('xr', 'exit', check=False)
    time.sleep(1.5)
    if not ((cli('xr', 'status', check=False).get('data') or {}).get('result') or {}).get('sessionActive'):
        cli('xr', 'enter')
    cli('xr', 'set-input-mode', payload={'mode': 'hand'})
    wait_for(r'placed on (.*)', m0, 15)
    time.sleep(1)
    # Stay in your own room (passthrough) so screenshots show the real surface.
    press('btn-scene')
    time.sleep(3)

    print('1. rooms')
    for room in args.rooms.split(','):
        switch_room(room)
        ps = [p for p in planes() if p['label'] not in ('floor', 'ceiling', 'couch', 'bed') and 0.35 <= p['pos'][1] <= 1.15 and p['up'] > 0.99]
        if not ps:
            print(f'  {room}: no table-height surface reported')
        for i, p in enumerate(ps):
            seat_at(p)
            time.sleep(0.4)
            try:
                how, c, _ = place()
            except TimeoutError as e:
                fails.append(f'{room} #{i}: {e}')
                print(f'  FAIL {room} #{i}: {e}')
                continue
            # On this surface, or on a neighbouring one at the same height that scored better
            # (an L-shaped kitchen counter seen from its corner).
            same = [q for q in ps if abs(q['pos'][1] - p['pos'][1]) < 0.02]
            ok = how in ('detected table', 'small table') and any(on_surface(q, c) for q in same)
            # tiny surfaces (< 20 cm a side) are refused on purpose: the virtual desk is right
            if min(p['w'], p['d']) < 0.2:
                ok = how == 'virtual desk'
            print(f"  {'ok  ' if ok else 'FAIL'} {room} #{i}: {p['label'] or '(none)'} {p['w']:.2f} x {p['d']:.2f} m at {p['pos'][1]:.2f} m -> {how}, paper [{c[0]:.2f}, {c[1]:.2f}, {c[2]:.2f}]")
            if not ok:
                fails.append(f'{room} #{i}')
            time.sleep(0.5)
            shot(f'{room}-{i}')

    print('2. no Space Setup at all')
    switch_room('none')
    cli('xr', 'set-transform', payload={'device': 'headset', 'position': {'x': 0, 'y': 1.2, 'z': 0}})
    cli('xr', 'look-at', payload={'device': 'headset', 'target': {'x': 0, 'y': 0.75, 'z': -0.45}})
    how, c, m1 = place(timeout=15)
    ok = how == 'virtual desk'
    print(f"  {'ok  ' if ok else 'FAIL'} no planes -> {how}")
    if not ok:
        fails.append('no planes')
    time.sleep(0.6)
    shot('none-virtual-desk')

    print('3. remembered spot across sessions (persistent anchor)')
    switch_room('sunlit_living_room')
    table = next((p for p in planes() if p['label'] == 'table' and p['pos'][1] > 0.6), None)
    if not table:
        fails.append('no dining table in sunlit_living_room')
    else:
        seat_at(table)
        time.sleep(0.4)
        how, first, m1 = place()
        wait_for(r'desk spot saved', m1, 8)
        print(f'  session 1: {how}, paper [{first[0]:.3f}, {first[1]:.3f}, {first[2]:.3f}], spot saved')
        m2 = mark()
        cli('xr', 'exit', check=False)
        time.sleep(1.5)
        if not ((cli('xr', 'status', check=False).get('data') or {}).get('result') or {}).get('sessionActive'):
            cli('xr', 'enter')
        cli('xr', 'set-input-mode', payload={'mode': 'hand'})
        m, _ = wait_for(r'placed on (.*?) \(', m2, 15)
        c, _ = wait_for(r'paper centre \[(\S+), (\S+), (\S+)\]', m2, 8)
        start = tuple(float(v) for v in c.groups())
        print(f'  session 2 first placement (wherever the emulator put the head): {m.group(1)}, {math.dist(first, start) * 100:.2f} cm from the first spot')
        # First the session-start logic (Shift+M), then plain detection (Shift+P), which
        # re-saves the spot: the newest placement on a real table is the one remembered.
        seat_at(table, side=0.25, turn=25)
        time.sleep(0.4)
        how_m, back, _ = place('M')
        time.sleep(0.8)
        shot('remembered-spot')
        seat_at(table, side=0.25, turn=25)
        time.sleep(0.4)
        how_d, detect, _ = place('P')
        moved = math.dist(first, back)
        detect_moved = math.dist(first, detect)
        ok = how_m == 'remembered spot' and moved < 0.01 and detect_moved > 0.03
        print(f"  {'ok  ' if ok else 'FAIL'} session 2, seated 25 cm aside and turned 25 deg: detection alone -> {detect_moved * 100:.1f} cm away; remembered -> {moved * 100:.2f} cm from the first spot ({how_m})")
        if not ok:
            fails.append('remembered spot')

    print()
    print('FAIL ' + '; '.join(fails) if fails else 'PASS')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
