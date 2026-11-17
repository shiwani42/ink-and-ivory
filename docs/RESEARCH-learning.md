# Research: teaching piano and calligraphy better

Research for "Hands of a Master" (17 Nov 2026, about 20 hours before submission). It looks at what teachers, motor-learning studies and competing apps say, and turns that into changes to this app.

**Where the app stands (read from the code):**
- **Piano** (`src/piano/piano-mode.ts`): the master plays the whole song, then the learner plays the whole song in "wait mode". There are no phrase chunks, no finger numbers, no count-in and no pulse. The master's hand is a single pointing fingertip. The ghost only fades between sessions, driven by your best score.
- **Calligraphy** (`src/calligraphy-system.ts`, `src/lessons/scoring.ts`): the master demonstrates the whole character, then leads each stroke. Every stroke gets a verdict, a points total and, when a check fails, a hint.
- **Both:** the adaptive guide fades between sessions only, never during an attempt.

**How sources are marked:** claims backed by a source carry a link. Claims marked *(inference)* are my own reasoning and are not verified.

---

## Top 10 improvements

Ranked by (impact on learner and judges) ÷ (effort). Effort: **S** = under 2 h, **M** = half a day, **L** = more.

### 1. Fade the ghost during the attempt, not only between sessions (both crafts). Effort S. Emulator: yes.
**What to change:**
- Keep a smoothed error value, `err`, per attempt.
  - Piano: 1 on a wrong key, otherwise 0, plus a timing term.
  - Calligraphy: 1 − `sync`, or the distance from the master's fingertip divided by 2.4 cm, each frame.
- Smooth it asymmetrically, so it falls fast when you do well and rises slowly after a slip. For example, decay at 0.5/s and rise at 0.15/s *(inference: the paper does not publish its constants)*.
- Map it linearly to ghost opacity, clamped to **0.08 to 0.8**.
- Multiply this by the existing between-session `skill()` factor.
- Add one caption the first time the ghost dims within an attempt: "The master is letting go."

**Why:**
- The CHI 2026 study *Skill-Adaptive Ghost Instructors* tested exactly this. It ran on Quest 3 hand tracking, with a virtual keyboard aligned to a real desk. Error was weighted 0.7 pitch, 0.2 timing and 0.1 fingering, smoothed with an asymmetric moving average, and mapped to opacity in 0.08 to 0.8.
- Against a fixed 50% ghost, retention after 10 minutes was much better:
  - pitch accuracy 99.6% vs 87.8%;
  - finger accuracy 96.5% vs 76.7%.
