# Content design for a tutor

## Ladder shape
A famous hook, then 2–4 fundamentals as short drills, then 3–5 real pieces, then the user's own. Each item has a one-sentence teaching line shown while the master demonstrates, and lasts 1–2 minutes.

- **Fundamentals as drills:** each isolates one idea and states the rule in plain words ("A flat is the next key down. One black key has two names."). Name things the way the lesson does (show "Bb" in flat lessons, "C#" in sharp ones).
- **Content must fit the hardware.** Check every piece fits the playable range; if the most famous piece needs a few more keys, widen the instrument (a parameter in the model script) rather than mangling the piece.
- **Defaults, then choice:** never block the first minute with settings. Start in a sensible default (language, scene); invite a choice right after the first success and keep it on the menu.
- **Public-domain hooks:** pieces whose composers died long ago, folk tunes, Happy Birthday (public domain in the US since 2016 and the EU since 2017). Write your own simple arrangement.

## From a ladder to a course (what "like Duolingo" means here)
A ladder of 6–9 items is a demo; skills come from practice, so plan a **course**: units of at most 9 short lessons (2–3 minutes each).
- **Generate content from data, don't hand-author it.** Stroke data (KanjiVG has about 6,700 characters plus kana), a letter set you draw once and compose into words, and seeded exercises. For example, "Today's echo" is a new 8-note phrase each day from a date seed, the same for everyone. One table per unit: `[id, glyph, reading A, reading B, meaning, teaching line]`.
- **Interleave** kinds of content (kanji units between hiragana units; drills between songs). Keep the famous hook first and the old ids stable so saved progress survives.
- **Menu:** one unit per page (a 3×3 grid), with `<` and `>` and "UNIT n OF N: Title". Never show hundreds of tiles in VR; the text must stay big.
- **Help that fades by pass:** each pass of a lesson lowers the help: full guide, then the outline only, then from memory (a faint trace). Show one star per pass, and say on completion what changes next time.
- **Help that fades within the attempt** (the skill-adaptive ghost, CHI 2026, arXiv 2603.06253):
  - keep an `assist` value from 0 to 1;
  - lower it about 0.5/s while the learner is within the lock distance of the master, and raise it about 0.15/s when they are well off;
  - after a failed stroke add 0.4; on a wrong note add 0.3; on an on-beat note subtract 0.1;
  - ghost opacity = `0.08 + 0.72 × levelHelp × assist`.
  - Always-on guidance helps performance but hurts retention (the guidance hypothesis).
- **Call and response for sequences:** split songs after long notes (phrases of 4 or more notes; keep exercises of 16 notes or fewer whole). The master plays a phrase, the learner echoes it, then the next, then the whole piece. "Play again" and Review skip straight to the whole piece.
- **Make rhythm visible:** a four-beat count-in (ticks with an accent on the first), and the next target pulses at the moment it is due (a Gaussian bump around the due time), not on a free-running sine.
- **Daily goal** (3 lessons), a streak, and **Review**: the passed lesson with the lowest best score, minus a bonus for not being practised today, done from memory.
- **A third script, a different tool:** Western italic uses a broad nib at a fixed angle (40°). Width = `w0 + w1·|dir × nibEdge|`, so downstrokes swell and the hairlines on the nib's angle thin. It's a few lines in the ribbon code, and it makes English feel like real lettering rather than brush writing. Draw the letters yourself as SVG paths (M, L, C) in the lesson's ductus (stems and arches in one stroke, bowls counter-clockwise from the top right). Original work has no licence questions; render a contact sheet with the computed widths before wiring them in.

## User-generated content
- **Perform:** record press times; beat = median gap (robust to one long pause); quantise to half beats; stop after 3 s of quiet or 40 notes.
- **Import:** for MIDI, ignore drums (channel 10), take the top note of each chord (skyline), use the first tempo, fit into range by whole octaves and fold the rest, cap at 40 notes.
- **Store** per browser as a list (about 6 tunes); give each its own id; replace a duplicate (same notes) instead of adding it again; reset the score when the content changes.
- **Share as a link:** `?tune=<base64url JSON of name, tempo, notes>`. On load, decode it and **validate every note** against the instrument's range (it's untrusted input), save it, and after placement go straight to that piece with the master playing it. The 2D start page copies the link (with an address-bar fallback when the clipboard is blocked).

## Feedback we got, and the rule behind each fix
| User said | Rule | Fix |
|---|---|---|
| "Visuals look ugly / dummy" | Primitives read as placeholder | Blender-scripted models with bevels and CC0 PBR textures; one serif title font and one sans body font; warm paper panels; two accent colours; arrival animations |
| "Make it a real place, from public sources" | Authentic beats invented | CC0 360° photos of where the craft is practised; ask before using a generic landscape |
| "Background is too busy" | The task stays the focus | Calm shader; turn the view to the quietest side |
| "Don't mix the house and the world" | Partial overlays confuse | Place in passthrough, then dissolve fully into the place; a button back |
| "Music per place; none at the instrument" | Sound must not compete with the task | Playlists per place, on/off switch, silence where the user makes the sound |
| "Add another craft" | Reuse the apprenticeship core | A new mode with its own data, sharing placement, menu, captions, scoring, progress |
| "Show the notes being played" | Learners need to see the music | A sheet on the instrument, letters on keys, floating notes |
| "Let me choose and add my own" | Agency and relevance | Choice after the first success; perform-to-teach; file import |
| "Use a famous pop song for onboarding" | Copyrighted melodies can't ship | Explain; offer public-domain options and bring-your-own |
| "Include the basics as lessons" | Onboarding should build real skill | The ladder above |
| "Many more lessons, like Duolingo" | Skills are practice | Units, generated content, help that fades by pass and within the attempt, daily goal, review (above) |
| "Add English calligraphy" | A new script can need a new tool | Broad-nib width by direction; original letter paths; its own place (a cloister) |
| "Use public sources where the licence allows" | Authentic and free beats invented | KanjiVG (CC BY-SA), Poly Haven (CC0), public-domain melodies; draw it yourself only when nothing fits |
