# Sound

Sound replaces the haptics hand tracking lacks: every interaction gets a cue.

## Setup
- Create the `AudioContext` lazily and `resume()` it from a user gesture (entering XR counts).
- Route effects through one compressor bus; music on its own gain with an on/off switch.
- Use positional one-shots for objects in the world.

## Synthesised sounds (no files)
- **Paper or surface scratch:** looped white noise → bandpass (1.6–6 kHz, following speed) → gain following speed.
- **Bell:** a sine plus partials at 2.76× and 5.4×, exponential decay over ~1.6 s; walk a pentatonic scale per success.
- **UI wood block:** 520 Hz triangle, 0.09 s decay.
- **Thud:** 95 Hz plus low-passed noise.

## Variety
Repeated sounds (taps, clacks, steps) get 3–4 variants or a random pitch (±3%) and filter jitter, so they don't sound mechanical. Landing taps can rise in pitch along a sequence.

## Samples and music
- Sampled instruments: one sample every minor third, pitch-shifted with `playbackRate = 2^(semitones/12)` (e.g. Salamander Grand Piano, CC-BY 3.0).
- Music: CC0 from OpenGameArt (verify the author on the page), chosen per place or mood, re-encoded `ffmpeg -i in -ac 2 -b:a 96k -af afade=t=in:d=2 out.mp3`.
- **No music where the user makes the sound** (instruments) or where speech carries the experience.

## Speech
`speechSynthesis` voices vary by device and may be missing: always caption, and list "TTS voices present" as a headset-only check. Drive a character's jaw from the line timing (syllable rhythm), not from audio analysis.

## Spatial (HRTF) audio
Sounds should come from where they happen. Meta's design guidance calls spatial audio out, and neither 2026 project used it at first.
- One `PannerNode` per sound source: `panningModel 'HRTF'`, `distanceModel 'inverse'`, `refDistance` ~0.6 m (arm's length unchanged), `rolloffFactor` ~0.6. Position it with `positionX/Y/Z` (fallback `setPosition`).
- One-shots (piano notes, dice, clacks): create a panner per event at the object's world position (`localToWorld` into a preallocated vector).
- Continuous sounds (brush scratch): one persistent panner, moved every frame.
- **Move the ears every frame:** `ctx.listener.positionX…` and `forwardX…/upX…` from the head's world position and quaternion (`(0,0,-1)` and `(0,1,0)` rotated), with preallocated vectors.
- If the app owns its own `AudioContext`, IWSDK's `AudioListener` on the head does not drive it; update the listener yourself.
- `speechSynthesis` voices cannot go through a panner. Place a caption near the speaker instead.
- Test with headphones on desktop, then on the headset.
