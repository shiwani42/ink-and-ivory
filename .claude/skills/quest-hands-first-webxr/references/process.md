# Iterating with the user: what worked

How the reference project went from a working prototype to a polished entry through several rounds of user feedback, generalised for the next project.

## The loop
1. **Build the smallest complete journey first:** enter, place, demonstrate, do, score, complete. Test it end to end, commit, and show screenshots. A complete rough loop beats a polished fragment, because every later change can be regression-tested.
2. **Show, then ask one focused question.** Send screenshots (`artifacts/*.png`) with each round and ask how it feels. Users react to pictures far better than to descriptions.
3. **Treat feedback as a design rule, not a one-off fix.** "Too busy" became "places are softened behind the task". "Don't mix house and world" became "one world at a time". Write the rule into the skill.
4. **Keep the user informed during long work.** A one-line status at each milestone ("full regression at lesson 4 of 6; meanwhile updating docs").
5. **Commit after each green regression,** with docs in the same commit. Never leave a big uncommitted pile: the reference project once carried two features uncommitted for hours.
6. **Delegate side quests** (tool research, licence checks) to a background agent with a narrow brief and the questions that matter: licence, runs on our hardware, API, quality. Keep building meanwhile.

## Feedback we got, and the fix that worked
| User said | Underlying rule | Fix |
|---|---|---|
| "Visuals look ugly / dummy" | Judges score polish; primitives read as placeholder | Blender-scripted models with bevels and CC0 PBR textures, a design system (one serif title font, one sans body font, warm paper panels, two accent colours), arrival animations |
| "Make it a real place, not built from scratch; prefer public sources" | Authentic places beat invented ones | CC0 360-degree photos (Poly Haven, Wikimedia Commons) of where the craft is practised; ask before using generic landscapes (Fuji isn't a calligraphy place) |
| "Background is too busy / distracting" | The task must stay the focus | Calm shader: mip-bias blur, half desaturation, warm haze, slight dimming; turn the view to the quietest side |
| "Don't mix the house and the world" | Partial overlays confuse | Start in passthrough for placement, then dissolve fully into the place; a Scene button to go back |
| "Music per language / place; none at the piano" | Sound sets mood but must not compete with the task | Playlists per place, an on/off switch, silence where the user makes the sound |
| "Add another craft (piano)" | Reuse the apprenticeship core | A new mode with its own data (songs), sharing placement, menu, captions, scoring and progress |
| "Show the notes being played" | Learners need to see the music, not only hear it | A music sheet on the instrument (current note highlighted, played notes inked or gold), letters on keys, notes floating up from pressed keys |
| "Let users choose language and music; let them add their own" | Agency and personal relevance | Choice offered after the first success; "teach the master" recording; MIDI import on the start page; saved per browser |
| "Make a famous pop song the onboarding song" | Copyrighted melodies can't ship in a public entry | Explain plainly, offer public-domain options (Happy Birthday is PD since 2016/2017) and the bring-your-own path |
| "Include sharps and the basics as lessons" | Onboarding should build real skill | A ladder: famous song, then fundamentals (white keys, sharps, flats), then songs that use them |

## Content design patterns
- **Ladder shape:** a famous hook, then 2 to 4 fundamentals as short drills, then 3 to 5 real pieces, then the user's own. Each item has a one-sentence teaching line shown while the master demonstrates.
- **Fundamentals as drills:** each drill isolates one idea and states the rule in plain words ("A flat is the next key down. One black key has two names."). Name things the way the lesson does (show "Bb" in flat lessons, "C#" in sharp ones).
- **Choose content that fits the hardware.** Check every piece fits the playable range before shipping. If the most famous piece needs a few more keys, widen the instrument (a parameter in the Blender script) rather than mangling the piece.
- **User-generated content:**
  - **Perform:** record press times; the beat is the median gap between notes (robust to one long pause); quantise to half beats; end after 3 s of quiet or 40 notes.
  - **Import:** for MIDI, ignore drums (channel 10), take the top note of each chord (skyline), use the first tempo, fit into range by whole octaves and fold the rest, cap at 40 notes.
  - **Store** in localStorage, and reset the score for that slot when the content changes.
- **Defaults, then choice:** never block the first minute with a settings screen. Invite a choice right after the first success.

## Process anti-patterns we hit
- Editing a comment in `src/` while the emulator test was running (the page hot-reloads and the run is invalid).
- Measuring draw calls from a log that still held the previous run's lines.
- Long eyebrow or label text overflowing fixed UI sizes, found only in screenshots.
- Writing an author's name in the credits from memory instead of from the source page.
- Assuming a hosted asset API works because it is documented (Meta's asset search was down server-side).
