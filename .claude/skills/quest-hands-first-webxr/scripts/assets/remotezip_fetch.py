"""Fetch selected zip members with one ranged GET per member (parallel), decompress locally.
Keep remotezip.py in the same folder. Files that already exist are skipped (delete 0-byte leftovers first).
    python remotezip_fetch.py <zip_url> <out_dir> <glob> [glob ...]"""
import io, sys, zipfile, zlib, struct, urllib.request, fnmatch, os, time, concurrent.futures as cf
from remotezip import RemoteFile  # same folder

def get(url, a, b, tries=12):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={'Range': f'bytes={a}-{b}'})
            with urllib.request.urlopen(req, timeout=600) as r: return r.read()
        except Exception as e:
            time.sleep(min(30, 3 * (k + 1))); err = e
    raise err

def fetch_member(url, info, out):
    hdr = get(url, info.header_offset, info.header_offset + 29)
    n, m = struct.unpack('<HH', hdr[26:30])
    start = info.header_offset + 30 + n + m
    size = info.compress_size
    if size == 0: data = b''
    else:
        step = 512 * 1024
        parts = [(s, min(start + size - 1, s + step - 1)) for s in range(start, start + size, step)]
        with cf.ThreadPoolExecutor(8) as ex:
            data = b''.join(ex.map(lambda p: get(url, *p), parts))
    if info.compress_type == zipfile.ZIP_DEFLATED: data = zlib.decompress(data, -15)
    dst = os.path.join(out, info.filename); os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, 'wb').write(data)
    return info.filename, len(data)

if __name__ == '__main__':
    url, out, pats = sys.argv[1], sys.argv[2], sys.argv[3:]
    z = zipfile.ZipFile(io.BufferedReader(RemoteFile(url), buffer_size=1 << 20))
    todo = [i for i in z.infolist() if not i.filename.endswith('/') and any(fnmatch.fnmatch(i.filename, p) for p in pats)
            and not os.path.exists(os.path.join(out, i.filename))]
    print(len(todo), 'files', sum(i.compress_size for i in todo) // 1024, 'KB', flush=True)
    with cf.ThreadPoolExecutor(4) as ex:
        for name, size in ex.map(lambda i: fetch_member(url, i, out), todo):
            print('got', name, size, flush=True)
