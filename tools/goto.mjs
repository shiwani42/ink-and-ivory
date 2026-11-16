// Dev helper: reload the app with a ?state= shortcut, in the IWSDK emulator.
//   echo '?state=practice&lesson=6' > artifacts/goto-query.txt
//   npx iwsdk browser run tools/goto.mjs
// The managed browser drops URL queries, so the shortcut goes through
// sessionStorage ('hoam-preset'), which dev builds read once on load.
// Needs the dev server started with --allow-browser-automation.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function run({ page, workspaceRoot }) {
  let query = '';
  try {
    query = readFileSync(join(workspaceRoot, 'artifacts', 'goto-query.txt'), 'utf8').trim();
  } catch {
    // no file: plain reload
  }
  await page.evaluate((q) => sessionStorage.setItem('hoam-preset', q), query);
  await page.reload();
  return { query };
}
