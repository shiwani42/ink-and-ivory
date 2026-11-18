// Dev check: convert a real image file into "your own background" through the app.
//   echo path/to/image > artifacts/pano-input.txt && npx iwsdk browser run tools/test_own_pano_file.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function run({ page, workspaceRoot }) {
  const path = readFileSync(join(workspaceRoot, 'artifacts', 'pano-input.txt'), 'utf8').trim();
  const data = readFileSync(path).toString('base64');
  const app = page.frames().find((f) => f !== page.mainFrame()) ?? page.mainFrame();
  return await app.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const file = new File([bytes], 'photo.png', { type: 'image/png' });
    await window.__hoamAddPano(file);
    return 'converted';
  }, data);
}
