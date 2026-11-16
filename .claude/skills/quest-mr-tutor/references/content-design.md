# Content design for a tutor

## Ladder shape
A famous hook, then 2–4 fundamentals as short drills, then 3–5 real pieces, then the user's own. Each item has a one-sentence teaching line shown while the master demonstrates, and lasts 1–2 minutes.

- **Fundamentals as drills:** each isolates one idea and states the rule in plain words ("A flat is the next key down. One black key has two names."). Name things the way the lesson does (show "Bb" in flat lessons, "C#" in sharp ones).
- **Content must fit the hardware.** Check every piece fits the playable range; if the most famous piece needs a few more keys, widen the instrument (a parameter in the model script) rather than mangling the piece.
- **Defaults, then choice:** never block the first minute with settings. Start in a sensible default (language, scene); invite a choice right after the first success and keep it on the menu.
- **Public-domain hooks:** pieces whose composers died long ago, folk tunes, Happy Birthday (public domain in the US since 2016 and the EU since 2017). Write your own simple arrangement.

## User-generated content
- **Perform:** record press times; beat = median gap (robust to one long pause); quantise to half beats; stop after 3 s of quiet or 40 notes.
- **Import:** for MIDI, ignore drums (channel 10), take the top note of each chord (skyline), use the first tempo, fit into range by whole octaves and fold the rest, cap at 40 notes.
- **Store** per browser; reset the score for that slot when its content changes.

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
