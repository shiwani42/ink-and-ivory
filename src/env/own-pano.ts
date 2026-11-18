/**
 * Your own background: any photo becomes the 360-degree place around you.
 *
 * - A 360 panorama (about 2:1, equirectangular) is used as it is.
 * - Any other photo goes through a simple image-to-panorama converter: the
 *   photo sits in front of you like a large window, about 100 degrees wide on
 *   the horizon, with feathered edges, and the rest of the sphere is filled
 *   with a heavily blurred stretch of the same photo, so its colours and light
 *   wrap all the way round.
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
export async function makeOwnPano(file: File): Promise<{ blob: Blob; converted: boolean }> {
  const img = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const converted = !isPanorama(img.width, img.height);
  if (!converted) {
    ctx.drawImage(img, 0, 0, W, H);
  } else {
    // Ambient wrap: the whole photo stretched round the sphere, very blurred.
    ctx.filter = 'blur(70px) saturate(1.1)';
    ctx.drawImage(img, -W * 0.08, -H * 0.12, W * 1.16, H * 1.24);
    ctx.filter = 'none';
    // The photo itself, in front of you (the centre of the panorama), with feathered edges.
    const w = W * (100 / 360);
    const h = Math.min(H * 0.62, (w * img.height) / img.width);
    const ww = (h * img.width) / img.height;
    const x = W / 2 - ww / 2;
    const y = H / 2 - h * 0.55;
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
  return { blob, converted };
}
