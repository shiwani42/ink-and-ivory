#!/usr/bin/env python3
"""
Emulator test for the hand-input features (IWER, hands only):

  1. hands out of view while waiting to write  -> the "Bring your hands back" card
  2. tracking lost mid-stroke                  -> the stroke is called off, not scored
  3. a fingertip near a menu button            -> poke hover (button lights, cursor ring)
  4. thumbs up held on the completion screen   -> "Next lesson"
  5. microgesture swipes                       -> unit paging (IWSDK's gamepad mapping)
  6. hands lost while playing the piano        -> the song pauses, the card shows

Screenshots (player's view) go to artifacts/hands-*.png.
Prerequisites: the dev server is running (see tools/e2e.py).
Usage: python3 tools/e2e_hands.py
"""
import json
import os
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e2e import CONTACT, ROOT, cli, draw, hand_to, logs, look_at_paper, mark, press, wait_for  # noqa: E402


def shot(name):
    cli('browser', 'screenshot', '--output-file', f'artifacts/hands-{name}.png', check=False)


def pick_ring_frame():
    """Keep the burst frame showing the most of the gold hold ring as hands-4-thumbs-up-hold.png."""
    try:
        from PIL import Image
    except ImportError:
        return
    best, best_n = None, 0
    for i in range(32):
        path = os.path.join(ROOT, 'artifacts', f'hands-4-thumbs-up-burst-{i}.png')
        if not os.path.exists(path):
            break
        im = Image.open(path).convert('RGB')
        n = sum(1 for r, g, b in im.getdata() if r > 190 and 140 < g < 185 and b < 70)  # the ring's gold
        if n > best_n:
            best, best_n = im, n
    if best is not None:
        best.save(os.path.join(ROOT, 'artifacts', 'hands-4-thumbs-up-hold.png'))
        print(f'       hold ring frame: {best_n} gold pixels')


def connect(on, devices=('hand-left', 'hand-right')):
    for d in devices:
        cli('xr', 'set-connected', payload={'device': d, 'connected': on})


def check(results, name, fn):
    try:
        detail = fn()
        print(f'  ok   {name}' + (f': {detail}' if detail else ''))
        results.append((name, True))
    except TimeoutError as e:
        print(f'  FAIL {name}: {e}')
        for _, msg in logs(150)[-25:]:
            if msg.startswith('[hoam]') and 'ghost' not in msg and 'render calls' not in msg:
                print('       ', msg[:150])
        results.append((name, False))


