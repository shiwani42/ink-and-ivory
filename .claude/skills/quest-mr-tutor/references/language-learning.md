# Language learning by doing errands (hands first, voice optional)

Built and emulator-verified in `sadak-vr/` (a Hindi port of the SADAK web game, IWSDK 1.1.0, Nov 2026). It generalises to any "talk to a character, then act" learning loop.

## The loop per line
Character speaks (voice + caption) → reply cards appear while the line finishes → you **touch lightly to hear** a card (hover 0.45 s in front of it plays it once), **push through to say it** → right: the card turns green, your line plays in a player voice, the character nods, and a "New phrase: …" chip appears. Wrong: the card shakes, the character is puzzled ("Pardon? Say that again"), and a hint **specific to that wrong card** appears. After two misses the right card glows.

## Content as data
- Each line has three tiers: script (large), romanisation, meaning (small, muted). Draw them with Canvas2D (it shapes Indic/CJK text; uikit and troika can't), fitting each tier to the width and **shrinking the whole block until it fits the height**.
- A step is `{ npc, reply, wrong: [{ line, hint }], before?: action, after?: action, goal }`. Distractors are plausible lines from *other* errands (the auto driver's question at the snack stall), or near-misses that teach (one vs two, 60 vs 40). Each one carries its own hint.
- Errand-level `greet`, `recall` (the return-visit line) and `bye`. Card order comes from a seeded shuffle, so tests are stable but the right card isn't always first.
- Unit-test the content: three tiers present, no duplicate cards, a hint on every distractor, goal text ≤ 44 characters.

## Physical verbs that are the lesson
- **Pay** with pinch-and-drop coins on the vendor's plate. Numbers become hands-on; overpaying makes the vendor hand back the last coin that landed ("That's too much").
- **Pick** goods by pinching them (with a gentle pulse); they fly to your side.
- **Serve:** the vendor slides food to you. Pick it up and bring it to your mouth for a crunch (bite 3 times). Pure delight, and it costs nothing.
- **Hail:** a palm above head height for 0.35 s stops a vehicle.
- Plates and goods must be within a seated reach: about 0.55 m from the eyes horizontally, not across the counter.

## Voice (optional; every step must complete with hands)
- **Bake scripted TTS once** into static files: `clipId = speaker + FNV-1a(speaker|text)` shared by the bake tool (`node tools/bake-tts.ts`, the key read from gitignored `.env.local`) and the runtime. Static clips mean zero runtime cost, no key in the client, and instant playback. Missing clips fall back to a **matching-language** `speechSynthesis` voice, or silence (never an English voice reading another script).
- **STT** through one handler shared by a Vercel function (`api/stt.ts`, `export function POST(req: Request)`) and a Vite dev middleware (`server.ssrLoadModule` of the same file), so dev and prod behave the same. Exclude `/api/` from the SPA rewrite and add `microphone=(self)` to `Permissions-Policy`.
- **Mic:** ask in the Enter-XR click (a user gesture), right after `launchXR()`. Use a mic orb (pinch or poke to toggle) that auto-stops after about 1.1 s of silence or 7 s. Score the transcript against **every visible card** with a word aligner (SADAK's order-preserving weighted LCS); best ≥ 0.5 chooses that card, and colour the words green/yellow/red on the card.
- Duck the ambience under speech; captions always carry the line.

## Reason to come back
Versioned save: visits per character (→ the recall greeting next time), phrasebook (said, and spoken ≥ 70%), day streak. Show them at the finale: "N phrases · day D · come back tomorrow: they'll remember you."
