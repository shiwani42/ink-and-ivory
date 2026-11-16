# iwsdk-starter — notes added by this kit

Generated 16 Nov 2026 with the official scaffolder (no manual edits to app code):

```bash
npx -y @iwsdk/create@1.1.0 iwsdk-starter --yes --target ar --language ts \
  --grabbing --no-physics --scene-understanding --no-git --install --skip-reference-warmup
```

Resulting `iwsdk.config.json`: mixed-reality (`ar`, passthrough) session, `handTracking`, `anchors`, `planeDetection`, `meshDetection` on, locomotion off (seated/hands-first friendly), grabbing on, emulator device **metaQuest3** in room **sunlit_living_room**, dev server port 8081, Vite `base: './'`.
Packages: `@iwsdk/core` 1.1.0, `@iwsdk/cli` 1.1.0, `@iwsdk/vite-plugin-dev` 1.1.0, `three` → `super-three@0.185.0`. Node: `>=20.19 <21 || >=22.12 <23 || >=24` (see `package.json` engines; `.nvmrc` included).

## Verified on the kit's Linux box (Node 22)
`npm ci` → `npm run typecheck` (pass) → `npm run build` → `dist/` produced. Not verified here: running in a real Quest browser (no headset).

## Run
```bash
npm ci
npm run dev          # HTTPS dev server + built-in emulator (IWER) on localhost
npm run build        # static site in dist/
npm run preview
```
On a Quest: open the Network URL shown by the dev server in Meta Quest Browser on the same Wi-Fi, or use ADB port forwarding (`chrome://inspect/#devices`) — [IWSDK testing guide](https://developers.meta.com/horizon/documentation/iwsdk/guides/02-testing-experience).
In the emulator switch input to **hands** to test the hands-only path (see `setup/simulators/immersive-web-emulator.md`).

## Deploy (judges need a hosted HTTPS URL)
- **Vercel:** `vercel.json` is copied unchanged from [meta-quest/iwsdk-v0-template](https://github.com/meta-quest/iwsdk-v0-template) (Apache-2.0, © Meta Platforms) — it sets `Permissions-Policy: xr-spatial-tracking=*`, SPA rewrites and asset caching. Import the folder in Vercel or run `npx vercel`.
- **GitHub Pages:** either `npm install -D gh-pages && npm run build && npx gh-pages -d dist` then Settings → Pages → branch `gh-pages`, or the Actions workflow in `deploy/github-pages-deploy.yml.example`. Meta's guide says to set Vite `base: '/<repo-name>/'` for project sites; this starter ships `base: './'` (relative), which should also work but is ⚠ unverified on Pages — switch to the documented value if assets 404. Source: [Build and deploy](https://developers.meta.com/horizon/documentation/web/iwsdk-guide-build-deploy).
- Before submitting, open the URL in a **logged-out/incognito** browser and on the headset.

The scaffolder also adds AI-agent instructions (`AGENTS.md`, `CLAUDE.md`, `.agents/`, `.cursor/`, `.github/instructions/` …); they're part of the official template and harmless if unused.
