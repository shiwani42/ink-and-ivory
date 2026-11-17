#!/usr/bin/env python3
"""Shoot trailer footage in the IWSDK emulator (dev only).

Each shot: tools/trailer/recorder.mjs records 1920x1080 frames from the managed
browser (DevTools screencast) while this script drives the emulated head and
hands through the IWSDK CLI, and ffmpeg records the app's audio from the
PulseAudio sink "hoam_rec" (Chromium's output routed there). Then each shot is
encoded to artifacts/trailer/<name>.mp4 at a constant 30 fps with its audio.

    python3 tools/trailer/shoot.py            # every shot
    python3 tools/trailer/shoot.py 02 05      # shots whose name starts with these

Needs: the dev server headless with --allow-browser-automation, and the sink
`pactl load-module module-null-sink sink_name=hoam_rec` with Chromium's
streams moved to it.
"""
import json
import os
import signal
import subprocess
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import e2e as E  # noqa: E402  (CLI helpers: cli, wait_for, mark, hand_to, draw, play_song)

ROOT = E.ROOT
OUT = os.path.join(ROOT, 'artifacts', 'trailer')
FPS = 30
SEATED = {'pos': (0.0, 1.16, 0.02), 'look': (0.0, 0.66, -0.62)}


def events():
    try:
        with open(os.path.join(OUT, 'events.jsonl')) as f:
            return [json.loads(l) for l in f if l.strip()]
    except FileNotFoundError:
        return []


def console_logs(count=400):
    """[(timestamp_ms, message)] from the recorder's console capture (replaces the CLI log reader during a shot)."""
    try:
        with open(os.path.join(OUT, 'console.jsonl')) as f:
            lines = f.readlines()[-count:]
    except FileNotFoundError:
        return []
    out = []
    for l in lines:
        try:
            d = json.loads(l)
            out.append((int(d['t']), d['m']))
        except (ValueError, KeyError):
            pass
    return out


E.logs = console_logs


def head(pos, look, duration=0.0):
    if duration <= 0:
        E.cli('xr', 'set-transform', payload={'device': 'headset', 'position': dict(zip('xyz', pos))})
        E.cli('xr', 'look-at', payload={'device': 'headset', 'target': dict(zip('xyz', look))})
        return
    # A slow, steady camera move: small steps.
    start = head.last if hasattr(head, 'last') else (pos, look)
    steps = max(1, int(duration / 0.25))
    for k in range(1, steps + 1):
        t = k / steps
        e = t * t * (3 - 2 * t)
        p = tuple(a + (b - a) * e for a, b in zip(start[0], pos))
        l = tuple(a + (b - a) * e for a, b in zip(start[1], look))
        E.cli('xr', 'set-transform', payload={'device': 'headset', 'position': dict(zip('xyz', p))})
        E.cli('xr', 'look-at', payload={'device': 'headset', 'target': dict(zip('xyz', l))})
    head.last = (pos, look)


def push_to(centre, height=0.30, dist=0.30, duration=4.0, x=0.0):
    """A slow, human-paced push-in: end above-and-behind `centre`, looking down at it."""
    import math
    pos = {'x': centre[0] + x, 'y': centre[1] + height, 'z': centre[2] + dist}
    pitch = -math.degrees(math.atan2(height, dist))
    yaw = math.degrees(math.atan2(-x, dist)) if x else 0.0
    E.cli('xr', 'animate-to', payload={'device': 'headset', 'position': pos,
                                       'orientation': {'pitch': pitch, 'yaw': yaw, 'roll': 0},
                                       'duration': duration, 'easing': 'minimum-jerk'})


def paper_centre(m0):
    E.wait_for(r'^layout (.*)', m0, 25)
    time.sleep(0.5)
    lay = latest('layout', m0)
    seal = lay['seal']
    return lay, (seal[0] - 0.088, seal[1], seal[2] - 0.138)


def keys_centre(m0):
    m, _ = E.wait_for(r'^piano-layout (.*)', m0, 25)
    lay = json.loads(m.group(1))
    e4 = lay['keys']['E4']
    return lay, (e4[0] + 0.02, e4[1], e4[2] - 0.04)


def latest(prefix, since):
    """The JSON payload of the most recent '[hoam] <prefix> {...}' line logged after `since`."""
    found = None
    for ts, msg in console_logs(2000):
        if ts > since and msg.startswith(f'[hoam] {prefix} '):
            found = json.loads(msg[len(f'[hoam] {prefix} '):])
    return found


def hands_down():
    E.cli('xr', 'set-transform', payload={'device': 'hand-right', 'position': {'x': 0.22, 'y': 0.55, 'z': 0.25}})
    E.cli('xr', 'set-transform', payload={'device': 'hand-left', 'position': {'x': -0.22, 'y': 0.55, 'z': 0.25}})


