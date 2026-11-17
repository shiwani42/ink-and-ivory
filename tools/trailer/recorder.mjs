// Trailer recorder for the IWSDK emulator (dev only): records ONE shot.
//
//   npx iwsdk browser run tools/trailer/recorder.mjs --timeout 110000
//
// Managed-browser scripts are limited to 110 s, so tools/trailer/shoot.py runs
// this once per shot, in the background, while it drives the hands through
// the CLI. Per run:
//   1. read artifacts/trailer/shot.json: {"name", "query", "seconds"}
//   2. set a 1920x1080 viewport, reload the app with the preset (?state=...),
//      start a fresh XR session at full size, hide the emulator's panels
//   3. save Chrome DevTools screencast frames (JPEG + timestamps) to
//      artifacts/trailer/<name>/ until `seconds` pass or artifacts/trailer/stop
//      appears; then frames.json
// Wall-clock times go to artifacts/trailer/events.jsonl (for cutting audio).
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const W = 1920;
const H = 1080;

export default async function run({ page, workspaceRoot }) {
  const dir = join(workspaceRoot, 'artifacts', 'trailer');
  mkdirSync(dir, { recursive: true });
  const eventFile = join(dir, 'events.jsonl');
  const event = (e) => appendFileSync(eventFile, JSON.stringify({ t: Date.now(), ...e }) + '\n');

  await page.setViewportSize({ width: W, height: H });
  const app = () => page.frames().find((f) => f !== page.mainFrame()) ?? page.mainFrame();
  const cdp = await page.context().newCDPSession(page);

  let clip = null; // { name, frames: [] }
  let shotHead = null;
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    try {
      await cdp.send('Page.screencastFrameAck', { sessionId });
    } catch {
      // the session may be gone during a reload
    }
    if (!clip) return;
    const n = clip.frames.length;
    const file = `f${String(n).padStart(5, '0')}.jpg`;
    writeFileSync(join(dir, clip.name, file), Buffer.from(data, 'base64'));
    clip.frames.push({ file, t: metadata.timestamp });
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W, maxHeight: H, everyNthFrame: 1 });

  /** Hide the emulator's own panels and badges; keep the app and the emulated room. */
  const hideDevUi = async () => {
    await app().evaluate(() => {
      const devui = window.IWER_DEVICE?.devui;
      if (devui?.devUICanvas) devui.devUICanvas.style.visibility = 'hidden';
      if (devui?.devUIContainer) devui.devUIContainer.style.display = 'none';
    });
    // The managed workspace's own toolbar and badges, around the app frame.
    await page.evaluate(() => {
      const frame = document.getElementById('workspace-runtime-frame');
      if (!frame) return;
      for (let el = frame; el && el !== document.body; el = el.parentElement) {
        for (const sib of el.parentElement?.children ?? []) {
          if (sib !== el && !(sib instanceof HTMLScriptElement)) sib.style.visibility = 'hidden';
        }
      }
    });
  };

  /** Seat the emulated head (position + look-at target) and switch to hands, before the session starts. */
  const pose = async (head) => {
    await app().evaluate((h) => {
      const d = window.IWER_DEVICE;
      if (!d) return;
      d.primaryInputMode = 'hand';
      if (!h) return;
      const [x, y, z] = h.pos;
      const [tx, ty, tz] = h.look;
      const dx = tx - x, dy = ty - y, dz = tz - z;
      const yaw = Math.atan2(-dx, -dz);
      const pitch = Math.atan2(dy, Math.hypot(dx, dz));
      const sy = Math.sin(yaw / 2), cy = Math.cos(yaw / 2), sp = Math.sin(pitch / 2), cp = Math.cos(pitch / 2);
      d.position.set(x, y, z);
      d.quaternion.set(cy * sp, sy * cp, -sy * sp, cy * cp);
    }, head ?? null);
  };

  const restartSession = async () => {
    // A session keeps the canvas size it started with: end it and take the
    // app's next offer at full size.
    // Only if the running session is the wrong size (ending one right after a
    // reload races the app's own start-up).
    await app().evaluate(async (w) => {
      const d = window.IWER_DEVICE;
      const c = document.getElementById('scene-canvas') ?? document.querySelector('canvas');
      if (d?.activeSession && c && c.width !== w) await d.activeSession.end().catch(() => {});
    }, W);
    await pose(shotHead);
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(250);
      const ok = await app().evaluate(() => {
        const d = window.IWER_DEVICE;
        if (d?.activeSession) return true;
        if (d?.sessionOffered) d.grantOfferedSession();
        return false;
      });
      if (ok) break;
    }
    await page.waitForTimeout(400);
    await hideDevUi();
  };

  const shot = JSON.parse(readFileSync(join(dir, 'shot.json'), 'utf8'));
  // The app's console, for the director (the CLI's log reader waits while this script holds the browser).
  const consoleFile = join(dir, 'console.jsonl');
  page.on('console', (m) => {
    const text = m.text();
    if (text.startsWith('[hoam] ')) appendFileSync(consoleFile, JSON.stringify({ t: Date.now(), m: text }) + '\n');
  });
  mkdirSync(join(dir, shot.name), { recursive: true });
  shotHead = shot.head;
  await app().evaluate((q) => sessionStorage.setItem('hoam-preset', q), shot.query ?? '');
  await app().evaluate(() => location.reload());
  await page.waitForTimeout(3500);
  // One trusted click in an empty corner: Chrome only lets a page play sound
  // after the user has interacted with it.
  await page.mouse.click(6, 6);
  await page.waitForTimeout(200);
  await restartSession();
  event({ op: 'ready', name: shot.name });
  clip = { name: shot.name, frames: [] };
  const until = Date.now() + Math.min(100, shot.seconds ?? 60) * 1000;
  const stopFile = join(dir, 'stop');
  while (Date.now() < until && !existsSync(stopFile)) await page.waitForTimeout(100);
  const done = clip;
  clip = null;
  await cdp.send('Page.stopScreencast').catch(() => {});
  writeFileSync(join(dir, done.name, 'frames.json'), JSON.stringify(done.frames));
  event({ op: 'stop', name: done.name, frames: done.frames.length });
  return { frames: done.frames.length };
}
