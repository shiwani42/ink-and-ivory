#!/usr/bin/env python3
"""Cut the shot clips (tools/trailer/shoot.py) into the trailer.

    python3 tools/trailer/assemble.py   ->  artifacts/trailer/hands-of-a-master-trailer.mp4

1920x1080, 30 fps, H.264 + AAC. Title and end cards are drawn with ffmpeg;
captions are short lower thirds. Every segment fades in and out over 0.3 s.
"""
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'artifacts', 'trailer')
SERIF = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'
SANS = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
SANS_BOLD = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
INK = '0x1d1813'
PAPER = '0xf4ede0'
VERMILION = '0xc4482c'
ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
       '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2']

# (clip, start s, end s, caption, crop the menu out?)
SEGMENTS = [
    ('01-arrive-eternity', 0.0, 14.5, 'Your real desk. A master\'s hand writes beside yours.', False),
    ('02-write-big', 2.5, 30.0, 'Follow the master. Stay in step and your ink turns gold.', False),
    ('03-english-a', 5.0, 9.5, 'English italic, with a broad-edge pen.', False),
    ('03-english-a', 11.5, 31.5, 'Downstrokes swell, hairlines thin, like a real nib.', False),
    ('04-english-love', 6.0, 14.0, 'Letters, then words. About 160 lessons in three scripts.', False),
    ('05-piano-phrases', 3.0, 42.0, 'Piano: the master plays a phrase. You echo it, on the beat.', True),
    ('06-your-tune', 4.0, 22.5, 'Play your own tune. The master learns it and teaches it back.', True),
]


def textfile(name, text):
    p = os.path.join(OUT, 'txt', name)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w') as f:
        f.write(text)
    return p.replace(':', r'\:')


def card(name, seconds, lines):
    """A paper-coloured card. lines: [(text, font, size, colour, y)]."""
    draws = []
    for k, (text, font, size, colour, y) in enumerate(lines):
        tf = textfile(f'{name}-{k}.txt', text)
        alpha = f"if(lt(t,0.4),t/0.4,if(gt(t,{seconds - 0.4}),({seconds}-t)/0.4,1))"
        draws.append(f"drawtext=fontfile={font}:textfile='{tf}':fontsize={size}:fontcolor={colour}:x=(w-text_w)/2:y={y}:alpha='{alpha}'")
    out = os.path.join(OUT, f'seg-{name}.mp4')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y',
                    '-f', 'lavfi', '-i', f'color=c={PAPER}:s=1920x1080:d={seconds}:r=30',
                    '-f', 'lavfi', '-i', f'anullsrc=r=48000:cl=stereo:d={seconds}',
                    '-vf', ','.join(draws), '-shortest', *ENC, out], check=True)
    return out


def segment(k, clip, start, end, caption, crop):
    dur = end - start
    tf = textfile(f'cap-{k}.txt', caption)
    cap_alpha = f"if(lt(t,0.6),0,if(lt(t,1.1),(t-0.6)/0.5,if(gt(t,{dur - 0.8}),max(0,({dur - 0.3}-t)/0.5),1)))"
    vf = []
    if crop:
        vf.append('crop=1500:844:420:96,scale=1920:1080:flags=lanczos')
    vf += [
        f'fade=t=in:st=0:d=0.3,fade=t=out:st={dur - 0.3:.2f}:d=0.3',
        # Lower third: a soft ink band with the caption.
        f"drawbox=x=0:y=ih-150:w=iw:h=150:color=black@0.42:t=fill",
        f"drawtext=fontfile={SANS_BOLD}:textfile='{tf}':fontsize=44:fontcolor=white:x=(w-text_w)/2:y=h-102:alpha='{cap_alpha}'",
    ]
    out = os.path.join(OUT, f'seg-{k:02d}.mp4')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{start:.2f}', '-to', f'{end:.2f}',
                    '-i', os.path.join(OUT, f'{clip}.mp4'),
                    '-vf', ','.join(vf),
                    '-af', f'afade=t=in:st=0:d=0.3,afade=t=out:st={dur - 0.3:.2f}:d=0.3',
                    *ENC, out], check=True)
    return out


def main():
    parts = [card('title', 4.5, [
        ('永', SERIF, 150, VERMILION, 300),
        ('Ink and Ivory', SERIF, 96, INK, 500),
        ("Learn a craft inside a master's hands.", SANS, 46, '0x5e5246', 640),
    ])]
    for k, seg in enumerate(SEGMENTS):
        parts.append(segment(k, *seg))
    parts.append(card('end', 6.0, [
        ('Hands only. Your real desk. The master lets go.', SERIF, 60, INK, 380),
        ('Calligraphy in Japanese, Chinese and English  ·  Piano', SANS, 40, '0x5e5246', 500),
        ('hands-of-a-master.vercel.app', SANS_BOLD, 50, VERMILION, 610),
        ('Meta Quest 3 / 3S, in the browser. Footage recorded in the Meta Quest 3 emulator (IWSDK).', SANS, 28, '0x85776a', 760),
    ]))
    lst = os.path.join(OUT, 'parts.txt')
    with open(lst, 'w') as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    final = os.path.join(OUT, 'hands-of-a-master-trailer.mp4')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst,
                    '-c', 'copy', '-movflags', '+faststart', final], check=True)
    dur = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', final],
                         capture_output=True, text=True).stdout.strip()
    print(f'{os.path.relpath(final, ROOT)}: {float(dur):.1f} s')


if __name__ == '__main__':
    main()
