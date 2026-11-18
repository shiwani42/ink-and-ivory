/**
 * Your own background: any photo becomes the 360-degree place around you.
 *
 * - A 360 panorama (about 2:1, equirectangular) is used as it is.
 * - A wide partial panorama (2.3:1 or wider) wraps across its own field of
 *   view, estimated from its shape (3:1 is about 180 degrees).
 * - Any other photo sits in front of you like a large window, about 100
 *   degrees wide on the horizon.
 * In both cases the edges are feathered and the rest of the sphere is filled
 * with a blurred, seamless (mirrored) stretch of the same image, so its
 * colours and light wrap all the way round.
 *
 * The result (a 4096 x 2048 JPEG) is kept in IndexedDB, in this browser only.
 */

const DB = 'ink-and-ivory';
const STORE = 'files';
const KEY = 'own-pano';
const W = 4096;
const H = 2048;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadOwnPano(): Promise<Blob | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : undefined);
      req.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined; // storage blocked: no saved background
  }
}

async function saveOwnPano(blob: Blob): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // storage blocked: the background works for this visit only
  }
}

/** True when the image is already a 360 panorama (about 2:1). */
export function isPanorama(width: number, height: number): boolean {
  return Math.abs(width / height - 2) < 0.15;
}

/** Turn a photo into a 4096 x 2048 equirectangular panorama and save it. */
export async function makeOwnPano(file: File): Promise<{ blob: Blob; converted: boolean; ms: number }> {
  const t0 = performance.now();
  const img = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const converted = !isPanorama(img.width, img.height);
  if (!converted) {
    ctx.drawImage(img, 0, 0, W, H);
  } else {
    // Ambient wrap, seamless all the way round: the photo across the front
    // half, and each of its halves mirrored outwards so they meet behind you
    // on the same column (no seam where the panorama wraps). Blurred at 1/8
    // size and scaled up: the same soft look for a fraction of the cost (a
    // full-size canvas blur is slow on a headset's mobile GPU).
    const small = document.createElement('canvas');
    const sw = W / 8;
    const sh = H / 8;
    small.width = sw;
    small.height = sh;
    const sctx = small.getContext('2d')!;
    const iw = img.width;
    const ih = img.height;
    sctx.drawImage(img, 0, 0, iw, ih, sw / 4, 0, sw / 2, sh); // the photo, front half
    sctx.save();
    sctx.scale(-1, 1); // mirrored halves
    sctx.drawImage(img, 0, 0, iw / 2, ih, -sw / 4, 0, sw / 4, sh); // left half, mirrored into [0, sw/4]
    sctx.drawImage(img, iw / 2, 0, iw / 2, ih, -sw, 0, sw / 4, sh); // right half, mirrored into [3sw/4, sw]
    sctx.restore();
    const blurred = document.createElement('canvas');
    blurred.width = sw;
    blurred.height = sh;
    const bctx = blurred.getContext('2d')!;
    bctx.filter = 'blur(4px) saturate(1.08)';
    // Draw three times side by side so the blur also wraps round without a seam.
    bctx.drawImage(small, -sw, 0);
    bctx.drawImage(small, 0, 0);
    bctx.drawImage(small, sw, 0);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(blurred, 0, 0, W, H);
    // The photo itself, centred in front of you, with feathered edges. An
    // ordinary photo spans about 100 degrees, like a big window. A wide
    // partial panorama (2.3:1 or wider) wraps across its own field of view,
    // estimated from its shape at about 60 degrees tall (3:1 is about 180).
    const aspect = img.width / img.height;
    const partial = aspect >= 2.3;
    const hfov = partial ? Math.min(330, aspect * 60) : 100;
    const w = W * (hfov / 360);
    const h = Math.min(H * (partial ? 0.8 : 0.62), w / aspect);
    const ww = h * aspect;
    const x = W / 2 - ww / 2;
    const y = H / 2 - h * (partial ? 0.5 : 0.55);
    const tile = document.createElement('canvas');
    tile.width = Math.round(ww);
    tile.height = Math.round(h);
    const t = tile.getContext('2d')!;
    t.drawImage(img, 0, 0, tile.width, tile.height);
    t.globalCompositeOperation = 'destination-in';
    const f = Math.min(tile.width, tile.height) * 0.12;
    const gx = t.createLinearGradient(0, 0, tile.width, 0);
    gx.addColorStop(0, 'rgba(0,0,0,0)');
    gx.addColorStop(f / tile.width, 'rgba(0,0,0,1)');
    gx.addColorStop(1 - f / tile.width, 'rgba(0,0,0,1)');
    gx.addColorStop(1, 'rgba(0,0,0,0)');
    t.fillStyle = gx;
    t.fillRect(0, 0, tile.width, tile.height);
    const gy = t.createLinearGradient(0, 0, 0, tile.height);
    gy.addColorStop(0, 'rgba(0,0,0,0)');
    gy.addColorStop(f / tile.height, 'rgba(0,0,0,1)');
    gy.addColorStop(1 - f / tile.height, 'rgba(0,0,0,1)');
    gy.addColorStop(1, 'rgba(0,0,0,0)');
    t.fillStyle = gy;
    t.fillRect(0, 0, tile.width, tile.height);
    ctx.drawImage(tile, x, y);
  }
  img.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.88),
  );
  await saveOwnPano(blob);
  return { blob, converted, ms: Math.round(performance.now() - t0) };
}
