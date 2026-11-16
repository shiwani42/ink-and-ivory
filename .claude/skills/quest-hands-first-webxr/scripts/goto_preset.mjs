// Dev helper: reload the app with a ?state= preset inside the IWSDK emulator.
// The managed browser drops URL queries, so the preset goes through sessionStorage;
// the app's dev build reads that key once on load (then removes it) as if it were location.search.
//
//   Copy to <repo>/tools/goto.mjs
//   echo '{"key":"myapp-preset","query":"?state=practice&lesson=2"}' > artifacts/goto-preset.json
//   npx @iwsdk/cli browser run tools/goto.mjs
//
// Needs the dev server started with --allow-browser-automation
// (`npx @iwsdk/cli dev restart --allow-browser-automation`; announce the restart).
// App side (dev only):
//   const q = import.meta.env.DEV ? sessionStorage.getItem('myapp-preset') ?? '' : '';
//   sessionStorage.removeItem('myapp-preset');
//   const preset = parsePreset(location.search || q);
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function run({ page, workspaceRoot }) {
  let key = 'app-preset';
  let query = '';
  try {
    const cfg = JSON.parse(readFileSync(join(workspaceRoot, 'artifacts', 'goto-preset.json'), 'utf8'));
    key = cfg.key || key;
    query = cfg.query || '';
  } catch {
    // no file: plain reload
  }
  await page.evaluate(([k, q]) => sessionStorage.setItem(k, q), [key, query]);
  await page.reload();
  return { key, query };
}
