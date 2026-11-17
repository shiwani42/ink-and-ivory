// Test helper: a quick burst of page screenshots, for moments shorter than a
// `browser screenshot` round trip (about 3 s), such as a gesture's hold ring.
//   echo '{"name":"hands-4-thumbs-up-hold","times":[0.3,0.5,0.7]}' > artifacts/snap.json
//   npx iwsdk browser run tools/snap.mjs
// Writes artifacts/<name>-<i>.png (the whole page, emulator panels included;
// tools/e2e_hands.py crops them off). Needs --allow-browser-automation.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function run({ page, workspaceRoot }) {
  const cfg = JSON.parse(readFileSync(join(workspaceRoot, 'artifacts', 'snap.json'), 'utf8'));
  const start = Date.now();
  const files = [];
  for (let i = 0; i < cfg.times.length; i++) {
    const wait = cfg.times[i] * 1000 - (Date.now() - start);
    if (wait > 0) await page.waitForTimeout(wait);
    const path = join(workspaceRoot, 'artifacts', `${cfg.name}-${i}.png`);
    await page.screenshot({ path });
    files.push(path);
  }
  return { files };
}
