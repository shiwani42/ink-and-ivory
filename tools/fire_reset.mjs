// Dev: fire 'reset' on the XR reference space, as holding the Meta button does.
//   npx iwsdk browser run tools/fire_reset.mjs
export default async function run({ page }) {
  const app = page.frames().find((f) => f !== page.mainFrame()) ?? page.mainFrame();
  return await app.evaluate(() => (window.__hoamFireReset ? (window.__hoamFireReset(), 'fired') : 'no hook'));
}
