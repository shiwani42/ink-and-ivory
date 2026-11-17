# Judging, documentation and submission (Meta VR Start style)

## Constraints to design for
Hands only, seated, purposeful passthrough, 72 fps target with 60 fps as the hard floor, original or properly licensed assets, no identifiable people or brands.

## Judging map (`docs/JUDGING.md`, written in Phase 1, updated as you go)
Innovation, Experience Design, Technical, Polish (25% each), plus the special award you are aiming for. For each: the evidence (feature, test, screenshot, measurement) and the gaps, marked honestly.

## Docs per project (updated in the same commit as the feature)
- `README.md`: pitch, how to play or use, run, test, architecture or code map, decisions, credits.
- `docs/TESTING.md`: harness, latest results, bugs found and fixed, headset checklist, limits.
- `docs/SUBMISSION.md`: paste-ready Devpost text, a shot list under 3 minutes, gallery images, the pre-submit checklist.
- `CREDITS.md` for every asset (assets-and-licensing.md), and credits in the app.

## Trailer
- Recorded on a Quest in standalone mode; real gameplay only; no AI-generated video.
- **Hook in the first 20 s** (the sooner the better), the awe moment early, the real room visible so passthrough reads as purposeful.
- Use `?state=` presets to film each moment without replaying the journey.

## Deploy
- Deploying creates a public URL: **ask first**, and make no redeploys after the deadline.
- `npx vercel --prod`; keep `Permissions-Policy: xr-spatial-tracking=*`.
- Test the production alias logged out on a headset, and give judges a **second tested mirror URL**.
- Grep `dist/` to confirm dev logs, keys and handles are stripped.

## Time plan
Reserve the last ~30 hours for headset QA, a 15-minute playtest with someone new to XR, deploy, trailer and forms. Feature work stops there.

## Write-up
Name known issues and what's next; link any SDK fork or patch you made (it reads as engineering depth); disclose analytics (prefer none); list the asset sources and their licences.

## Pre-submit self-check
Score yourself on the four criteria; walk the headset-only list in testing.md; confirm every credit against its source page; confirm both URLs work logged out.

## Finishing touches (keep for the last hours, after headset footage exists)
Small, high-visibility items. Park them in the project's final checklist so they aren't forgotten, then do them at the end:
1. **A hero GIF at the top of the README and the Devpost page:** a 5–8 s loop of the single magic moment (e.g. the hands locking together in gold), with descriptive alt text, before any text. Cut it from headset footage (`metavr capture video`), falling back to the emulator trailer: `ffmpeg -ss <t> -t 6 -i clip.mp4 -vf "fps=15,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" hero.gif`. Keep it under about 8 MB.
2. **A soft shadow under the guide's fingertip or tool tip** on the work surface (an invisible receiver, a blurred disc that tightens and darkens as it nears the surface). It shows hovering versus touching at a glance, for the ghost and the learner alike.
3. **A slow-frame logger:** count frames over budget with a fixed tag (`[app] perf slow=N of M p95=X ms`), on in dev and behind `?perf=1` in production. Ask the first headset tester for those lines; they're the cheapest real performance numbers you'll get.

## Recording the trailer (Meta's guidance)
Record landscape 1920 × 1080 (`metavr capture video start --width 1920 --height 1080`, from Linux too). Meta suggests 36 fps (variable), image stabilisation low, and slow, deliberate head movement. Mixed Reality Capture doesn't apply to WebXR. Use `?state=` presets to jump to each shot.

## Lessons from Mario 64 MR (Unity, studied Nov 2026; ideas only, see reference-winners/mario64mr-REPORT.md)
- *Top of README and Devpost:* one looping GIF of the single magic moment, with descriptive alt text, before any text.
- *Troubleshooting by symptom,* each with the exact fix. Pre-empt scary-looking false alarms by explaining what the script does.
- *Release notes per version* that say what changed, what the user must update, and credit the testers.
