# Architecture, lifecycle and dev shortcuts (IWSDK 1.1.0)

## One director system, explicit phases
- One `createSystem` director owns a phase enum and small pure modules (rules, hands, placement, ui/text, lighting, audio, save, fx). Example phases: `demo2d → placing → intro → watch → practice → complete`, or `placing → intro → turn → resolve → win`.
- Track `phaseT` (time in phase) and a `once(key)` helper that resets on phase change. Never write `if (t < 0.05)` to mean "first frame".
- A second activity is a new **mode** that reuses placement, menu, captions, scoring and progress, not a new app.
- Do all game or lesson maths in the local space of one anchored group, created with `world.createTransformEntity(group, { persistent: true })`; children with `{ parent }`.
- Base "first time" logic on explicit counters (`playerTurns`, `lessonsDone`), not on "has this hint been shown".

## Content is data
Arrays of lessons, songs, levels or opponents, each with an id, a name, one teaching sentence and its payload. Progress is keyed by id. Adding content is a one-line change; a menu of N tiles hides unused ones.

## Session tuning and clean pause
```ts
this.world.visibilityState.subscribe((state) => {
  if (state === VisibilityState.Visible) {
    (this.world.session as any)?.updateTargetFrameRate?.(72).catch(() => {});
    this.renderer.xr.setFoveation(0.4); // 0.4 text-heavy, 0.5 otherwise; three.js default 1.0 blurs text
  }
});
// in update(): freeze logic while the Quest system menu has focus
if (this.world.visibilityState.peek() === VisibilityState.VisibleBlurred) { /* end strokes, mute loops */ return; }
```

## App state, lifecycle and UI visibility
- **One central state, declarative panels:** each panel declares `showWhen(state)`, a priority and whether it is exclusive, instead of scattered `visible = …`.
- **Remember where the user was:** keep `stateBeforePause` (system menu) and `stateBeforeSessionEnd` (headset removed), and offer to resume on the next enter.
- **Versioned saves:** `{ version, … }` in localStorage, migrate or reset on a version change, try/catch every read and write, save only when dirty.

## Dev-only hooks (guard with `import.meta.env.DEV`; grep `dist/` to prove they're stripped)
- Structured logs: `console.info(\`[tag] #${pageId}.${seq} ${event} key=value layout=${JSON.stringify(points)}\`)`. `pageId` is random per load; `seq` increments every line (testing.md).
- Log world positions of every target a test must touch (`xr list-targets` only sees ECS entities and UIKit ids).
- A reset key (Shift+R: `localStorage.clear(); location.reload()`).
- Keys that force rare states (NPC looks away, near-win, trigger the awe moment) and review cameras (close-up, full body, profile).
- `renderer.info.render.calls/triangles` every 3–5 s.

## Named state presets (`?state=…`)
Jump straight to a moment for tests, screenshots and filming: `?state=practice&lesson=6`, `?state=fresh`. Parse defensively (unknown values ignored) and apply once, after placement.

**The emulator's managed browser drops URL queries.** In dev builds, also read the preset once from `sessionStorage` (then remove it), and set it from the CLI with a `browser run` script:
1. Start the server with `npx @iwsdk/cli dev restart --allow-browser-automation` (announce the restart).
2. Copy `scripts/goto_preset.mjs` into the repo (e.g. `tools/goto.mjs`), write `artifacts/goto-preset.json` (`{"key":"<app>-preset","query":"?state=…"}`), run `npx @iwsdk/cli browser run tools/goto.mjs`.
Reference implementation: `hands-of-a-master/src/presets.ts` and `tools/goto.mjs`.

## Feature-detect Quest-only APIs
`session.initiateRoomCapture`, persistent anchors, microgesture buttons: detect and log them, never assume. Never call `initiateRoomCapture` automatically (placement.md).

## LLM inside the experience
Return a JSON action contract (`{"action":"start_timer","seconds":300}`) and validate it before acting; split listen / think / speak modules; stream audio (`MediaRecorder` Opus) to a serverless endpoint; make sure the experience still stands without the model. Opponent-specific guidance: `quest-mr-game`.

## UI that turns to whoever is speaking
Put dialogue, reply cards and hints under one **UI root placed at the seated user's position** (on the table plane, about 0.45 m toward the user from the anchor) and yaw that root per scene: the cards stay within reach while the dialogue sits beside the speaker (e.g. a driver in a vehicle that pulls up on your right). Give a row of cards **one shared orientation** (a helper object at the row centre looks at the head) so the outer cards don't roll. Physical things (coins, plates, goods) stay in anchor space.