def shoot(name, query, seconds, action):
    os.makedirs(OUT, exist_ok=True)
    for f in ('stop',):
        try:
            os.remove(os.path.join(OUT, f))
        except FileNotFoundError:
            pass
    with open(os.path.join(OUT, 'shot.json'), 'w') as f:
        json.dump({'name': name, 'query': query, 'seconds': seconds}, f)
    n_events = len(events())
    # Seat the head before the reload: the emulator restores this pose for the
    # new session, so the desk is placed in front of a seated viewer.
    head.last = (SEATED['pos'], SEATED['look'])
    head(SEATED['pos'], SEATED['look'])
    E.cli('xr', 'set-input-mode', payload={'mode': 'hand'})
    hands_down()
    wav = os.path.join(OUT, f'{name}.wav')
    audio_t0 = time.time()
    audio = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'pulse', '-i', 'hoam_rec.monitor', '-ac', '2', '-ar', '48000', wav],
                             stdin=subprocess.DEVNULL)
    rec = subprocess.Popen(['npx', 'iwsdk', 'browser', 'run', 'tools/trailer/recorder.mjs', '--timeout', '110000'],
                           cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    t_end = time.time() + 30
    while time.time() < t_end and not any(e.get('op') == 'ready' and e.get('name') == name for e in events()[n_events:]):
        time.sleep(0.1)
    m0 = E.mark() - 6000  # the reload's logs came just before "ready"
    # The emulator restored the seated position; aim the head (placement only uses its yaw).
    head(SEATED['pos'], SEATED['look'])
    hands_down()
    print(f'[{name}] recording: {query}')
    try:
        action(m0)
    finally:
        open(os.path.join(OUT, 'stop'), 'w').close()
        out, _ = rec.communicate(timeout=60)
        audio.send_signal(signal.SIGINT)
        audio.wait(timeout=10)
    with open(os.path.join(OUT, f'{name}.audio.json'), 'w') as f:
        json.dump({'t0': audio_t0}, f)
    encode(name)


def encode(name, trim_start=0.0):
    """Frames (variable rate, timestamped) to a 30 fps H.264 MP4 with the matching audio."""
    d = os.path.join(OUT, name)
    frames = json.load(open(os.path.join(d, 'frames.json')))
    if len(frames) < 10:
        print(f'[{name}] too few frames: {len(frames)}')
        return
    t_first = frames[0]['t']
    lines = ['ffconcat version 1.0']
    for a, b in zip(frames, frames[1:] + [None]):
        dur = (b['t'] - a['t']) if b else 1 / FPS
        lines.append(f"file '{a['file']}'")
        lines.append(f'duration {max(0.001, dur):.4f}')
    lines.append(f"file '{frames[-1]['file']}'")
    with open(os.path.join(d, 'list.ffconcat'), 'w') as f:
        f.write('\n'.join(lines) + '\n')
    audio_t0 = json.load(open(os.path.join(OUT, f'{name}.audio.json')))['t0']
    offset = max(0.0, t_first - audio_t0)  # audio started before the first frame
    mp4 = os.path.join(OUT, f'{name}.mp4')
    cmd = ['ffmpeg', '-loglevel', 'error', '-y',
           '-f', 'concat', '-safe', '0', '-i', os.path.join(d, 'list.ffconcat'),
           '-ss', f'{offset:.3f}', '-i', os.path.join(OUT, f'{name}.wav'),
           '-map', '0:v', '-map', '1:a?',
           '-vf', f'fps={FPS},format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
           '-c:a', 'aac', '-b:a', '192k', '-shortest', mp4]
    subprocess.run(cmd, check=True)
    span = frames[-1]['t'] - t_first
    gaps = sorted(b['t'] - a['t'] for a, b in zip(frames, frames[1:]))
    print(f'[{name}] {len(frames)} frames over {span:.1f} s ({len(frames) / span:.0f} fps captured; '
          f'longest gap {gaps[-1] * 1000:.0f} ms) -> {os.path.relpath(mp4, ROOT)}')


# ---------------------------------------------------------------- shots

def write_strokes(m0, jitter=0.0012):
    """Trace every stroke of the current lesson with the master, then let the seal land."""
    E.wait_for(r'^layout (.*)', m0, 20)
    E.wait_for(r'^practice$', m0, 60)
    lay = latest('layout', m0)
    E.cli('xr', 'set-hand-pose', payload={'device': 'hand-right', 'poseId': 'point'})
    for i, stroke in enumerate(lay['strokes']):
        ms = E.mark()
        E.draw(stroke['pts'], stroke['duration'], jitter, 'hand-right')
        E.wait_for(rf'stroke {i} scored', ms, 10)
        time.sleep(1.3)
    E.wait_for(r'lesson complete', m0, 10)
    E.cli('xr', 'set-transform', payload={'device': 'hand-right', 'position': {'x': 0.22, 'y': 0.55, 'z': 0.25}})
    time.sleep(4.5)


def calibrate(m0):
    E.wait_for(r'^layout (.*)', m0, 20)
    E.wait_for(r'^calibrate$', m0, 60)
    lay = latest('layout', m0)
    seal = lay['seal']
    E.cli('xr', 'set-hand-pose', payload={'device': 'hand-right', 'poseId': 'point'})
    E.hand_to((seal[0], seal[1] + 0.06, seal[2]), 0.8, 'hand-right')
    E.hand_to((seal[0], seal[1] + E.CONTACT, seal[2]), 0.5, 'hand-right')
    time.sleep(0.8)
    E.hand_to((seal[0], seal[1] + 0.07, seal[2]), 0.4, 'hand-right')


def s01(m0):
    # The paper lands on the table, the room dissolves into Kennin-ji, the master writes 永.
    _, c = paper_centre(m0)
    time.sleep(2.5)
    push_to(c, 0.34, 0.34, 5.0)
    E.wait_for(r'^calibrate$', m0, 60)
    time.sleep(1.5)


def s02(m0):
    _, c = paper_centre(m0)
    push_to(c, 0.30, 0.30, 2.5)
    write_strokes(m0)


def s03(m0):
    _, c = paper_centre(m0)
    time.sleep(2.0)
    push_to(c, 0.30, 0.30, 4.0)
    calibrate(m0)
    write_strokes(m0)


def s04(m0):
    _, c = paper_centre(m0)
    time.sleep(1.5)
    push_to(c, 0.28, 0.26, 6.0)
    E.wait_for(r'^calibrate$', m0, 60)
    time.sleep(1.5)


def piano_phrases(m0, phrases):
    E.cli('xr', 'set-hand-pose', payload={'device': 'hand-right', 'poseId': 'point'})
    for k in range(phrases):
        E.wait_for(r'^piano-layout (.*)', m0, 40)
        m2, _ = E.wait_for(r'^(practice|calibrate)$', m0, 60)
        lay = latest('piano-layout', m0)  # the song actually being taught (a preset can switch songs)
        if m2.group(1) == 'calibrate':
            # First time at the piano: touch the seal beside the keys once.
            seal = lay['seal']
            E.hand_to((seal[0], seal[1] + 0.06, seal[2]), 0.7, 'hand-right')
            E.hand_to((seal[0], seal[1] + E.CONTACT, seal[2]), 0.4, 'hand-right')
            time.sleep(0.8)
            E.hand_to((seal[0], seal[1] + 0.07, seal[2]), 0.3, 'hand-right')
            E.wait_for(r'^practice$', m0, 20)
        ms = E.mark()
        time.sleep(lay['beat'] * 4)  # the master counts four
        E.play_song(lay, 'hand-right')
        E.wait_for(r'^(phrase-done|lesson complete)', ms, 30)
        m0 = ms
    time.sleep(2.5)


def s05(m0):
    _, c = keys_centre(m0)
    time.sleep(2.0)
    push_to(c, 0.34, 0.36, 4.0)
    piano_phrases(m0, 2)


def s06(m0):
    _, c = keys_centre(m0)
    push_to(c, 0.34, 0.36, 3.0)
    E.wait_for(r'^listen$', m0, 40)
    # Key positions come from any piano layout line logged this session.
    keys = None
    for ts, msg in E.logs(400):
        if ts > m0 and msg.startswith('[hoam] piano-layout '):
            keys = json.loads(msg[len('[hoam] piano-layout '):])['keys']
    if keys is None:
        raise RuntimeError('no piano layout logged')
    E.cli('xr', 'set-hand-pose', payload={'device': 'hand-right', 'poseId': 'point'})
    tune = [['E4', 1], ['G4', 1], ['A4', 1], ['G4', 0.5], ['E4', 0.5], ['D4', 1], ['E4', 2]]
    ms = E.mark()
    E.play_song({'beat': 0.55, 'notes': tune, 'keys': keys}, 'hand-right')
    E.wait_for(r'^learned', ms, 20)
    E.cli('xr', 'set-transform', payload={'device': 'hand-right', 'position': {'x': 0.22, 'y': 0.55, 'z': 0.25}})
    E.wait_for(r'^(practice|calibrate)$', ms, 40)  # the master has played it back
    time.sleep(1.0)


SHOTS = [
    ('01-arrive-eternity', '?state=watch&lesson=6&scene=place', 60, s01),
    ('02-write-big', '?state=practice&lesson=5&scene=place', 60, s02),
    ('03-english-a', '?state=watch&lang=english&lesson=10&scene=place', 80, s03),
    ('04-english-love', '?state=watch&lang=english&lesson=31&scene=place', 50, s04),
    ('05-piano-phrases', '?state=watch&craft=piano&lesson=1&scene=place', 95, s05),
    ('06-your-tune', '?state=listen&scene=place', 70, s06),
]


if __name__ == '__main__':
    wanted = sys.argv[1:]
    for name, query, seconds, action in SHOTS:
        if wanted and not any(name.startswith(w) for w in wanted):
            continue
        shoot(name, query, seconds, action)
