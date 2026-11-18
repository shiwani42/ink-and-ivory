// Dev check for "Describe a place, AI paints it in 360": points the app at
// tools/fake_dit360.py, opens the start-page form, submits a description and
// waits for the result. argv-free: PROMPT env picks the text.
//   python3 tools/fake_dit360.py 8099 &   then   npx iwsdk browser run tools/test_text_pano.mjs
export default async function run({ page }) {
  const app = page.frames().find((f) => f !== page.mainFrame()) ?? page.mainFrame();
  const prompt = process.env.PROMPT ?? 'a moonlit bamboo grove';
  return await app.evaluate(async (prompt) => {
    window.__hoamDit360Base = 'http://localhost:8099';
    window.__hoamPaint(prompt);
    const status = () => document.querySelector('#hoam-gen-status')?.textContent ?? '';
    const t0 = performance.now();
    while (performance.now() - t0 < 30000) {
      const s = status();
      if (/^Done|^Sorry/.test(s)) return s;
      await new Promise((r) => setTimeout(r, 250));
    }
    return 'timeout: ' + status();
  }, prompt);
}