- 47 of the 53 decisive preference answers favoured the adaptive ghost. [arXiv 2603.06253](https://arxiv.org/html/2603.06253v1), [TU Delft record](https://repository.tudelft.nl/record/uuid:ee3cda40-5808-4304-8d91-6f240aee57ac)
- This is the guidance hypothesis in action: guidance that is always on supports performance during practice but harms retention ([Winstein & Schmidt 1990, as summarised in PMC7205416](https://pmc.ncbi.nlm.nih.gov/articles/PMC7205416)).
- JUDGING.md already cites this paper. Doing what it actually did is cheap, and judges will see the master let go in real time.

### 2. Piano: teach phrase by phrase (call and response), then join the phrases. Effort M. Emulator: yes.
**What to change:**
- Split each song into phrases of 4 to 8 notes. Add an optional `phrases: number[]` (start indices) to `PianoSong`, or split automatically after any note of 2 beats or more. All current songs have such notes at their phrase ends.
- The new loop, with the existing wait mode used inside each phrase:
  1. The master plays phrase 1, and you echo it.
  2. The master plays phrase 2, and you echo it.
  3. You play phrases 1 and 2 joined.
  4. Continue phrase by phrase, then play the whole song.
- If you miss more than one note in a phrase, the master replays only that phrase at 80% tempo.
- Show the current phrase on the music sheet (`notation.ts`) as a bracket.

**Why:**
- The CHI 2026 study structured practice exactly like this: Phrase 1, Phrase 2, then the full melody ([arXiv](https://arxiv.org/html/2603.06253v1)).
- Faber's first lessons use echo playing: the teacher plays a short pattern and the student plays it back ([Piano Adventures Primer Guide](https://primerguide.pianoadventures.com/units/two-black-ants/)).
- Expert pianists who learned fastest found the exact hard spot, repeated it until it was right, and stopped before an error rather than play it wrong. Total time and number of repetitions did not predict success ([Duke, Simmons & Cash 2009](https://www.structural-learning.com/research-briefings/practise-the-hard-bit)).
- On splitting a skill into parts: part practice suits long serial tasks, and the progressive-part method (A, then B, then A+B) is the textbook approach ([Fontana et al. 2009 meta-analysis, summary](https://drfurtado.github.io/kin377/ch18/index.html)).
- Suzuki breaks its pieces into units small enough to grasp at once ([Suzuki piano notes](https://core.ecu.edu/wilburnk/SuzukiPianoBasics/KataokaSensei/HTB.htm)).
- Right now a beginner watches 25 notes of Happy Birthday and is then asked to reproduce all of them. That puts too much load on working memory *(inference)*.

### 3. The master's vermilion correction at the seal (shu-zumi). Effort S to M. Emulator: yes.
**What to change:** at `completeLesson()`, before the seal:
1. Redraw the master's strokes as thin vermilion ribbons over your black ink, for a side-by-side comparison.
2. Draw a vermilion circle (or a partial circle) beside the best stroke.
3. Draw a small vermilion tick at the point of largest deviation on the weakest stroke, with its hint as the caption: "Here: carry the stroke to its end."
4. Then the seal lands.

Keep it to one correction. On a perfect page, show only circles.

**Why:**
- This is how Japanese teachers actually correct. They mark the student's sheet in cinnabar (red-orange) ink, writing over or beside the strokes. They draw circles to praise what is good, and arrows for changes in placement ([Beyond Calligraphy](https://beyond-calligraphy.com/?p=10636), [Baikei FAQ](https://baikei.org/faq.html)).
- Arabic masters do the same: they write the correct form under each of the student's letters ([Asian Art Museum](https://education.asianart.org/resources/becoming-a-master-islamic-calligrapher)).
- In motor learning:
  - Feedback after the attempt ("terminal") outlasts feedback during it ("concurrent"), whose gains are lost once it is removed ([Sigrist et al. 2013](https://pubmed.ncbi.nlm.nih.gov/24533493/), [J Mot Behav 2013](https://typeset.io/pdf/terminal-feedback-outperforms-concurrent-visual-auditory-and-2azidldbq5.pdf)).
  - For novices, prescriptive feedback about the movement ("knowledge of performance": what to change) beats feedback about the outcome alone ("knowledge of results"). The combination is best ([KP vs KR systematic review 2021](https://informahealthcare.com/doi/full/10.1080/1750984X.2021.1986849)).
- The app already writes the master's ink in vermilion, so this matches its own art direction.
- Caution: some Japanese viewers read red-orange marks as failure ([Beyond Calligraphy](https://beyond-calligraphy.com/?p=10636)). Lead with the circles and keep corrections few.

### 4. Piano: make the beat visible and audible. Effort S. Emulator: yes.
**What to change:**
- Before the learner's turn, play a count-in: two soft wood-block ticks at the song's tempo, with "ready, play".
- In play mode, the expected key's breathing glow (`piano-mode.ts`, "The expected key breathes") is currently a free 5 rad/s sine. Instead, make it **pulse exactly when the note is due** (`lastPress + beats × beatSeconds`). The key becomes the metronome.
- Optional quiet tick on each beat. Make it a menu toggle, off by default for "your tune".
- Name the rhythm on the music sheet: long notes are drawn longer, and half beats are paired.

**Why:**
- In the CHI 2026 study, adaptive visibility improved pitch and fingering but **not timing**. The authors explicitly recommend adding rhythm cues ([arXiv](https://arxiv.org/html/2603.06253v1)).
- Rhythm is 35% of our score, but the learner gets no cue for where the beat is.
- Dalcroze and Kodály teach rhythm through the body and the ear before notation ([Dalcroze Society of America](https://dalcrozeusa.org/about-dalcroze/what-is-dalcroze/), [Wikipedia: Eurhythmics](https://en.wikipedia.com/wiki/Eurhythmics)).
- Putting the cue on the key itself is an external focus of attention (the effect of the movement, not the body), which helps learning ([Wulf & Lewthwaite 2021, OPTIMAL](https://gwulf.faculty.unlv.edu/wp-content/uploads/2021/11/Wulf_Lewthwaite_OPTIMAL_Current_Directions_2021.pdf)).

**Later (M):** a "tap the rhythm" pass before each phrase, where you tap any key with the master, so pitch and rhythm are learned separately *(inference, after Dalcroze's rhythm-first idea)*.

### 5. Piano: finger numbers and a home hand position. Effort S (display), M (detection). Emulator: display yes; finger detection only partly.
**What to change:**
1. Add `finger?: number` (1 to 5) to `PianoNote`. Fill it in automatically for five-finger songs (finger = semitone position in the hand's five white keys + 1). Hand-annotate Für Elise and Happy Birthday.
2. Draw the finger number above the glowing key and under the note on the sheet.
3. At the start of each song, faintly light the five "home" keys with ghost numbers 1 to 5, captioned "Thumb on C. One finger per key."
4. Optional (M): you know which tip pressed (`detectPress` loops over fingertip index `f`). Record mismatches and give **one** prescriptive note at the end ("Try finger 3 on E"), never during play.

**Why:**
- Finger numbers and a five-finger position are the first things beginner methods teach. Thumb = 1; right-hand thumb on middle C ([Skoove](https://www.skoove.com/blog/finger-positions-four-piano-finger-exercises-that-will-set-you-on-your-way/), [Piano Dao on five-finger positions](https://pianodao.com/2025/03/23/the-importance-of-five-note-hand-positions/)).
- Faber's Unit 1 teaches the rounded hand ("Blooming Flowers") and firm fingertips ([Primer Guide](https://primerguide.pianoadventures.com/units/two-black-ants/)).
- The CHI study scored fingering (1 for the right finger, 0.5 for a neighbour), and fingering is where the adaptive ghost gained most ([arXiv](https://arxiv.org/html/2603.06253v1)).
- Today a learner can play the whole ladder with one index finger. A judge who plays piano will notice *(inference)*.

**Risks:**
- Quest 3 fingertip error is about 1.7 cm, with about 1.1 cm of jitter ([Godden et al., robotic study](https://ericg5.github.io/ResearchPortfolio/papers/characterization)). Reading which finger pressed may be unreliable, so feedback on it should be gentle and given only at the end.
- Posing the ghost hand with a different finger extended needs a new pose in `ghost-pose.ts`. That is L, so save it for after the deadline.

### 6. Calligraphy: show the apprenticeship ladder (trace, follow, copy, from memory). Effort S. Emulator: yes.
**What to change:**
- Name the stages the adaptive guide already passes through. Show the stage on the caption eyebrow, and add one caption line when you move up a stage:
  1. **Trace**: ghost plus outline. This is 描红, tracing over red characters.
  2. **Follow**: ghost only, no outline. This is 摹, tracing through thin paper.
  3. **Copy**: the master writes the whole character once, it fades, then you write with only the start points shown. This is 临, copying beside the model.
  4. **From memory**: no demo, no guide, then the vermilion comparison from item 3. This is 写.
- Optionally frame the ladder as Shu, Ha, Ri: "obey", "break away", "leave".

**Why:**
- This is the traditional order of copybook learning:
  - 描红 (filling in red characters);
  - 摹 (tracing through thin paper);
  - 临 (copying beside the model, with more characters over time);
  - 写 (studying the model, putting it away, and writing from memory).

  Sources: [Chinese Notes: copying](https://chinesenotes.com/calligraphy_copying.html), [Ding Shimei, practice process](https://www.skyren-art.com/dingshimei/english-articles/126-process-of-practicing-handwriting.html).
- Shu-ha-ri is the Japanese arts' own name for the stages of mastery ([Wikipedia: Shuhari](https://en.wikipedia.org/wiki/Shuhari)).
- In YouMove, stages that gradually reduce guidance roughly doubled learning and short-term retention compared with video ([Anderson et al., UIST 2013](https://www.research.autodesk.com/publications/youmove-enhancing-movement-training-with-an-augmented-reality-mirror/)).
- For judges, it turns "the ghost fades" into a story they can follow and a reason to come back (Best Reason to Come Back award).

### 7. Fewer, better-timed words: bandwidth and faded feedback. Effort S. Emulator: yes.
**What to change** (in `scoring.ts` and the stroke-result caption):
- **Bandwidth:** when a stroke passes and no check is near its limit, show the verdict only ("Good."), with no hint and no points. Give a hint only when a measure is outside its tolerance.
- **Fading:** as `skill()` rises, drop the per-stroke points. Show the per-stroke breakdown once, at the seal.
- **Self-controlled:** keep "Watch again", and add "Show me that stroke" after a failed stroke, so the learner chooses when to see the demonstration again.
- **Keep the pass bar lenient** for the first attempt of every lesson.

**Why:**
- Feedback only when error exceeds a tolerance band produced better learning and more stable performance ([Lee & Carnahan 1990, via record](https://data.zhenzhi.com/details/1/1002106830/1/2); [Sherwood 1988](https://vivo.colorado.edu/display/pubid_105370)).
- Feedback on every trial produces worse retention than reduced feedback ([guidance hypothesis review](https://pmc.ncbi.nlm.nih.gov/articles/PMC7205416); [mixed replications noted here](https://orbilu.uni.lu/bitstream/10993/4589/1/Publikation_Marschall_Bund_Wiemeyer_2007_EJournal%20Bewegung%20und%20Training.PDF)).
- Learners who choose when to get feedback learn better, and they mostly ask for it after good trials ([Chiviacowsky, Wulf & Lewthwaite 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3487418)).
- A lenient definition of "good" (30 ms) gave higher perceived competence and better retention than a strict one (4 ms) ([same study](https://www.frontiersin.org/articles/10.3389/fpsyg.2012.00458/full)).

### 8. 永: name each stroke with its classical image, and teach press, travel, lift. Effort S. Emulator: yes.
**What to change:**
- In `lessons.ts`, give the strokes of 永 the Eight Principles names and Li Puguang's images. Use them in "Next: …" captions. My mapping of principles to the five strokes is my own inference from standard diagrams:
  1. Dot, 側, "a strange stone".
  2. Horizontal, then vertical, then hook: 勒 "jade table", 努 "iron pillar", 趯 "crab's pincer".
  3. Rising flick and long sweep: 策 "tiger's tooth", 掠 "rhinoceros horn".
  4. Short sweep: 啄 "a bird pecking".
  5. Right fall: 磔 "golden knife". It thickens toward the end.
- For every lesson, a three-word stroke cue: **"press in, travel, lift out"** (起笔, 行笔, 收笔).
- Optionally make the ink ribbon a little wider for the first few millimetres of each stroke, so the pressed entry shows.

**Why:**
- The Eight Principles and their names come from [Wikipedia: Eight Principles of Yong](https://en.wikipedia.org/wiki/Eight_Principles_of_Yong).
- Brushwork is taught as start, travel and finish, with alternating lift and press as the core skill ([Chinese Notes: strokes](https://chinesenotes.com/analysis/calligraphy_strokes_analysis.html), [CSU intro to calligraphy](https://pressbooks.ulib.csuohio.edu/intro-to-chinese-calligraphy/?p=141)).
- Beginners focus on shape and neglect brush control. That is the gap CalliSense was built to address ([CalliSense](https://arxiv.org/html/2502.15883v1)).
- Images like "a bird pecking" point attention at the mark, not the hand. That is an external focus ([OPTIMAL](https://gwulf.faculty.unlv.edu/wp-content/uploads/2021/11/Wulf_Lewthwaite_OPTIMAL_Current_Directions_2021.pdf)).

### 9. Piano: a "twos and threes" geography lesson, and landmark captions. Effort S. Emulator: yes.
**What to change:**
- Add a short song after Happy Birthday: touch each group of two black keys (Cs4 Ds4, Cs5 Ds5), then each group of three (Fs4 Gs4 As4), as a call and response.
- In the white-keys lesson, add: "C sits just left of the two black keys. F sits just left of the three."
- In the sharps and flats lessons, keep the current "no black key between E and F" line.

**Why:**
- Faber's Unit 1 introduces the 2- and 3-black-key groups as the student's first keyboard geography, played as patterns with fingers 2-3 and 2-3-4 ([Primer Guide](https://primerguide.pianoadventures.com/units/two-black-ants/)).
- Every C is just left of a two-key group ([Alfred](https://content.alfred.com/catpages/00-40150.pdf)), and every F just left of a three-key group ([flowkey](https://flowkey.com/en/piano-guide/start-playing)).
- Black keys are also the easiest targets for 1.7 cm hand tracking, because they are raised and separated *(inference)*.

### 10. Let the master play with you: a duet when you finish. Effort S to M. Emulator: audio only.
**What to change:**
- When a song is completed, add **"Play it together"**. The learner plays the melody in wait mode while the master adds one sampled bass note (the chord root) on each bar's first beat, an octave lower. The sampler already exists.
- Store the roots as `bass?: string[]` per bar in `songs.ts`. For example, Ode to Joy in C: C C G C | C C G-C.
- For Frère Jacques, the master can instead enter as a **round** two bars behind you. Doing this needs no harmony data.

**Why:**
- Teacher duets are standard in primer books, as motivation and as rhythm training ([Piano Adventures Primer](https://pianoadventures.com/piano-books/basic-piano-adventures/primer/things-to-know/), [teacher's view](https://lessonsinyourhome.net/?p=1334)).
- Making music with the master is the emotional peak of an apprenticeship, and it shows judges the "master" is more than a cursor *(inference)*.

**Also cheap, not in the top 10:**
- **A breathing cue in calligraphy:** "Breathe out as the brush travels." Sync the ghost's breathing animation to it. Teachers tie breath to the stroke, and holding the breath makes strokes jagged ([Chosei Zen](https://choseizen.org/calligraphy), [Kids Web Japan posture](https://web-japan.org/kidsweb/virtual/shodo/shodo02.html)). S.
- **A warm-up review on return:** start each session with one already-passed character or phrase before new material. This uses spacing and interleaving; see the motor-learning section. S.
- **Enhanced expectancies:** one line before the first attempt, "Most people get this on the second try." Expectations of success improve learning ([OPTIMAL](https://gwulf.faculty.unlv.edu/wp-content/uploads/2021/11/Wulf_Lewthwaite_OPTIMAL_Current_Directions_2021.pdf)). S.

---

## 1. Piano pedagogy for absolute beginners

**Keyboard geography comes first.**
- Faber Primer Unit 1 teaches the black-key groups (2s and 3s), played in patterns with a rounded hand, before any letter names ([Primer Guide](https://primerguide.pianoadventures.com/units/two-black-ants/)).
- Letter names hang off the groups: C is left of the twos, F left of the threes ([Alfred](https://content.alfred.com/catpages/00-40150.pdf), [flowkey](https://flowkey.com/en/piano-guide/start-playing)).
- **Our app:** the ladder jumps from Happy Birthday to all the white keys. Recommendation 9 adds the geography step.

**Finger numbers and hand position.**
- Thumb = 1, little finger = 5. The common first position is "C position" (right-hand thumb on middle C), so whole songs need no hand shifts ([Skoove](https://www.skoove.com/blog/finger-positions-four-piano-finger-exercises-that-will-set-you-on-your-way/), [Lessons in Your Home](https://lessonsinyourhome.net/blog/learning-c-position-piano)).
- There are two traditions: the "middle C" approach (John Thompson, 1936) and the "multiple key" approach ([USP teaching document](https://edisciplinas.usp.br/mod/resource/view.php?id=4850213)). Five-finger positions build finger independence ([Piano Dao](https://pianodao.com/2025/03/23/the-importance-of-five-note-hand-positions/)).
- **Our app:** has no finger numbers; recommendation 5 adds them.

**Hand shape and touch.** Faber's "Technique Secrets" are good posture, a rounded hand and firm fingertips ("Making O's"). Fingertips tend to collapse in soft playing ([Primer Guide](https://primerguide.pianoadventures.com/units/two-black-ants/)). Our ghost could model a rounded hand once it uses more than one finger (after the deadline).

**Ear before eye.**
- Suzuki students learn by listening to recordings before reading, much as a child learns its mother tongue. Daily listening is central. The Twinkle variations break rhythms into small units ([Suzuki notes](https://core.ecu.edu/wilburnk/SuzukiPianoBasics/KataokaSensei/HTB.htm), [Wikipedia: Suzuki method](https://akarinohon.com/text/taketori.cgi/en.wikipedia.org/w/index.php%253Ftitle=Suzuki_method&oldid=1201281107)).
- Gordon's Music Learning Theory is "sound before sight": hear it internally, then play it ([Symposium](https://symposium.music.org/volume-31/forum-essays-1752877059/music-learning-theory-in-collegiate-music-education)).
- Faber uses echo patterns: the teacher plays with eyes closed, and the student plays it back ([Primer Guide](https://primerguide.pianoadventures.com/units/two-black-ants/)).
- **Our app:** the master playing first is already right. Making it phrase by phrase is recommendation 2.

**Rhythm through the body.**
- Dalcroze introduces a concept through movement before its notation, and starts with rhythm because movement is natural ([Dalcroze USA](https://dalcrozeusa.org/about-dalcroze/what-is-dalcroze/), [Wikipedia](https://en.wikipedia.com/wiki/Eurhythmics)).
- Kodály puts solmization before notation ([Wikipedia: Dalcroze](https://en.wikipedia.com/wiki/Dalcroze)).
- **Our app:** the key glow can act as a body-level pulse (recommendation 4).

**Practising well.** The best practisers isolate the hard spot, fix errors immediately, and keep a high proportion of correct trials ([Duke et al. 2009](https://www.structural-learning.com/research-briefings/practise-the-hard-bit), [Music Mark summary](https://musicmark.org.uk/news/8-things-top-practicers-do-differently)). This supports wait mode (no practising wrong notes) plus replaying only the phrase that went wrong.

**What makes a first lesson stick** *(inference from the above)*:
- a real tune within minutes (Happy Birthday);
- one new idea per step;
- hearing it before playing it;
- making music with the teacher (a duet);
- ending on a success.

---

## 2. Calligraphy pedagogy

**Copybook stages.**
- The stages run 描红 (fill in red), 摹 (trace through thin paper), 临 (copy beside the model), 写 (from memory) ([Chinese Notes](https://chinesenotes.com/calligraphy_copying.html), [Ding Shimei](https://www.skyren-art.com/dingshimei/english-articles/126-process-of-practicing-handwriting.html)).
- Historically the tutor demonstrates how to move the brush and tests the grip by trying to pull the brush away ([Chinese Notes](https://chinesenotes.com/calligraphy_copying.html)).
- **Our app:** covers the first two stages well. Recommendation 6 adds copy and from-memory stages.

**The Eight Principles of Yong (永字八法).** The eight basic regular-script strokes are all present in 永, with Tang-era names and Li Puguang's images:
- 側 dot, "strange stone";
- 勒 horizontal, "jade table";
- 努 vertical, "iron pillar";
- 趯 hook, "crab's pincer";
- 策 rising flick, "tiger's tooth";
- 掠 long sweep, "rhinoceros horn";
- 啄 short sweep, "bird pecking";
- 磔 right fall, "golden knife".

Source: [Wikipedia](https://en.wikipedia.org/wiki/Eight_Principles_of_Yong). The app ends on 永 but uses generic stroke names ("left sweep"); recommendation 8 adds the classical names.

**Brush technique.**
- Each stroke has a start (起笔), travel (行笔) and finish (收笔). Many strokes begin with a reverse entry and end with a returning tip (回锋). Lift and press (提按) control width and are the most basic skill ([Chinese Notes glossary](https://chinesenotes.com/analysis/calligraphy_strokes_analysis.html), [CSU](https://pressbooks.ulib.csuohio.edu/intro-to-chinese-calligraphy/?p=141)).
- Our width-from-speed ink is a reasonable proxy. Fingertip height above the desk could act as press and lift, but tracking error of about 1 cm makes that unreliable *(inference)*.

**Posture and breath.**
- Sit straight with shoulders relaxed. Hold the brush vertical, lightly, with thumb, index and middle finger ([Kids Web Japan](https://web-japan.org/kidsweb/virtual/shodo/shodo02.html), [Migaku](https://migaku.com/blog/japanese/japanese-calligraphy)).
- Breathe out while the brush moves and in when it lifts. Teachers differ slightly on this ([Chosei Zen](https://choseizen.org/calligraphy), [Kamboku](https://kamboku.blogspot.com/2010/09/elements-of-practice.html)).

**How masters correct.**
- **Japan:** cinnabar or red-orange ink over or beside the student's strokes; circles for good work; arrows for placement ([Beyond Calligraphy](https://beyond-calligraphy.com/?p=10636), [Baikei](https://baikei.org/faq.html)). A Tsukuba thesis describes shodō practice as a cycle of observing the model, writing, and receiving correction ([Tsukuba](https://tsukuba.repo.nii.ac.jp/record/2006660/files/M048495.pdf)).
- **Arabic:** the master writes a model (*meşk*), the student copies it weekly in *mashq* books, and the master writes the correct form under each letter. After years, an *ijazah* (licence) is signed by the master, linking the student into a lineage ([Asian Art Museum](https://education.asianart.org/resources/becoming-a-master-islamic-calligrapher), [Notes on Paper](https://notesonpaper.substack.com/p/the-craft-of-the-reed-a-deep-dive), [Library of Congress](https://www.loc.gov/item/2019714485)).
- **Our app:** recommendation 3 adds the vermilion correction; an *ijazah*-style certificate is an idea for after the deadline.

**Research tools.**
- CalliSense found that beginners focus on shape and neglect brush control ([arXiv](https://arxiv.org/html/2502.15883v1)).
- A sponge between brush and surface sped up novice learning in VR ([IwC](https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_crossref_primary_10_1093_iwc_iwad041)). Touching the real desk gives us similar passive haptics.
- A motion plotter that guided the hand beat video for depth variation ([MIT](https://dspace.mit.edu/handle/1721.1/155195)).
- I found no peer-reviewed hands-only (no controller) VR calligraphy tutor. This is consistent with JUDGING.md's lane check.

---

## 3. Motor learning science

**Guidance hypothesis and faded feedback.**
- Too-frequent or too-easy guidance helps performance during practice but harms retention.
- 50% knowledge of results beat 100% in Winstein and Schmidt (1990), and physical guidance given at high frequency was worst for retention ([PMC7205416](https://pmc.ncbi.nlm.nih.gov/articles/PMC7205416), [NAU 1994](https://experts.nau.edu/en/publications/effects-of-physical-guidance-and-knowledge-of-results-on-motor-le/)).
- Replications are mixed ([Marschall et al. 2007](https://orbilu.uni.lu/bitstream/10993/4589/1/Publikation_Marschall_Bund_Wiemeyer_2007_EJournal%20Bewegung%20und%20Training.PDF)).
- **For us:** fade the ghost (recommendation 1) and the words (recommendation 7).

**Bandwidth knowledge of results.** Feedback only when error is outside a tolerance band supports learning and stabilises performance ([Sherwood 1988](https://vivo.colorado.edu/display/pubid_105370), [Lee & Carnahan 1990](https://data.zhenzhi.com/details/1/1002106830/1/2)). Too many bands at once overload the learner ([Lucas et al.](https://repositorio.ufmg.br/bitstream/1843/41055/2/Effects%20of%20bandwidth%20knowledge%20of%20results%20by%20components%20in%20learning%20a%20sequential%20motor%20task.pdf)). **For us:** one hint at most, only when out of band.

**Knowledge of results vs knowledge of performance, and terminal vs concurrent feedback.**
- For novices, prescriptive feedback about the movement plus outcome feedback works best, and outcome feedback alone beats a mere description of the movement ([2021 systematic review](https://informahealthcare.com/doi/full/10.1080/1750984X.2021.1986849)).
- Concurrent feedback helps during practice but is lost when removed; terminal feedback did better in a complex task ([Sigrist et al. 2013](https://typeset.io/pdf/terminal-feedback-outperforms-concurrent-visual-auditory-and-2azidldbq5.pdf), [review](https://pubmed.ncbi.nlm.nih.gov/24533493/)).
- **For us:** the gold lock-in is concurrent, so let it fade with skill. Put the corrections at the end (recommendation 3).

**Observational learning.**
- Mixing watching and doing beats watching only before or only after physical practice ([UBC Motor Skills Lab](https://msl.kin.educ.ubc.ca/outreach/501), [Karlinsky 2019](https://msl.kin.educ.ubc.ca/sites/default/files/publication-files/Karlinsky_HMS2019_website.pdf)).
- **For us:** alternate a short demonstration and an attempt, phrase by phrase or stroke by stroke. Avoid one long demonstration followed by one long attempt.

**Errorless learning.**
- Reducing errors early encourages implicit learning, which holds up under distraction ([Maxwell et al. 2001](https://research.birmingham.ac.uk/en/publications/the-implicit-benefit-of-learning-without-errors)). The benefit is shown in children and older adults, but one fine-motor replication failed ([Frontiers 2025](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1685720/full), [JEMS](https://scapps.org/jems/index.php/1/article/view/231)).
- **For us:** wait mode and the glowing next key are errorless by design. Keep the first lesson very easy.

**Part vs whole practice.**
- The Naylor and Briggs rule: use parts for complex, loosely organised tasks, and the whole for tightly organised ones. A meta-analysis found only trends in that direction ([Fontana et al. 2009](https://www.bohrium.com/en/paper-details/whole-and-part-practice-a-meta-analysis/811736563548422146-6897), [course summary](https://drfurtado.github.io/kin377/ch18/index.html)).
- **For us:** melodies are serial, so practise them in progressive parts. A calligraphy stroke is one continuous action, so keep each stroke whole. Practise the *character* stroke by stroke, which we already do.

**Contextual interference (interleaving) and spacing.**
- Random practice order loses to blocked practice during acquisition but wins on retention ([Shea & Morgan 1979](https://Www.Gwern.net/doc/psychology/spaced-repetition/1979-shea.pdf)). The effect is not universal ([UBC wiki](https://wiki.ubc.ca/Course:KIN366/ConceptLibrary/Contextual_Interference)).
- Sleep after practice improved finger-sequence speed in [Walker et al. 2002](https://walkerlab.berkeley.edu/reprints/Walker%20et%20al._Neuron_2002.pdf). Later work suggests sleep stabilises the skill rather than enhancing it ([Rickard et al. 2008](https://mechanism.ucsd.edu/bill/teaching/f16/cogs200/2008%20-%20Rickard%20et%20al%20-%20sleep%20and%20motor%20learning.pdf)).
- **For us:** a warm-up review on return, and mixing earlier characters into later sessions. "Come back tomorrow" is supported, but don't claim sleep makes you better.

**Self-controlled feedback and competence.** Learners mostly ask for feedback after good trials. Removing their chance to feel competent (a strict success criterion) cancels the benefit of self-control ([Chiviacowsky et al. 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3487418)).

**External focus, expectancies and autonomy (OPTIMAL theory).** Each of the three independently improves performance and learning ([Wulf & Lewthwaite 2021](https://gwulf.faculty.unlv.edu/wp-content/uploads/2021/11/Wulf_Lewthwaite_OPTIMAL_Current_Directions_2021.pdf), [UNLV](https://gwulf.faculty.unlv.edu/optimal-motor-learning/)). **For us:**
- word hints about the ink, path and key, not about joints;
- tell learners they can succeed;
- offer choices: song order, tempo, guide mode (already there), "show me that stroke".

**Sound as feedback.** Mapping writing speed to a chalk-like rubbing sound improved fluency in small studies ([Danna et al. 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4335466), [review](https://www.frontiersin.org/articles/10.3389/fpsyg.2015.00169/pdf)). Our speed-following paper "scratch" is backed by this.

---

## 4. VR and MR learning research and products

**Ghost and co-located expert hands.**
- **"Just Follow Me"** (Yang & Kim 2002): a first-person ghost overlaid on your body, which you try to match ([summary](https://scrapbox.io/DancePedia/Implementation%20and%20Evaluation%20of%20%22Just%20Follow%20Me%22:%20An%20Immersive,%20VR-Based,%20Motion-Training%20System)).
- **YouMove:** an AR mirror with staged reduction of guidance; about 2× better learning and retention than video ([Autodesk](https://www.research.autodesk.com/publications/youmove-enhancing-movement-training-with-an-augmented-reality-mirror/)).
- **Skill-adaptive ghost (CHI 2026):** piano on a desk-aligned keyboard with Quest 3 hand tracking. Results are in recommendation 1 ([arXiv](https://arxiv.org/html/2603.06253v1)). The closest prior art to our piano. They used a recorded instructor (one author) and a fully virtual scene, not passthrough.
- **Virtual co-embodiment** (Kodama et al. 2023): one avatar driven by a weighted average of teacher and learner. It beat both learning alone and the first-person ghost ([Univ. of Tokyo](https://www.cyber.t.u-tokyo.ac.jp/en/projects/ghost_engineering/virtual_co_embodiment), [summary](https://katalog.dhi-paris.fr/vufind/Record/NLM355323931/Description)).
  - Our gold lock-in, which blends the ghost onto your hand, is a form of co-embodiment. Say so in the submission.
  - A shared-hand study found less time delay with the shared hand ([IEEE Access 2023](https://doaj.org/article/b88747599ed5455cb692212843e62c2e)).

**Hand tracking limits.**
- **Quest 3:** about 1.73 cm fingertip error and 1.11 cm jitter in the best robotic test conditions. Knuckles are tracked better than fingertips ([Godden et al.](https://ericg5.github.io/ResearchPortfolio/papers/characterization)).
- **Quest 2:** about 1.1 cm fingertip error and 45 ms latency ([Abdlkarim et al.](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10830632/)).
- **For us:** 30 mm keys and a 2.4 cm lock radius are sensible. Avoid strict finger-identity or press-depth judgements.

**Products and what users say.**

| Product | What it does | Praise | Complaints | What it does that we don't |
|---|---|---|---|---|
| **PianoVision** (Quest) | Falling notes over a real or virtual keyboard; MIDI or hand tracking; a "virtual piano on a flat surface" mode; automated fingering; custom import with sectioning | Mixed reality over a real piano is useful ([MusicRadar](https://musicradar.com/news/pianovision-ar-learning-app), [SideQuest](https://sidequestvr.com/app/10223)) | Hand tracking on the virtual keyboard is imprecise ("a demo rather than a practice tool"); doesn't build reading; subscription for popular songs; Quest store rating about 3.1 ([pianoers 2026](https://pianoers.com/pianovision-review/), [Reality Remake](https://realityremake.com/articles/tag/PianoVision), [vrdb](https://vrdb.app/game/5271074762922599)) | Fingering, sectioning, MIDI keyboard input |
| **Flowkey** | Video of real hands with notation; wait mode; loop; 50%/75% speed; hands separate | Wait mode "genius for beginners"; feels musical ([pianoers](https://pianoers.com/flowkey-review/), [Yamaha Hub](https://hub.yamaha.com/?p=41160)) | Feedback too forgiving; having to take hands off the keys to repeat a section ([MusicRadar](https://www.musicradar.com/reviews/flowkey-review)) | Loop a section, hands-separate practice |
| **Simply Piano** | Gamified path, quick recognisable tunes, streaks | Great at hooking beginners ([MusicRadar](https://www.musicradar.com/reviews/simply-piano-review)) | Repetitive, plateaus, heavily simplified arrangements ([American Songwriter](https://americansongwriter.com/simply-piano-review/), [Pianist's Compass](https://pianistscompass.com/?p=9588)) | Accompaniment and backing *(inference: reviews did not confirm this)* |
| **Teomirn** (HoloLens, about 2017) | Holographic hands over a real piano; two practice modes ([UploadVR](https://uploadvr.com/teomirn-mixed-reality-app-teaches-play-piano)) | n/a | Depends on its content library | The ghost-hands-on-piano idea predates us; our difference is the calligraphy and piano apprenticeship on your own desk |
| **Synthesia-style falling notes** | Notes fall toward the keys; wait mode | n/a | Not reviewed here *(the description is common knowledge, not sourced)* | We use a music sheet plus a glowing key instead |

**Lessons for us:**
- **Keep "repeat" and "next" pokeable without leaving the keys.** Flowkey users complain about this. Repeating a phrase automatically (recommendation 2) solves it.
- **Don't oversell hand-tracked piano.** Present it as learning the melody and the keyboard, not technique. Recommendation 5 adds finger numbers in a hedged way.
- **Sectioning and fingering are table stakes** in PianoVision. Recommendations 2 and 5 close that gap cheaply.

---

## 5. Motivation and emotional design

**Competence first.** A lenient success bar raised perceived competence and learning ([Chiviacowsky 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3487418)), and enhanced expectancies independently help learning ([OPTIMAL](https://gwulf.faculty.unlv.edu/wp-content/uploads/2021/11/Wulf_Lewthwaite_OPTIMAL_Current_Directions_2021.pdf)). The first gold lock-in within 90 seconds is exactly right; protect it.

**Streaks.**
- A streak drives repeat use, but it is a different thing from a real habit or the value of learning ([Lund thesis](https://lup.lub.lu.se/student-papers/record/9238652/file/9238707.pdf)).
- Gamification pressure can erode intrinsic motivation ([Utrecht thesis](https://studenttheses.uu.nl/handle/20.500.12932/48993)). These are student theses, so the evidence is weak.
- **For us:** keep the streak quiet (a line on the seal card), and never show a "streak lost" penalty.

**Endowed progress.** People given a head start on a goal (2 of 10 stamps pre-filled) completed it far more often ([Nunes & Drèze 2006, summary](https://www.renascence.io/behavioral-biases/endowed-progress-effect)). **For us** *(inference)*: show the ladder as a row of seals, with the first seal already stamped after Happy Birthday or 一.

**Apprenticeship framing.**
- Shu-ha-ri gives a calm, non-gamified progression ([Wikipedia](https://en.wikipedia.org/wiki/Shuhari)).
- The *ijazah*, a master's signed permission, is a dignified reward *(inference: as a design use)* ([Curationist](https://www.curationist.org/editorial-features/article/islamic-calligraphy:-reverential-roots-and-decorative-uses)).
- Teacher duets motivate ([Faber](https://pianoadventures.com/piano-books/basic-piano-adventures/primer/things-to-know/)).

**Ritual** *(inference, consistent with sources on shodō posture and breath)*. A three-second opening ritual before writing: sit up, one breath out, "begin". The seal at the end closes the ritual. This gives calm without clutter, fitting the Productivity track's "habits tied to a recurring context".

---

## 6. Public-domain melodies within A3 to E5

Notes are in `songs.ts` `seq()` format, with beats as quarter notes.
- **Copyright:** these melodies are traditional or by composers long dead. We use only the melody (no lyrics or arrangements), which avoids lyric copyright *(inference; not legal advice)*.
- **Happy Birthday** is confirmed public domain after the 2016 settlement and ruling ([Engadget](https://www.engadget.com/2016/02/09/happy-birthday-song-settlement/), [ClickOnDetroit](https://www.clickondetroit.com/news/2016/06/28/happy-birthday-song-becomes-public-domain-judge-rules)).
- **Avoid "Furusato":** I could not confirm its public-domain status. The composer died in 1941, but the lyricist's date is unknown ([Wikipedia](https://en.wikipedia.org/wiki/Furusato_(children%27s_song))).

| Melody | Origin | Skill it teaches | Suggested notes / range |
|---|---|---|---|
| **Hot Cross Buns** | English traditional | Three notes, fingers 3-2-1; quarter vs eighth notes | `E4 D4 C4:2 E4 D4 C4:2 C4:0.5 C4:0.5 C4:0.5 C4:0.5 D4:0.5 D4:0.5 D4:0.5 D4:0.5 E4 D4 C4:2` |
| **Mary Had a Little Lamb** | 19th-century US | Three-to-four-note five-finger position; repeated notes; steady pulse | `E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4` |
| **Au clair de la lune** | French, 18th century | Five-finger C position; half notes | `C4 C4 C4 D4 E4:2 D4:2 C4 E4 D4 D4 C4:4` |
| **Frère Jacques / Two Tigers (两只老虎)** | French traditional; known in China as Two Tigers ([Wikipedia](https://en.wikipedia.org/wiki/Two_Tigers_(nursery_rhyme))) and in Japan | Eighth notes; **a round with the master** (recommendation 10). In F to stay above A3 | `F4 G4 A4 F4 F4 G4 A4 F4 A4 As4 C5:2 A4 As4 C5:2 C5:0.5 D5:0.5 C5:0.5 As4:0.5 A4 F4 C5:0.5 D5:0.5 C5:0.5 As4:0.5 A4 F4 F4 C4 F4:2 F4 C4 F4:2` |
| **Jingle Bells** (chorus) | Pierpont, 1857 | Repeated notes; a dotted rhythm; a joyful early win | `E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:0.5 E4:4 F4 F4 F4:1.5 F4:0.5 F4 E4 E4 E4:0.5 E4:0.5 E4 D4 D4 E4 D4:2 G4:2` |
| **Ode to Joy** (have) | Beethoven, 1824 | Stepwise motion; the dotted ending | already in `songs.ts` |
| **Amazing Grace** | "New Britain" tune, 1830s | **3/4 time**; pickup note; leaps. In F (B-flat) | transcribe from a public-domain hymnal; range C4 to D5 *(I did not verify the notes)* |
| **Brahms' Lullaby** | Brahms, 1868 | 3/4; gentle leaps; legato; a calming close | in C, range E4 to E5 *(transcribe and verify)* |
| **Minuet in G** | Petzold, about 1725 (Anna Magdalena notebook) | **F-sharp as a key signature**; 3/4; real classical repertoire | first phrase `D5 G4:0.5 A4:0.5 B4:0.5 C5:0.5 D5 G4 G4` then continue *(verify)*; range Fs4 to E5 |
| **Auld Lang Syne** | Scottish traditional | Pentatonic; dotted rhythm; known worldwide; a New Year ritual | in F, range C4 to D5 *(transcribe and verify)* |
| **Mo Li Hua (茉莉花)** | Chinese, Qing era, pentatonic ([Wikipedia](https://en.wikipedia.org/wiki/Mo_Li_Hua)) | Pentatonic phrasing; ornaments simplified. Pairs with the Chinese calligraphy track | use a simplified public-domain folk version *(verify)* |
| **Arirang** | Korean traditional | 3/4 lilt; pentatonic | range C4 to C5 *(verify)* |
| **Sakura** (have) | Japanese traditional | Japanese scale; B3, the lowest note | already in `songs.ts` |
| **Für Elise** opening (have) | Beethoven | Alternating semitones (E5/Ds5); hand shift | already in `songs.ts` |
| **Largo, "New World" theme** | Dvořák, 1893 | Slow, expressive long notes; dynamics | transposed to C, range C4 to E5 *(verify)*. Use the melody only, not the later "Goin' Home" lyrics |
| **Black-key pentatonic improvisation** | — | Any black keys sound good together. A safe first improvisation, for "your tune" *(inference; common teacher practice, not sourced here)* | Cs4 Ds4 Fs4 Gs4 As4 Cs5 Ds5 |

**Suggested order** *(inference)*:
1. Happy Birthday.
2. Twos and threes.
3. Hot Cross Buns, then Mary Had a Little Lamb (five-finger position).
4. White keys.
5. Frère Jacques in F, as a round with the master.
6. Sharps, then flats.
7. Twinkle and Ode to Joy.
8. Minuet in G or Für Elise.
9. Sakura and Mo Li Hua.
10. Your tune.

---

## Ideas for after the deadline
- **A real master's motion.** Capture a pianist's and a calligrapher's 25-joint hand streams (`GhostHand.setJoints` already accepts them). Use a multi-finger ghost with real fingering and a rounded hand shape. The CHI study's instructor was an author recording on Quest ([arXiv](https://arxiv.org/html/2603.06253v1)).
- **A full copy stage (临).** The master writes in the left grid square, and you write in the right one, without tracing.
- **Proper co-embodiment.** A weighted-average hand: the master's share drops as you improve ([Kodama et al.](https://www.cyber.t.u-tokyo.ac.jp/en/projects/ghost_engineering/virtual_co_embodiment)).
- **A MIDI keyboard.** For learners with a real piano, use Web MIDI (Quest Browser support needs checking *(inference)*). This removes the main PianoVision complaint about hand-tracking precision.
- **A spaced-review scheduler.** Resurface characters and songs at growing intervals, and interleave old with new ([Shea & Morgan](https://Www.Gwern.net/doc/psychology/spaced-repetition/1979-shea.pdf)).
- **Two hands.** Left-hand drones and fifths, then simple two-hand songs.
- **Press and lift (提按).** Use fingertip height or pinch pressure, once tracking allows, so strokes swell and taper by pressure.
- **More scripts.** Hangul (the app's pipeline works for any stroke-ordered script). Devanagari, which needs a stroke-order data source *(inference)*. Arabic, which is right to left with a fixed nib angle, so it needs a different ink model *(inference)*.
- **An *ijazah*.** After all of 一 to 永 in both languages, the master signs a licence page you can save as an image.
- **A portfolio wall.** Every sealed page is kept, so you can see your own improvement over days (competence feedback).
- **The master's voice.** Short recorded lines from a real teacher, in place of captions where sound is on.
- **Sonified rhythm.** A soft breath or tick for calligraphy tempo, built on the handwriting sonification research ([Danna](https://pmc.ncbi.nlm.nih.gov/articles/PMC4335466)).
- **A study.** A small fixed-ghost vs adaptive-ghost comparison on calligraphy, the domain the CHI paper names as future work.
