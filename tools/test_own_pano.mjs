// Dev check for "your own 360 background": makes a plain (not 2:1) test photo
// in the page, feeds it to the converter through the dev hook, and reports.
//   npx iwsdk browser run tools/test_own_pano.mjs
export default async function run({ page }) {
  const app = page.frames().find((f) => f !== page.mainFrame()) ?? page.mainFrame();
  return await app.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 1600;
    c.height = 1067; // an ordinary 3:2 photo
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, '#6aa7d8');
    grad.addColorStop(0.6, '#f2d39b');
    grad.addColorStop(1, '#3f6b3a');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#a8231a';
    g.font = 'bold 160px sans-serif';
    g.fillText('TEST PHOTO', 260, 600);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    const file = new File([blob], 'test-photo.jpg', { type: 'image/jpeg' });
    await window.__hoamAddPano(file);
    return 'fed';
  });
}
