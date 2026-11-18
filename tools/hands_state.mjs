// Dev: report whether IWSDK's hand meshes are drawn.  npx iwsdk browser run tools/hands_state.mjs
export default async function run({ page }) {
  const app = page.frames().find((f) => f !== page.mainFrame()) ?? page.mainFrame();
  return await app.evaluate(() => (window.__hoamHands ? window.__hoamHands() : 'no hook'));
}
