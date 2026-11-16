"""List / extract selected members of a remote zip via HTTP Range requests (no full download).
    python remotezip.py <zip_url> <out_dir> [glob ...]     (no globs: list members)"""
import io, sys, zipfile, urllib.request, fnmatch, os, concurrent.futures as cf

class RemoteFile(io.RawIOBase):
    def __init__(self, url):
        self.url = url
        import time
        for k in range(12):
            try:
                req = urllib.request.Request(url, method='HEAD')
                with urllib.request.urlopen(req, timeout=60) as r:
                    self.size = int(r.headers['Content-Length'])
                break
            except Exception as e:
                time.sleep(min(30, 3 * (k + 1)))
        self.pos = 0
    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos
    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else (self.pos + off if whence == 1 else self.size + off)
        return self.pos
    def fetch(self, start, end):
        import time
        for k in range(12):
            try:
                req = urllib.request.Request(self.url, headers={'Range': f'bytes={start}-{end}'})
                with urllib.request.urlopen(req, timeout=300) as r:
                    return r.read()
            except Exception as e:
                err = e; time.sleep(min(30, 3 * (k + 1)))
        raise err
    def read(self, n=-1):
        if n is None or n < 0: n = self.size - self.pos
        if n == 0 or self.pos >= self.size: return b''
        end = min(self.size, self.pos + n) - 1
        # parallel chunks for big reads
        if end - self.pos > 4_000_000:
            chunks = list(range(self.pos, end + 1, 2_000_000))
            with cf.ThreadPoolExecutor(8) as ex:
                parts = list(ex.map(lambda s: self.fetch(s, min(end, s + 1_999_999)), chunks))
            data = b''.join(parts)
        else:
            data = self.fetch(self.pos, end)
        self.pos += len(data)
        return data
    def readinto(self, b):
        d = self.read(len(b)); b[:len(d)] = d; return len(d)

if __name__ == '__main__':
    url, out = sys.argv[1], sys.argv[2]
    pats = sys.argv[3:]
    z = zipfile.ZipFile(io.BufferedReader(RemoteFile(url), buffer_size=1 << 16))
    names = z.namelist()
    if not pats:
        for i in z.infolist(): print(i.file_size, i.filename)
        sys.exit()
    for n in names:
        if any(fnmatch.fnmatch(n, p) for p in pats) and not n.endswith('/'):
            dst = os.path.join(out, n); os.makedirs(os.path.dirname(dst), exist_ok=True)
            with z.open(n) as src, open(dst, 'wb') as f: f.write(src.read())
            print('got', n, flush=True)