def main():
    os.makedirs(os.path.join(ROOT, 'artifacts'), exist_ok=True)
    results = []
    writer, other = 'hand-right', 'hand-left'

    print('setup: reset, enter mixed reality, calibrate')
    cli('xr', 'exit', check=False)
    cli('browser', 'reload')
    cli('runtime', 'wait')
    cli('browser', 'interact', payload={'steps': [
        {'action': 'keyDown', 'key': 'Shift'}, {'action': 'press', 'key': 'R'}, {'action': 'keyUp', 'key': 'Shift'}]}, check=False)
    time.sleep(2)
    cli('runtime', 'wait')
    time.sleep(2)
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
    m, _ = wait_for(r'^layout (.*)', m0, 15)
    layout = json.loads(m.group(1))
    wait_for(r'^calibrate$', m0, 30)
    seal = layout['seal']
    hand_to((seal[0], seal[1] + 0.05, seal[2]), 0.6, writer)
    hand_to((seal[0], seal[1] + CONTACT, seal[2]), 0.4, writer)
    time.sleep(0.6)
    wait_for(r'calibrated offset', m0, 6)
    hand_to((seal[0], seal[1] + 0.08, seal[2]), 0.3, writer)
    wait_for(r'^practice$', m0, 40)
    look_at_paper(layout)

    # 1. Both hands leave tracking while the master waits.
    def hands_out():
        ms = mark()
        connect(False)
        m, _ = wait_for(r'^hands lost: hint shown \((\w+)\)', ms, 6)
        time.sleep(0.6)
        shot('1-hands-out-of-view')
        # Look away from the desk: the body-locked card follows the gaze.
        c = layout['seal']
        cli('xr', 'look-at', payload={'device': 'headset', 'target': {'x': c[0] + 0.9, 'y': c[1] + 0.35, 'z': c[2] - 0.6}})
        time.sleep(2.0)
        shot('1b-hands-out-looking-away')
        look_at_paper(layout)
        connect(True)
        cli('xr', 'set-hand-pose', payload={'device': writer, 'poseId': 'point'})
        hand_to((seal[0], seal[1] + 0.08, seal[2]), 0.2, writer)
        wait_for(r'^hands back$', ms, 6)
        return f'card shown in {m.group(1)}, hidden on return'
    check(results, 'hands out of view card', hands_out)

    # 2. Tracking drops halfway through a stroke.
    stroke = layout['strokes'][0]
    pts = stroke['pts']

    def mid_stroke():
        y = pts[0][1] + CONTACT
        hand_to((pts[0][0], y + 0.06, pts[0][2]), 0.4, writer)
        hand_to((pts[0][0], y, pts[0][2]), 0.2, writer)
        half = pts[: len(pts) // 2 + 1]
        steps = [{'label': f'p{i}', 'anchor': 'index-tip', 'position': {'x': p[0], 'y': y, 'z': p[2]},
                  'duration': stroke['duration'] / len(pts)} for i, p in enumerate(half[1:])]
        ms = mark()
        cli('xr', 'run-sequence', payload={'device': writer, 'steps': steps})
        connect(False, (writer,))
        m, _ = wait_for(r'^stroke 0 cancelled: tracking lost', ms, 4)
        time.sleep(0.3)
        shot('2-stroke-cancelled')
        connect(True, (writer,))
        cli('xr', 'set-hand-pose', payload={'device': writer, 'poseId': 'point'})
        hand_to((pts[0][0], y + 0.08, pts[0][2]), 0.3, writer)
        try:
            wait_for(r'^stroke 0 scored', ms, 1.5)
        except TimeoutError:
            return 'not scored'
        raise TimeoutError('the cut-off stroke was scored')
    check(results, 'tracking lost mid-stroke', mid_stroke)

    # Finish the lesson normally (proves the flow resumes).
    for i, s in enumerate(layout['strokes']):
        ms = mark()
        time.sleep(1.6)
        draw(s['pts'], s['duration'], 0.002, writer)
        m, _ = wait_for(rf'stroke {i} scored (\d+) (.*)', ms, 8)
        print(f'       stroke {i + 1}: {m.group(1)} {m.group(2)}')
    wait_for(r'lesson complete', m0, 8)
    time.sleep(1.0)

    # 3. A fingertip hovering near "Next lesson" lights it before the press.
    def hover():
        ms = mark()
        cli('xr', 'run-sequence', payload={'device': other, 'steps': [
            {'label': 'near', 'target': 'btn-next', 'anchor': 'index-tip', 'offset': {'normal': 0.03}, 'duration': 0.5}]})
        m, _ = wait_for(r'^poke hover (btn-next)', ms, 4)
        st = cli('xr', 'get-hand-state', payload={'device': other}, check=False)
        res = ((st.get('data') or {}).get('result') or {})
        anchors = res.get('anchors') or {}
        tip = next((v for k, v in anchors.items() if 'index' in k.lower()), None) if isinstance(anchors, dict) else None
        if not tip:
            print('       (hand anchors:', str(anchors)[:200], ')')
        else:
            hp = tip.get('position') or tip
            # Stand where a seated learner's eyes are, looking at the fingertip.
            cli('xr', 'set-transform', payload={'device': 'headset', 'position': {
                'x': hp['x'] + 0.06, 'y': hp['y'] + 0.1, 'z': hp['z'] + 0.22}})
            cli('xr', 'look-at', payload={'device': 'headset', 'target': {'x': hp['x'], 'y': hp['y'], 'z': hp['z']}})
        time.sleep(0.5)
        shot('3-poke-hover')
        # Withdraw straight back from the button first (a hand dropping to the
        # lap can sweep through the tilted menu and press something).
        ms2 = mark()
        cli('xr', 'run-sequence', payload={'device': other, 'steps': [
            {'label': 'back', 'depart': {'distance': 0.15}, 'anchor': 'index-tip', 'duration': 0.3},
            {'label': 'rest', 'anchor': 'index-tip', 'position': {'relativeTo': 'head', 'x': -0.35, 'y': -0.3, 'z': 0.1}, 'duration': 0.3}]})
        try:
            wait_for(r'^button ', ms2, 1.0)
            raise TimeoutError('withdrawing the hand pressed a button')
        except TimeoutError as e:
            if 'withdrawing' in str(e):
                raise
        return m.group(1)
    check(results, 'poke hover feedback', hover)

    # 4. Thumbs up, held, on the completion screen = Next lesson.
    def thumbs():
        look_at_paper(layout)
        ms = mark()
        # Capture mid-hold: a burst of page screenshots runs alongside the move
        # (a `browser screenshot` takes about 3 s; the hold is 0.6 s).
        with open(os.path.join(ROOT, 'artifacts', 'snap.json'), 'w') as f:
            json.dump({'name': 'hands-4-thumbs-up-burst', 'times': [round(0.15 * i, 2) for i in range(16)]}, f)
        snap = threading.Thread(target=lambda: cli('browser', 'run', 'tools/snap.mjs', check=False))
        snap.start()
        time.sleep(2.2)  # `browser run` takes about 2.5 s to start its script
        cli('xr', 'run-sequence', payload={'device': writer, 'steps': [
            {'label': 'raise', 'position': {'relativeTo': 'head', 'x': 0.08, 'y': -0.24, 'z': -0.3}, 'anchor': 'wrist',
             'orientation': {'fingers': 'forward', 'thumb': 'up'}, 'poseId': 'thumbs-up', 'duration': 0.25}]})
        snap.join()
        pick_ring_frame()
        m, _ = wait_for(r'^gesture thumbs-up: next', ms, 4)
        m, _ = wait_for(r'^layout (.*)', ms, 8)
        nxt = json.loads(m.group(1))['lesson']
        cli('xr', 'set-hand-pose', payload={'device': writer, 'poseId': 'point'})
        hand_to((seal[0], seal[1] + 0.08, seal[2]), 0.3, writer)
        return f'next lesson {nxt}'
    check(results, 'thumbs up = next lesson', thumbs)

    # A thumbs up while writing (no Next lesson offered) must do nothing.
    def thumbs_ignored():
        ms = mark()
        cli('xr', 'run-sequence', payload={'device': other, 'steps': [
            {'label': 'raise', 'position': {'relativeTo': 'head', 'x': -0.1, 'y': -0.22, 'z': -0.38}, 'anchor': 'wrist',
             'orientation': {'fingers': 'forward', 'thumb': 'up'}, 'poseId': 'thumbs-up', 'duration': 0.25},
            {'label': 'hold', 'duration': 1.2}]})
        try:
            wait_for(r'^gesture thumbs-up', ms, 1.0)
        except TimeoutError:
            cli('xr', 'set-hand-pose', payload={'device': other, 'poseId': 'default'})
            press('btn-unit-next', other)  # leave the left hand resting
            press('btn-unit-prev', other)
            return 'no action'
        raise TimeoutError('thumbs up fired while writing')
    check(results, 'thumbs up ignored mid-lesson', thumbs_ignored)

    # 5. Microgestures: swipes page the units (optional shortcut).
    def micro():
        ms = mark()
        cli('xr', 'run-sequence', payload={'device': writer, 'steps': [
            {'label': 'side-on', 'position': {'relativeTo': 'head', 'x': 0.12, 'y': -0.2, 'z': -0.35}, 'anchor': 'wrist',
             'orientation': {'fingers': [0, -0.6, -0.8], 'palm': 'left'}, 'duration': 0.25}]})
        cli('xr', 'microgesture', payload={'device': writer, 'gesture': 'swipe-right'})
        m, _ = wait_for(r'^microgesture swipe-right: (\S+)', ms, 4)
        time.sleep(0.8)
        cli('xr', 'microgesture', payload={'device': writer, 'gesture': 'swipe-left'})
        wait_for(r'^microgesture swipe-left: (\S+)', ms, 4)
        cli('xr', 'set-hand-pose', payload={'device': writer, 'poseId': 'point'})
        return m.group(1)
    check(results, 'microgesture swipes page units', micro)

    # 6. Piano: hands lost while playing -> the song pauses with a card.
    def piano_pause():
        ms = mark()
        press('craft-piano', other)
        m, _ = wait_for(r'^piano-layout (.*)', ms, 20)
        lay = json.loads(m.group(1))
        look_at_paper(lay)
        wait_for(r'^practice$', ms, 60)
        mp = mark()
        connect(False)
        m, _ = wait_for(r'^hands lost: hint shown \((\w+)\)', mp, 4)
        time.sleep(0.5)
        shot('6-piano-paused')
        connect(True)
        wait_for(r'^hands back$', mp, 4)
        return f'paused in {m.group(1)}'
    check(results, 'piano pauses when hands are lost', piano_pause)

    print('\nRESULTS')
    for name, ok in results:
        print(f'  {"PASS" if ok else "FAIL"}  {name}')
    ok = all(r for _, r in results)
    print('PASS' if ok else 'FAIL')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
