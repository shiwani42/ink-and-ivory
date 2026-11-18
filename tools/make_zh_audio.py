#!/usr/bin/env python3
"""Generate pronunciation clips for the lessons (Mandarin, Japanese, English).

Reads ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID from the environment
(load .env.local first: `set -a; . ./.env.local; set +a`), extracts the
lesson items from src/lessons/lessons.ts and writes one MP3 per lesson to
public/audio/<lang>/<lesson id>.mp3, plus public/audio/<lang>/index.json.

Resumable: existing clips are skipped. Python stdlib only.

  python3 tools/make_zh_audio.py                    # Mandarin (default)
  python3 tools/make_zh_audio.py --lang ja          # Japanese (kanji + hiragana)
  python3 tools/make_zh_audio.py --lang en          # English italic letters + words
  python3 tools/make_zh_audio.py --lang zh --force   # overwrite every clip
  python3 tools/make_zh_audio.py --lang zh --model eleven_flash_v2_5
  python3 tools/make_zh_audio.py --lang zh --stop zh-one zh-two
      # regenerate these ids with a sentence-final mark (。 or .) appended
      # (--stop must come last)
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LESSONS = os.path.join(ROOT, 'src', 'lessons', 'lessons.ts')
# Turbo/flash v2.5 enforce language_code; multilingual_v2 ignores it and
# reads lone kanji as Japanese. Override with --model.
MODELS = ['eleven_turbo_v2_5', 'eleven_flash_v2_5']
STOP = {'zh': '。', 'ja': '。', 'en': '.'}

# Kana for the Japanese reading each kanji lesson teaches (the romaji `ja`
# field in lessons.ts), keyed by lesson id. Long vowels written out.
JA_KANA = {
    'one': 'いち', 'two': 'に', 'ten': 'じゅう', 'person': 'ひと', 'big': 'だい',
    'eternity': 'えい', 'three': 'さん', 'four': 'よん', 'five': 'ご', 'six': 'ろく',
    'seven': 'なな', 'eight': 'はち', 'nine': 'きゅう', 'hundred': 'ひゃく',
    'thousand': 'せん', 'sun': 'ひ', 'moon': 'つき', 'mountain': 'やま', 'river': 'かわ',
    'tree': 'き', 'water': 'みず', 'fire': 'ひ', 'earth': 'つち', 'stone': 'いし',
    'child': 'こ', 'woman': 'おんな', 'man': 'おとこ', 'mouth': 'くち', 'eye': 'め',
    'hand': 'て', 'ear': 'みみ', 'heart': 'こころ', 'strength': 'ちから', 'up': 'うえ',
    'down': 'した', 'middle': 'なか', 'small': 'ちい', 'left': 'ひだり', 'right': 'みぎ',
    'king': 'おう', 'field': 'た', 'book': 'ほん', 'sky': 'てん', 'rain': 'あめ',
    'empty-sky': 'そら', 'flower': 'はな', 'bamboo': 'たけ', 'grove': 'はやし',
    'forest': 'もり', 'spring': 'はる',
}


def cjk_rows(src, name):
    body = re.search(r'const %s: CjkRow\[\] = \[(.*?)\n\];' % name, src, re.S).group(1)
    return re.findall(r"\[\s*'([^']+)',\s*'([^']+)'", body)


def items_for(lang):
    """[(lesson id, text to speak)] in course order, as lessons.ts builds them."""
    src = open(LESSONS, encoding='utf-8').read()
    out = []
    if lang == 'zh':
        block = re.search(r'const ZH = course\(\[(.*?)\]\);', src, re.S).group(1)
        for name in re.findall(r"cjk\((\w+), 'chinese'\)", block):
            out += [('zh-' + i, g) for i, g in cjk_rows(src, name)]
    elif lang == 'ja':
        block = re.search(r'const JA = course\(\[(.*?)\]\);', src, re.S).group(1)
        kana_body = re.search(r'const KANA: .*? = \[(.*?)\n\];', src, re.S).group(1)
        kana_groups = [re.findall(r"\['([^']+)', '([^']+)'", g)
                       for g in re.split(r'\n  \],?', kana_body) if "['" in g]
        for m in re.finditer(r"cjk\((\w+), 'japanese'\)|kana\(KANA\[(\d+)\]\)", block):
            if m.group(1):
                out += [(i, JA_KANA.get(i, g)) for i, g in cjk_rows(src, m.group(1))]
            else:
                out += [('kana-' + r, g) for r, g in kana_groups[int(m.group(2))]]
    elif lang == 'en':
        latin = re.search(r'const LATIN: .*? = \[(.*?)\n\];', src, re.S).group(1)
        # Letter name: capital plus a full stop, so "a" is not read as the article.
        out += [('en-' + l, l.upper() + '.') for l in re.findall(r"^\s+(\w): '", latin, re.M)]
        words = re.search(r'const WORDS: .*? = \[(.*?)\n\];', src, re.S).group(1)
        out += [('en-word-' + w, w) for w in re.findall(r"\['(\w+)',", words)]
    else:
        sys.exit('unknown --lang %s (zh, ja, en)' % lang)
    seen, uniq = set(), []
    for lid, text in out:
        if lid not in seen:
            seen.add(lid)
            uniq.append((lid, text))
    return uniq


def tts(key, voice, text, lang, model):
    url = 'https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=mp3_44100_64' % voice
    body = {'text': text, 'model_id': model}
    if lang:
        body['language_code'] = lang
    req = urllib.request.Request(
        url, data=json.dumps(body).encode('utf-8'), method='POST',
        headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main():
    key = os.environ.get('ELEVENLABS_API_KEY')
    voice = os.environ.get('ELEVENLABS_VOICE_ID')
    if not key or not voice:
        sys.exit('ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID not set (source .env.local)')
    args = sys.argv[1:]
    lang = args[args.index('--lang') + 1] if '--lang' in args else 'zh'
    force_stop = set(args[args.index('--stop') + 1:]) if '--stop' in args else set()
    force = '--force' in args
    models = [args[args.index('--model') + 1]] if '--model' in args else list(MODELS)
    out_dir = os.path.join(ROOT, 'public', 'audio', lang)
    os.makedirs(out_dir, exist_ok=True)
    items = items_for(lang)
    print('%d %s lesson items, model %s' % (len(items), lang, models[0]))
    use_lang = True
    failed = []
    for lid, text in items:
        path = os.path.join(out_dir, lid + '.mp3')
        if os.path.exists(path) and not force and lid not in force_stop:
            continue
        if lid in force_stop and not text.endswith(STOP[lang]):
            text += STOP[lang]
        data = None
        for attempt in range(4):
            try:
                data = tts(key, voice, text, lang if use_lang else None, models[0])
                break
            except urllib.error.HTTPError as e:
                detail = e.read().decode('utf-8', 'replace')[:300]
                if e.code in (400, 404, 422) and len(models) > 1 and 'model' in detail.lower():
                    print('model %s rejected (HTTP %d); falling back to %s' % (models[0], e.code, models[1]))
                    models.pop(0)
                    continue
                if e.code in (400, 422) and use_lang and 'language' in detail.lower():
                    print('language_code rejected; dropping it')
                    use_lang = False
                    continue
                if (e.code == 429 or e.code >= 500) and attempt == 0:
                    time.sleep(5)
                    continue
                print('FAIL %s %s: HTTP %d %s' % (lid, text, e.code, detail))
                break
            except Exception as e:  # network error
                if attempt == 0:
                    time.sleep(5)
                    continue
                print('FAIL %s %s: %s' % (lid, text, e))
                break
        if not data:
            failed.append(lid)
            continue
        with open(path, 'wb') as f:
            f.write(data)
        print('ok %s %s (%d bytes)' % (lid, text, len(data)))
        time.sleep(0.3)
    index = {lid: lid + '.mp3' for lid, _ in items if os.path.exists(os.path.join(out_dir, lid + '.mp3'))}
    with open(os.path.join(out_dir, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('%d clips in index.json; model %s; failed: %s' % (len(index), models[0], failed or 'none'))


if __name__ == '__main__':
    main()
