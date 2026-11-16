import {
  createSystem,
  DomeGradient,
  Group,
  FollowBehavior,
  Follower,
  IBLTexture,
  Matrix4,
  type Object3D,
  PokeInteractable,
  Quaternion,
  RayInteractable,
  Vector3,
  VisibilityState,
  XRAnchor,
  XRPlane,
  type Entity,
  type UIKit,
  type UIKitMLAsset,
} from '@iwsdk/core';
import { OneEuroFilter3 } from './common/one-euro.js';
import { Sfx } from './common/sfx.js';
import {
  createDeskSet,
  HANKO_HOME,
  PAPER_D,
  PAPER_W,
  SEAL_X,
  SEAL_Z,
  STAMP_X,
  STAMP_Z,
  SURFACE_Y,
  type DeskSet,
} from './desk/desk.js';
import { GhostHand, JointBlender } from './ghost/ghost-hand.js';
import { GhostPoseBuilder, JOINT_COUNT, type Handedness } from './ghost/ghost-pose.js';
import { Sparks } from './fx/sparks.js';
import { type FingerTip, PianoMode } from './piano/piano-mode.js';
import { clearCustomSong, CUSTOM_ID, loadCustomSong, saveCustomSong, songFromMidi } from './piano/custom-song.js';
import { parsePreset, type Preset } from './presets.js';
import { SONGS, type PianoSong } from './piano/songs.js';
import { GOLD, GUIDE_COLOR, INK_COLOR, InkRibbon, VERMILION } from './ink/ink-ribbon.js';
import { Environment, SCENES } from './env/environment.js';
import { type Language, LANGUAGES, LESSON_SETS, LESSONS, type Lesson } from './lessons/lessons.js';
import { StrokePath } from './lessons/master-path.js';
import { PASS_SCORE, scoreStroke, type StrokeScore } from './lessons/scoring.js';
import {
  clearProgress,
  lessonProgress,
  loadProgress,
  markPracticeDay,
  saveProgress,
  type Progress,
} from './progress.js';

/**
 * Hands of a Master: the whole experience in one system.
 *
 * Flow in mixed reality:
 *   placing   find the real desk (detected table plane), else a virtual table
 *   watch     the master's ghost hand writes the character in vermilion
 *   calibrate touch the red seal once, so contact height matches this desk
 *   practice  stroke by stroke: the ghost leads, you follow with your fingertip
 *             on the paper; stay in step and your hands lock together in gold
 *   complete  the seal is stamped, the score saved, the next lesson offered
 * In the 2D browser page the master writes on a loop behind the start panel.
 *
 * Coordinates: "paper-local" is metres on the paper, origin at its centre,
 * x right, y up, z toward the writer.
 */

type Mode = 'demo2d' | 'placing' | 'watch' | 'calibrate' | 'practice' | 'complete' | 'piano';
type Craft = 'calligraphy' | 'piano';
type GuideMode = 'adaptive' | 'always' | 'off';
type PracticePhase = 'ready' | 'drawing' | 'cooldown';

interface Choreo {
  kind: 'move' | 'draw';
  dur: number;
  from?: [number, number, number];
  to?: [number, number, number];
  stroke?: number;
}

interface PokeButton {
  id: string;
  el: Object3D;
  panel: UIKitMLAsset;
  fn: () => void;
  depth: [number, number]; // last signed distance per hand
}

interface Fading {
  ribbon: InkRibbon;
  t: number;
  dur: number;
}

const TIP_CONTACT_Y = 0.0085; // fingertip joint centre when the pad touches paper
const HOVER_Y = 0.032;
const DOWN_H = 0.012;
const UP_H = 0.024;
const LOCK_DIST = 0.024;
const UNLOCK_DIST = 0.045;
const PLACE_TIMEOUT = 2.5;
const MENU_SCALE = 0.056; // 380 units -> 21 cm wide; 76-unit targets -> 43 mm
const CAPTION_SCALE = 0.085; // 520 units -> 44 cm wide; 25-unit body -> about 1 degree at 0.9 m
const BREAK_AFTER_S = 25 * 60;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * The IWSDK emulator's managed browser drops URL queries, so in dev builds a
 * shortcut can also come from sessionStorage ('hoam-preset', one shot; set by
 * tools/goto.mjs). On a headset, use the URL.
 */
function devPresetQuery(): string {
  if (!import.meta.env.DEV) return '';
  try {
    const q = sessionStorage.getItem('hoam-preset') ?? '';
    sessionStorage.removeItem('hoam-preset');
    return q;
  } catch {
    return '';
  }
}

export class CalligraphySystem extends createSystem({
  planes: { required: [XRPlane] },
}) {
  private mode: Mode = 'demo2d';
  private progress!: Progress;
  private sfx = new Sfx();

  // scene objects
  private desk!: DeskSet;
  private deskEntity!: Entity;
  private ghost!: GhostHand;
  private poses!: Record<Handedness, GhostPoseBuilder>;
  private blender = new JointBlender();
  private ghostJoints = new Float32Array(JOINT_COUNT * 16);
  private userJoints = new Float32Array(JOINT_COUNT * 16);
  private shownJoints = new Float32Array(JOINT_COUNT * 16);
  private welcome?: UIKitMLAsset;
  private menu?: UIKitMLAsset;
  private caption?: UIKitMLAsset;
  private welcomeEntity?: Entity;
  private menuEntity?: Entity;
  private captionEntity?: Entity;
  private anchored = false;
  private pokeButtons: PokeButton[] = [];
  private pokeTip = new Vector3();
  private lastTriggerId = '';
  private lastTriggerAt = 0;
  private captionActionsShown = false;
  private sparks = new Sparks();
  private sparkClock = 0;
  private craft: Craft = 'calligraphy';
  private language: Language = 'japanese';
  private env = new Environment(); // the place you practise in (real 360 photographs)
  private immersive = true; // surroundings on (false = your own room)
  private onRealDesk = false;
  private piano!: PianoMode;
  private tips: FingerTip[] = Array.from({ length: 10 }, () => ({ x: 0, y: 0, z: 0, valid: false, extended: false }));
  private handJoints = [new Float32Array(JOINT_COUNT * 16), new Float32Array(JOINT_COUNT * 16)];
  private calX = SEAL_X; // calibration target (moves beside the keyboard in piano mode)
  private calZ = SEAL_Z;
  private pianoHintAt = -10;
  /** The learner's own song (played to the master, or from a MIDI file). */
  private customSong: PianoSong | undefined = loadCustomSong();
  private midiInput?: HTMLInputElement;
  private status?: UIKitMLAsset; // body-locked card shown while finding the desk
  private statusEntity?: Entity;
  private textScale = 1;
  private sessionStart = 0;
  private breakShown = false;

  // lesson state
  private lessonIndex = LESSONS.length - 1;
  private lesson: Lesson = LESSONS[LESSONS.length - 1];
  private paths: StrokePath[] = [];
  private guideRibbons: InkRibbon[] = [];
  private demoRibbons: InkRibbon[] = [];
  private userRibbons: InkRibbon[] = [];
  private fading: Fading[] = [];
  private strokeIndex = 0;
  private strokeScores: number[] = [];
  private tempo = 0.6;
  private guideMode: GuideMode = 'adaptive';
  private calibrated = false;
  private surfaceOffset = 0;
  /** A shortcut from the URL (?state=...), applied once after placement. */
  private preset: Preset | undefined = parsePreset(location.search || devPresetQuery());

  // timing / choreography
  private clock = 0;
  private choreo: Choreo[] = [];
  private choreoIndex = 0;
  private choreoClock = 0;
  private restTip: [number, number, number] = [0.15, 0.07, 0.13];
  private ghostTip = new Vector3(0.15, 0.07, 0.13);
  private ghostLean = { x: 0, z: 0 };
  private demoLoopPause = 0;
  private placingClock = 0;
  private arrival = 1;
  private stampAnim = 1;
  private hankoAnim = -1; // seconds into the stamping move, -1 = idle

  // tracked fingertip (paper-local), filtered
  private tipFilter = new OneEuroFilter3();
  private tip = { x: 0, y: 0, z: 0 };
  private tipPrev = { x: 0, z: 0 };
  private tipSpeed = 0;
  private tipValid = false;
  private tipSource?: XRInputSource;
  private penDown = false;
  private width = 0.008;
  private jointSpaces = new WeakMap<XRInputSource, XRJointSpace[]>();

  // practice state
  private phase: PracticePhase = 'ready';
  private cooldown = 0;
  private current?: InkRibbon;
  private capX: number[] = [];
  private capZ: number[] = [];
  private capStart = 0;
  private ghostStrokeClock = 0;
  private syncTotal = 0;
  private syncIn = 0;
  private syncRun = 0;
  private locked = false;
  private lockBlend = 0;
  private calibHold = 0;
  private needLift = false;
  private fellThrough = false;

  // scratch
  private paperInv = new Matrix4();
  private v = new Vector3();
  private v2 = new Vector3();
  private head = new Vector3();
  private headQuat = new Quaternion();
  private earF = new Vector3();
  private earU = new Vector3();
  private fwd = new Vector3();
  private m = new Matrix4();
  private q = new Quaternion();
  private sample = { x: 0, z: 0 };
  private playerIsIdentity = true;
  private bestPlace = new Vector3();
  private parentInv = new Matrix4();
  private axis = new Vector3();
  private lastPoseLog = -10;

  /** Dev aid: console lines the IWSDK CLI can read (`iwsdk browser logs`). */
  private log(message: string): void {
    if (import.meta.env.DEV) console.info(`[hoam] ${message}`);
  }

  private paperPointWorld(x: number, y: number, z: number): string {
    this.desk.paper.updateWorldMatrix(true, false);
    const p = new Vector3(x, y, z).applyMatrix4(this.desk.paper.matrixWorld);
    return `[${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}]`;
  }

  private logLayout(): void {
    if (!import.meta.env.DEV) return;
    // Machine-readable layout for the emulator end-to-end test (tools/e2e.py).
    this.desk.paper.updateWorldMatrix(true, false);
    const w = (x: number, z: number) => {
      const p = new Vector3(x, 0, z).applyMatrix4(this.desk.paper.matrixWorld);
      return [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)];
    };
    const strokes = this.paths.map((p) => {
      const pts: number[][] = [];
      for (let k = 0; k <= 12; k++) {
        p.sampleAtFraction(k / 12, this.sample);
        pts.push(w(this.sample.x, this.sample.z));
      }
      return { pts, duration: +p.duration(this.tempo).toFixed(2) };
    });
    this.log(`layout ${JSON.stringify({ lesson: this.lesson.id, seal: w(SEAL_X, SEAL_Z), strokes })}`);
    this.log(`paper centre ${this.paperPointWorld(0, 0, 0)} seal ${this.paperPointWorld(SEAL_X, 0, SEAL_Z)}`);
    this.paths.forEach((p, i) =>
      this.log(
        `stroke ${i} ${p.stroke.name}: start ${this.paperPointWorld(p.startX, 0, p.startZ)} mid ${(() => {
          p.sampleAtFraction(0.5, this.sample);
          return this.paperPointWorld(this.sample.x, 0, this.sample.z);
        })()} end ${this.paperPointWorld(p.endX, 0, p.endZ)}`,
      ),
    );
  }

  init(): void {
    if (import.meta.env.DEV) {
      // Dev only: Shift+R clears saved progress and reloads (used by tools/e2e.py).
      const onKey = (e: KeyboardEvent) => {
        if (e.shiftKey && e.key.toLowerCase() === 'r') {
          try {
            localStorage.clear();
          } catch {
            // ignore
          }
          location.reload();
        }
      };
      window.addEventListener('keydown', onKey);
      this.cleanupFuncs.push(() => window.removeEventListener('keydown', onKey));
    }
    if (this.preset?.state === 'fresh') {
      clearProgress();
      clearCustomSong();
      this.customSong = undefined;
      this.preset = undefined;
      this.log('preset fresh: progress cleared');
    }
    this.progress = loadProgress();
    this.sfx.tracks = SCENES.japan.tracks.map((f) => `${import.meta.env.BASE_URL}${f}`);
    // Image-based lighting from a real studio HDRI (Poly Haven, CC0): glazes,
    // brass and wet ink pick up believable reflections. Hidden as a sky in AR.
    this.cleanupFuncs.push(
      this.world.activeLevel.subscribe((level) => {
        if (level && !level.hasComponent(DomeGradient)) {
          // Browser page only (domes are hidden in AR): a warm, dim study.
          level.addComponent(DomeGradient, {
            sky: [0.11, 0.09, 0.075, 1],
            equator: [0.2, 0.16, 0.13, 1],
            ground: [0.07, 0.055, 0.045, 1],
            intensity: 1,
            dither: true,
          });
        }
        if (level && !level.hasComponent(IBLTexture)) {
          level.addComponent(IBLTexture, {
            src: `${import.meta.env.BASE_URL}${SCENES.japan.light}`,
            intensity: 0.85,
          });
        }
      }),
    );
    this.world.createTransformEntity(this.env.mesh, { persistent: true });
    this.desk = createDeskSet();
    this.deskEntity = this.world.createTransformEntity(this.desk.root, { persistent: true });
    // Effects live on their own layer at paper height, visible in both crafts.
    const fx = new Group();
    fx.position.y = SURFACE_Y;
    this.desk.body.add(fx);
    fx.add(this.sparks.points);
    this.piano = new PianoMode({
      play: (midi, velocity, x, y, z) => this.sfx.piano(midi, velocity, x, y, z),
      sparks: (x, y, z, n) => this.sparks.burst(x, y, z, n, 0.12),
    });
    this.piano.root.visible = false;
    this.desk.body.add(this.piano.root);
    this.ghost = new GhostHand();
    this.world.createTransformEntity(this.ghost.root, { persistent: true });
    this.poses = { left: new GhostPoseBuilder('left'), right: new GhostPoseBuilder('right') };
    void this.createPanels();
    this.loadLesson(this.lessonIndex);
    this.enter2D();

    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        if (state === VisibilityState.NonImmersive) {
          if (this.mode !== 'demo2d') this.enter2D();
        } else if (state === VisibilityState.Visible && this.mode === 'demo2d') {
          this.enterXR();
        }
      }),
    );
  }

  // ---------------------------------------------------------------- panels

  private async createPanels(): Promise<void> {
    const make = async (id: string, scale: number) => {
      const panel = await this.world.assets.instantiate<UIKitMLAsset>(id);
      panel.scale.setScalar(scale);
      const entity = this.world.createTransformEntity(panel, {
        parent: this.deskEntity,
        persistent: true,
      });
      entity.addComponent(RayInteractable);
      entity.addComponent(PokeInteractable);
      return { panel, entity };
    };
    try {
      const [w, mnu, cap] = await Promise.all([
        make('welcome-panel', 0.09),
        make('menu-panel', MENU_SCALE),
        make('caption-panel', CAPTION_SCALE),
      ]);
      // A second reading card follows the head loosely (body-locked, never
      // head-locked) while the desk is being found, when the desk is hidden.
      const st = await this.world.assets.instantiate<UIKitMLAsset>('caption-panel');
      st.scale.setScalar(0.075);
      this.status = st;
      this.statusEntity = this.world.createTransformEntity(st, { persistent: true });
      this.statusEntity.addComponent(Follower, {
        target: this.player.head,
        offsetPosition: [0, -0.12, -0.85],
        behavior: FollowBehavior.FaceTarget,
        maxAngle: 25,
        tolerance: 0.25,
        speed: 2,
      });
      st.visible = false;
      this.welcome = w.panel;
      this.welcomeEntity = w.entity;
      this.menu = mnu.panel;
      this.menuEntity = mnu.entity;
      this.caption = cap.panel;
      this.captionEntity = cap.entity;
    } catch (error) {
      console.error('[hands-of-a-master] panel load failed', error);
      return;
    }

    // Welcome: above the far edge of the paper, aimed at the 2D camera.
    this.welcome.position.set(0, 0.22, -0.34);
    this.aimPanelAt(this.welcome, this.v.set(0, 1.16, 0.02));
    this.layoutPanels();

    // Every button runs through one debounced trigger, whether it is clicked by
    // a ray pinch, a mouse, UIKit's own touch pointer, or our fingertip poke.
    const on = (panel: UIKitMLAsset | undefined, id: string, fn: () => void) => {
      const el = panel?.getElementById(id) as (UIKit.Text & Object3D) | undefined;
      if (!el || !panel) return;
      const handler = () => this.trigger(id, fn);
      el.addEventListener('click', handler);
      this.cleanupFuncs.push(() => el.removeEventListener('click', handler));
      if (panel !== this.welcome) this.pokeButtons.push({ id, el, panel, fn, depth: [1, 1] });
    };

    if (!this.world.xrEnabled) {
      this.welcome.getElementById('xr-button')?.setProperties({ display: 'none' });
      this.text(this.welcome, 'xr-note', 'Open this page in Meta Quest Browser to start at your desk.');
    }
    on(this.welcome, 'xr-button', () => this.world.launchXR());
    Array.from({ length: 9 }, (_, i) =>
      on(this.menu, `lesson-${i}`, () => {
        if (i < this.lessonCount()) this.startLesson(i, true); // tiles 7-9 are piano only
      }),
    );
    on(this.menu, 'btn-slower', () => this.setTempo(this.tempo - 0.1));
    on(this.menu, 'btn-faster', () => this.setTempo(this.tempo + 0.1));
    on(this.menu, 'btn-watch', () => this.startLesson(this.lessonIndex, true));
    on(this.menu, 'btn-guide', () => this.cycleGuide());
    on(this.menu, 'btn-place', () => this.placeOrScan());
    on(this.menu, 'btn-text', () => this.toggleTextSize());
    on(this.menu, 'craft-cal', () => this.setCraft('calligraphy'));
    on(this.menu, 'lang-japanese', () => this.setLanguage('japanese'));
    on(this.menu, 'lang-chinese', () => this.setLanguage('chinese'));
    on(this.menu, 'btn-scene', () => {
      this.immersive = !this.immersive;
      this.text(this.menu, 'btn-scene-label', this.immersive ? 'Scene: on' : 'Scene: my room');
      this.applyScene();
    });
    on(this.menu, 'craft-piano', () => this.setCraft('piano'));
    on(this.menu, 'btn-record', () => this.startListening());
    on(this.welcome, 'midi-button', () => this.pickMidi());
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file || !/\.midi?$/i.test(file.name)) return;
      e.preventDefault();
      void this.addMidi(file);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    this.cleanupFuncs.push(() => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    });
    on(this.menu, 'btn-music', () => {
      if (this.craft === 'piano') this.sfx.musicOn = !this.sfx.musicOn; // stays silent at the piano
      else this.sfx.setMusicOn(!this.sfx.musicOn);
      this.text(this.menu, 'btn-music-label', this.sfx.musicOn ? 'Music: on' : 'Music: off');
    });
    on(this.menu, 'btn-next', () =>
      this.startLesson(Math.min(this.lessonCount() - 1, this.lessonIndex + 1), true),
    );
    on(this.menu, 'btn-again', () => this.startLesson(this.lessonIndex, false));

    this.refreshMenu();
    this.applyPanelVisibility();
  }

  /** Start page: choose a MIDI file to learn as "your song" (also accepts drag and drop). */
  private pickMidi(): void {
    if (!this.midiInput) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.mid,.midi,audio/midi,audio/x-midi';
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) void this.addMidi(file);
        input.value = '';
      });
      document.body.appendChild(input);
      this.midiInput = input;
      this.cleanupFuncs.push(() => input.remove());
    }
    this.midiInput.click();
  }

  private async addMidi(file: File): Promise<void> {
    const result = songFromMidi(await file.arrayBuffer(), file.name);
    if (typeof result === 'string') {
      this.text(this.welcome, 'midi-note', result);
      return;
    }
    this.customSong = result;
    saveCustomSong(result);
    delete this.progress.lessons[CUSTOM_ID];
    saveProgress(this.progress);
    this.text(this.welcome, 'midi-note', `Added "${result.name}" (${result.notes.length} notes). In the headset: Piano, song ${SONGS.length + 1}.`);
    this.log(`midi ${result.name} ${result.notes.length} notes bpm ${result.bpm}`);
    this.refreshMenu();
  }

  private trigger(id: string, fn: () => void): void {
    const now = performance.now();
    if (id === this.lastTriggerId && now - this.lastTriggerAt < 600) return;
    this.lastTriggerId = id;
    this.lastTriggerAt = now;
    this.sfx.unlock();
    this.sfx.tok();
    this.log(`button ${id}`);
    fn();
  }

  private buttonActive(b: PokeButton): boolean {
    if (!b.panel.visible) return false;
    if (b.id === 'btn-next' || b.id === 'btn-again') {
      if (!this.captionActionsShown) return false;
      if (b.id === 'btn-next' && this.lessonIndex === this.lessonCount() - 1) return false;
    }
    return true;
  }

  /**
   * Fingertip poke for panel buttons. A UIKit element's world matrix maps the
   * unit square onto its rectangle, so the fingertip in element space tells us
   * whether it is over the button; the signed distance along the panel normal
   * tells us when it pushes through the surface.
   */
  private updatePoke(): void {
    if (this.penDown || this.pokeButtons.length === 0) return;
    const frame = this.xrFrame;
    const ref = this.renderer.xr.getReferenceSpace();
    const session = this.renderer.xr.getSession();
    if (!frame || !ref || !session || !frame.getJointPose) return;
    let handIndex = 0;
    for (const source of session.inputSources) {
      if (!source.hand || handIndex > 1) continue;
      const space = source.hand.get('index-finger-tip');
      const pose = space ? frame.getJointPose(space, ref) : undefined;
      const slot = handIndex++;
      if (!pose) continue;
      const p = pose.transform.position;
      this.pokeTip.set(p.x, p.y, p.z);
      if (!this.playerIsIdentity) this.pokeTip.applyMatrix4(this.player.matrixWorld);
      for (const b of this.pokeButtons) {
        if (!this.buttonActive(b)) {
          b.depth[slot] = 1;
          continue;
        }
        const e = b.el.matrixWorld.elements;
        // Normal = the panel's +Z (an element's own z scale can be zero); origin = element centre.
        const pe = b.panel.matrixWorld.elements;
        this.v2.set(pe[8], pe[9], pe[10]).normalize();
        const depth =
          (this.pokeTip.x - e[12]) * this.v2.x +
          (this.pokeTip.y - e[13]) * this.v2.y +
          (this.pokeTip.z - e[14]) * this.v2.z;
        // Element-local x/y in unit-square terms: project onto its world axes.
        this.v.set(this.pokeTip.x - e[12], this.pokeTip.y - e[13], this.pokeTip.z - e[14]);
        this.axis.set(e[0], e[1], e[2]);
        const lx = this.v.dot(this.axis) / Math.max(1e-8, this.axis.lengthSq());
        this.axis.set(e[4], e[5], e[6]);
        const ly = this.v.dot(this.axis) / Math.max(1e-8, this.axis.lengthSq());
        const over = Math.abs(lx) <= 0.55 && Math.abs(ly) <= 0.6;
        const prev = b.depth[slot];
        b.depth[slot] = depth;
        if (over && prev > 0.004 && depth <= 0.004 && depth > -0.03) {
          this.trigger(b.id, b.fn);
        }
      }
    }
  }

  /**
   * Panel layout, in desk-local metres, following Meta's immersive design
   * guidance: the touchable menu within seated reach (about 0.55 m from the
   * eyes, never closer than 0.5 m) on the off-hand side; the read-only caption
   * about 0.9 m away and 15-25 degrees below eye level; both turned to face the
   * writer's actual head position, so they read square-on seated or standing.
   */
  private layoutPanels(): void {
    const side = this.ghost?.handedness === 'left' ? 1 : -1;
    // Where the writer's eyes are, in desk-local space (default: seated, 0.38 m back).
    const eye = this.v2.set(0, 0.44, 0.4);
    if (this.mode !== 'demo2d') {
      this.player.head.getWorldPosition(this.head);
      this.desk.root.updateWorldMatrix(true, false);
      eye.copy(this.desk.root.worldToLocal(this.head.clone()));
    }
    const piano = this.craft === 'piano';
    if (this.menu) {
      this.menu.scale.setScalar(MENU_SCALE * this.textScale);
      // At the piano the menu floats in front of the bass keys, clear of the lid.
      if (piano) this.menu.position.set(side * 0.43, 0.27, 0.13);
      else this.menu.position.set(side * (0.39 + 0.04 * (this.textScale - 1)), 0.2, 0.0);
      this.aimPanelAt(this.menu, eye);
    }
    if (this.caption) {
      this.caption.scale.setScalar(CAPTION_SCALE * this.textScale);
      if (piano) {
        // Above the music desk, where a pianist already looks.
        this.caption.position.set(0.05, 0.5 + 0.04 * (this.textScale - 1), -0.42);
      } else {
        // On the line from the eyes over the paper's far edge, about 0.9 m out.
        this.caption.position.set(0, eye.y - 0.32 - 0.04 * (this.textScale - 1), eye.z - 0.86);
      }
      this.aimPanelAt(this.caption, eye);
    }
  }

  /** Turn a +Z-facing panel so it faces a point (both in its parent's space). */
  private aimPanelAt(panel: { position: Vector3; rotation: { order: string; x: number; y: number; z: number } }, target: Vector3): void {
    const dx = target.x - panel.position.x;
    const dy = target.y - panel.position.y;
    const dz = target.z - panel.position.z;
    panel.rotation.order = 'YXZ';
    panel.rotation.y = Math.atan2(dx, dz);
    panel.rotation.x = -Math.atan2(dy, Math.hypot(dx, dz));
    panel.rotation.z = 0;
  }

  private toggleTextSize(): void {
    this.textScale = this.textScale > 1 ? 1 : 1.25;
    this.text(this.menu, 'btn-text-label', this.textScale > 1 ? 'Normal text' : 'Larger text');
    this.layoutPanels();
  }

  private text(panel: UIKitMLAsset | undefined, id: string, value: string): void {
    panel?.getElementById<UIKit.Text>(id)?.setProperties({ text: value });
  }

  private applyPanelVisibility(): void {
    const xr = this.mode !== 'demo2d';
    if (this.welcome) this.welcome.visible = !xr;
    if (this.menu) this.menu.visible = xr && this.mode !== 'placing';
    if (this.caption) this.caption.visible = xr && this.mode !== 'placing';
    if (this.status) this.status.visible = this.mode === 'placing';
    this.welcomeEntity?.object3D && (this.welcomeEntity.object3D.visible = !xr);
  }

  private setCaption(eyebrow: string, title: string, body: string, score = ' '): void {
    this.text(this.caption, 'cap-eyebrow', eyebrow);
    this.text(this.caption, 'cap-title', title);
    this.text(this.caption, 'cap-body', body);
    this.text(this.caption, 'cap-score', score);
  }

  private showCaptionActions(show: boolean): void {
    this.captionActionsShown = show;
    this.menu?.getElementById('menu-actions')?.setProperties({ display: show ? 'flex' : 'none' });
  }

  private lessonEyebrow(): string {
    return `${LANGUAGES[this.language].name.toUpperCase()}  -  LESSON ${this.lessonIndex + 1} OF ${this.lessons().length}  -  ${this.lesson.meaning.toUpperCase()} (${this.lesson.reading})`;
  }

  private refreshMenu(): void {
    if (!this.menu) return;
    const piano = this.craft === 'piano';
    const items = piano
      ? this.songs().map((s) => ({ id: s.id, name: s.name }))
      : this.lessons().map((l) => ({ id: l.id, name: cap(l.meaning) }));
    for (let i = 0; i < 9; i++) {
      const tile = this.menu.getElementById(`lesson-${i}`);
      const item = items[i];
      tile?.setProperties({ display: item ? 'flex' : 'none' });
      if (!item) continue;
      const p = this.progress.lessons[item.id];
      const stars = p?.passed ? '*'.repeat(this.stars(p.best)) : '';
      this.text(this.menu, `lesson-${i}-label`, item.name);
      this.text(this.menu, `lesson-${i}-best`, p?.best ? `${stars} ${p.best}` : ' ');
      // The current lesson's tile is highlighted in warm gold.
      tile?.setProperties({ backgroundColor: i === this.lessonIndex ? '#e6cf9f' : '#ebe1cf' });
    }
    this.text(this.menu, 'menu-title', piano ? 'Piano lessons' : `${LANGUAGES[this.language].name} calligraphy`);
    this.menu.getElementById('languages')?.setProperties({ display: piano ? 'none' : 'flex' });
    this.menu.getElementById('piano-row')?.setProperties({ display: piano ? 'flex' : 'none' });
    this.text(this.menu, 'btn-record-label', this.customSong ? 'Play a new tune' : 'Play your own tune');
    // Selected chips get a vermilion border and label (hover cannot override a border).
    const select = (id: string, on: boolean) => {
      this.menu?.getElementById(id)?.setProperties({ borderWidth: on ? 3 : 0, borderColor: '#a8231a' });
      this.menu?.getElementById<UIKit.Text>(`${id}-label`)?.setProperties({ color: on ? '#a8231a' : '#5e5246' });
    };
    for (const lang of ['japanese', 'chinese'] as Language[]) select(`lang-${lang}`, lang === this.language);
    select('craft-cal', !piano);
    select('craft-piano', piano);
    this.text(this.menu, 'tempo', `Tempo ${Math.round(this.tempo * 100)}%`);
    const guide = { adaptive: 'Guide: adaptive', always: 'Guide: always', off: 'Guide: off' }[this.guideMode];
    this.text(this.menu, 'btn-guide-label', guide);
    const days = this.progress.streak.days;
    this.text(
      this.menu,
      'streak',
      days > 1 ? `${days}-day practice streak` : days === 1 ? 'Practised today' : 'First lesson',
    );
  }

  private stars(score: number): number {
    return score >= 85 ? 3 : score >= 70 ? 2 : score >= PASS_SCORE ? 1 : 0;
  }

  // ---------------------------------------------------------------- modes

  private enter2D(): void {
    this.mode = 'demo2d';
    this.sfx.stopMusic();
    this.applyScene();
    this.calibrated = false;
    this.desk.root.visible = true;
    this.arrival = 1;
    this.desk.body.scale.set(1, 1, 1);
    this.desk.body.position.y = 0;
    this.ghost.setHandedness('right');
    this.penDown = false;
    this.sfx.setScratch(0);
    // A seated over-the-desk view for the browser page.
    this.setDeskWorldPose(this.v.set(0, 0.74, -0.42), 0);
    this.desk.virtualTable.visible = true;
    this.camera.position.set(0, 1.2, 0.12);
    this.camera.lookAt(0, 0.98, -0.6);
    this.loadLesson(LESSONS.length - 1);
    this.ghost.visible = true;
    this.ghost.opacity = 0.75;
    this.setGuideOpacity(0.18);
    this.startWatchChoreo(0.9);
    this.applyPanelVisibility();
  }

  private enterXR(): void {
    this.sfx.unlock();
    // Start in your own room: the place dissolves in once the paper is on your desk.
    this.env.snapToRoom();
    this.desk.virtualTable.visible = false;
    // Music and surroundings start once the desk is placed (applyScene).
    this.progress = loadProgress();
    void this.sfx.loadPiano(import.meta.env.BASE_URL);
    this.lessonIndex = this.firstUnpassed();
    if (this.craft === 'calligraphy') this.loadLesson(this.lessonIndex);
    this.beginPlacing();
  }

  private beginPlacing(): void {
    this.mode = 'placing';
    this.placingClock = 0;
    this.penDown = false;
    this.ghost.visible = false;
    this.desk.root.visible = false;
    this.showCaptionActions(false);
    this.setStatus(
      'STEP 1 OF 3  -  YOUR DESK',
      'Finding your desk',
      'Sit at a table and look at the spot where you want to write. Good light helps the headset see your hands.',
    );
    this.applyPanelVisibility();
  }

  private setStatus(eyebrow: string, title: string, body: string): void {
    this.text(this.status, 'cap-eyebrow', eyebrow);
    this.text(this.status, 'cap-title', title);
    this.text(this.status, 'cap-body', body);
    this.text(this.status, 'cap-score', ' ');
  }

  private finishPlacing(realDesk: boolean): void {
    this.log(`placed on ${realDesk ? 'detected table' : 'virtual desk'} (room capture ${this.canScanRoom() ? 'available' : 'unavailable'})`);
    this.desk.root.visible = true;
    this.desk.virtualTable.visible = !realDesk && this.craft !== 'piano';
    this.onRealDesk = realDesk;
    this.desk.root.updateWorldMatrix(true, false);
    this.piano.fitToFloor(this.desk.root.matrixWorld.elements[13]);
    if (!this.anchored) {
      // Keep the paper locked to the room even if tracking drifts.
      this.deskEntity.addComponent(XRAnchor);
      this.anchored = true;
    }
    this.arrival = 0;
    this.sfx.chime(0, 0.12);
    if (!this.sessionStart) this.sessionStart = this.clock;
    this.layoutPanels(); // face the writer's actual head, seated or standing
    this.applyScene();
    // On a virtual desk, Quest can be asked to scan the room so a real table
    // shows up. Only on the learner's press: an automatic scan can wipe
    // saved anchors (IWSDK 1.1.0 removed its own auto-call for that reason).
    const canScan = !realDesk && this.canScanRoom();
    this.text(this.menu, 'btn-place-label', canScan ? 'Scan my room' : 'Move paper here');
    if (this.applyPreset()) return;
    this.startLesson(this.lessonIndex, true);
    if (!realDesk) {
      this.setCaption(
        this.lessonEyebrow(),
        'Watch the master',
        canScan
          ? 'No table found, so the paper rests on a virtual desk. Sitting at a table? Press "Scan my room" on the menu.'
          : 'No table found, so the paper rests on a virtual desk. At a real table, press "Move paper here" on the menu.',
      );
    }
  }

  /** Jump to the moment named in the URL (see presets.ts). Returns false if there is none. */
  private applyPreset(): boolean {
    const p = this.preset;
    if (!p) return false;
    this.preset = undefined; // once only; "Move paper here" later behaves normally
    if (p.lang) this.language = p.lang;
    if (p.scene) {
      this.immersive = p.scene === 'place';
      this.text(this.menu, 'btn-scene-label', this.immersive ? 'Scene: on' : 'Scene: my room');
    }
    if (p.state === 'practice') {
      // Skip the seal: use this desk's last calibration (or none).
      this.surfaceOffset = this.progress.calibratedOffset ?? 0;
      this.calibrated = true;
    }
    this.mode = 'watch'; // placement is over (setCraft ignores requests while placing)
    if (p.craft === 'piano' && this.craft !== 'piano') this.setCraft('piano');
    this.applyScene();
    this.log(`preset ${p.state} craft ${this.craft} lesson ${(p.lesson ?? this.lessonIndex) + 1} lang ${this.language} scene ${this.immersive ? 'place' : 'room'}`);
    if (p.state === 'listen') {
      this.startListening();
      return true;
    }
    const index = Math.min(this.lessonCount() - 1, Math.max(0, p.lesson ?? this.lessonIndex));
    this.startLesson(index, p.state === 'watch');
    return true;
  }

  private canScanRoom(): boolean {
    const session = this.renderer.xr.getSession() as (XRSession & { initiateRoomCapture?: () => Promise<void> }) | null;
    return typeof session?.initiateRoomCapture === 'function';
  }

  /** "Scan my room" (virtual desk) or "Move paper here" (everything else). */
  private placeOrScan(): void {
    const session = this.renderer.xr.getSession() as (XRSession & { initiateRoomCapture?: () => Promise<void> }) | null;
    if (this.onRealDesk || typeof session?.initiateRoomCapture !== 'function') {
      this.beginPlacing();
      return;
    }
    this.log('room capture requested');
    session
      .initiateRoomCapture()
      .then(() => this.log('room capture done'))
      .catch((error: unknown) => this.log(`room capture failed ${String(error)}`))
      .finally(() => this.beginPlacing());
  }

  private startLesson(index: number, watchFirst: boolean): void {
    if (this.mode === 'demo2d') return;
    this.penDown = false;
    this.locked = false;
    this.sfx.setScratch(0);
    if (this.craft === 'piano') {
      this.startSong(index, watchFirst);
      return;
    }
    this.loadLesson(index);
    this.showCaptionActions(false);
    this.desk.stamp.visible = false;
    this.hankoAnim = -1;
    this.desk.hanko.position.set(HANKO_HOME.x - 0.04, 0, HANKO_HOME.z);
    this.applyGuideStrength();
    if (watchFirst) {
      this.mode = 'watch';
      this.startWatchChoreo(1);
      this.setCaption(
        this.lessonEyebrow(),
        'Watch the master',
        `${this.lesson.teaching} ${this.lesson.strokes.length} stroke${this.lesson.strokes.length > 1 ? 's' : ''}. Just watch for now.`,
      );
    } else {
      this.beginPractice();
    }
    this.refreshMenu();
    this.applyPanelVisibility();
    this.log(`lesson ${this.lesson.id} (${watchFirst ? 'watch' : 'practice'})`);
    this.logLayout();
  }

  private beginPractice(): void {
    for (const r of this.demoRibbons) this.fadeOut(r, 0.6);
    this.demoRibbons = [];
    if (!this.calibrated) {
      this.mode = 'calibrate';
      this.log('calibrate');
      this.calibHold = 0;
      this.ghostTarget(this.calX + 0.03, HOVER_Y + 0.02, this.calZ + 0.02);
      this.setCaption(
        'STEP 2 OF 3  -  TOUCH',
        'Touch the red seal',
        'Like the master: rest your index fingertip on the red seal for a moment. This tells the paper where your desk is.',
      );
      return;
    }
    if (this.craft === 'piano') {
      this.mode = 'piano';
      this.piano.startPlay();
      this.log('practice');
      this.promptNote(true);
      return;
    }
    this.mode = 'practice';
    this.log('practice');
    this.strokeIndex = 0;
    this.strokeScores = [];
    this.phase = 'ready';
    this.promptStroke();
  }

  private promptStroke(): void {
    const s = this.lesson.strokes[this.strokeIndex];
    const first = this.strokeIndex === 0 && !this.progress.strokes;
    this.setCaption(
      first ? 'STEP 3 OF 3  -  WRITE' : this.lessonEyebrow(),
      first ? 'Your turn' : `Stroke ${this.strokeIndex + 1} of ${this.lesson.strokes.length}: ${s.name}`,
      first
        ? 'Touch the paper inside the glowing ring, then move with the master. Lift your finger to finish.'
        : 'Begin inside the glowing ring and move with the master.',
    );
  }

  // ---------------------------------------------------------------- lesson setup

  private loadLesson(index: number): void {
    this.lessonIndex = index;
    this.lesson = this.lessons()[index];
    this.paths = this.lesson.strokes.map((s) => new StrokePath(s));
    const disposeAll = (list: InkRibbon[]) => {
      for (const r of list) {
        r.mesh.removeFromParent();
        r.dispose();
      }
      list.length = 0;
    };
    disposeAll(this.guideRibbons);
    disposeAll(this.demoRibbons);
    disposeAll(this.userRibbons);
    for (const f of this.fading) {
      f.ribbon.mesh.removeFromParent();
      f.ribbon.dispose();
    }
    this.fading = [];
    if (this.current) {
      this.current.mesh.removeFromParent();
      this.current.dispose();
      this.current = undefined;
    }
    for (const p of this.paths) {
      const g = new InkRibbon(GUIDE_COLOR, 0.0002, false);
      g.setPolyline(p.xs, p.zs, 0.0105);
      g.material.opacity = 0.25;
      g.mesh.renderOrder = 2;
      this.desk.paper.add(g.mesh);
      this.guideRibbons.push(g);
    }
    this.strokeIndex = 0;
    this.strokeScores = [];
  }

  private skill(): number {
    const best = this.progress.lessons[this.lesson.id]?.best ?? 0;
    return clamp01((best - 50) / 45);
  }

  private setGuideOpacity(v: number): void {
    for (const g of this.guideRibbons) g.material.opacity = v;
  }

  /** The master lets go as you improve: fainter ghost, fainter tracing guide. */
  private applyGuideStrength(): void {
    const s = this.guideMode === 'adaptive' ? this.skill() : 0;
    const off = this.guideMode === 'off';
    this.ghost.opacity = off ? 0 : 0.78 - 0.56 * s;
    this.setGuideOpacity(off ? 0 : 0.3 - 0.22 * s);
  }

  private setTempo(v: number): void {
    this.tempo = Math.round(Math.min(1, Math.max(0.3, v)) * 10) / 10;
    this.refreshMenu();
  }

  private cycleGuide(): void {
    this.guideMode =
      this.guideMode === 'adaptive' ? 'always' : this.guideMode === 'always' ? 'off' : 'adaptive';
    this.applyGuideStrength();
    this.refreshMenu();
  }

  // ---------------------------------------------------------------- placement

  private setDeskWorldPose(position: Vector3, yaw: number): void {
    const root = this.desk.root;
    this.q.setFromAxisAngle(this.v2.set(0, 1, 0), yaw);
    this.m.compose(position, this.q, this.v2.set(1, 1, 1));
    if (root.parent) {
      root.parent.updateWorldMatrix(true, false);
      this.m.premultiply(this.parentInv.copy(root.parent.matrixWorld).invert());
    }
    this.m.decompose(root.position, root.quaternion, root.scale);
    root.updateWorldMatrix(true, true);
  }

  private readHead(): void {
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldDirection(this.fwd);
    // Object3D.getWorldDirection returns +Z; the viewer looks down -Z.
    this.fwd.negate();
    this.fwd.y = 0;
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
  }

  /** Try to put the paper on a detected table. Returns true on success. */
  private tryPlaceOnPlane(): boolean {
    this.readHead();
    const target = this.v.copy(this.head).addScaledVector(this.fwd, 0.4);
    let bestScore = Infinity;
    const best = this.bestPlace;
    for (const entity of this.queries.planes.entities) {
      const plane = entity.getValue(XRPlane, '_plane') as XRPlane | undefined;
      const obj = entity.object3D;
      if (!plane || !obj || plane.orientation !== 'horizontal') continue;
      const label = (plane as XRPlane & { semanticLabel?: string }).semanticLabel ?? '';
      if (label === 'floor' || label === 'ceiling') continue;
      obj.updateWorldMatrix(true, false);
      const y = obj.matrixWorld.elements[13];
      if (y < this.head.y - 0.95 || y > this.head.y - 0.12) continue;
      // Clamp the ideal spot into the plane's polygon bounds (plane-local XZ).
      const local = obj.worldToLocal(this.v2.set(target.x, y, target.z));
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of plane.polygon) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      }
      if (!Number.isFinite(minX) || maxX - minX < 0.2 || maxZ - minZ < 0.2) continue;
      const mx = Math.min(0.14, (maxX - minX) / 2);
      const mz = Math.min(0.17, (maxZ - minZ) / 2);
      local.x = Math.min(maxX - mx, Math.max(minX + mx, local.x));
      local.z = Math.min(maxZ - mz, Math.max(minZ + mz, local.z));
      local.y = 0;
      // Round or irregular tables: slide toward the centroid until the whole
      // writing set (approximated by a 22 cm circle) is on the surface.
      if (!this.footprintInside(plane.polygon, local.x, local.z)) {
        let cx = 0, cz = 0;
        for (const p of plane.polygon) { cx += p.x; cz += p.z; }
        cx /= plane.polygon.length; cz /= plane.polygon.length;
        for (let step = 0; step < 25 && !this.footprintInside(plane.polygon, local.x, local.z); step++) {
          local.x += (cx - local.x) * 0.15;
          local.z += (cz - local.z) * 0.15;
        }
        if (!this.footprintInside(plane.polygon, local.x, local.z)) continue; // table too small
      }
      const world = obj.localToWorld(local);
      const dist = Math.hypot(world.x - target.x, world.z - target.z);
      if (dist > 0.6) continue;
      const score = dist - (label === 'table' || label === 'desk' ? 0.3 : 0);
      if (score < bestScore) {
        bestScore = score;
        best.copy(world);
      }
    }
    if (bestScore === Infinity) return false;
    const yaw = Math.atan2(this.head.x - best.x, this.head.z - best.z);
    best.y += 0.001;
    this.setDeskWorldPose(best, yaw);
    return true;
  }

  private logPlanes(): void {
    if (!import.meta.env.DEV) return;
    this.readHead();
    this.log(`head ${this.head.toArray().map((v) => v.toFixed(2))} planes ${this.queries.planes.entities.size}`);
    for (const entity of this.queries.planes.entities) {
      const plane = entity.getValue(XRPlane, '_plane') as (XRPlane & { semanticLabel?: string }) | undefined;
      const obj = entity.object3D;
      if (!plane || !obj) continue;
      obj.updateWorldMatrix(true, false);
      const e = obj.matrixWorld.elements;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of plane.polygon) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      }
      this.log(
        `plane ${plane.orientation} label=${plane.semanticLabel} pos [${e[12].toFixed(2)}, ${e[13].toFixed(2)}, ${e[14].toFixed(2)}] up [${e[4].toFixed(2)}, ${e[5].toFixed(2)}, ${e[6].toFixed(2)}] size ${(maxX - minX).toFixed(2)} x ${(maxZ - minZ).toFixed(2)}`,
      );
    }
  }

  private footprintInside(polygon: ReadonlyArray<DOMPointReadOnly>, x: number, z: number): boolean {
    const r = 0.22;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      if (!pointInPolygon(polygon, x + Math.cos(a) * r, z + Math.sin(a) * r)) return false;
    }
    return pointInPolygon(polygon, x, z);
  }

  private placeVirtual(): void {
    this.readHead();
    const p = this.v.copy(this.head).addScaledVector(this.fwd, 0.38);
    p.y = this.head.y - 0.42;
    const yaw = Math.atan2(this.fwd.x * -1, this.fwd.z * -1);
    this.setDeskWorldPose(p, yaw);
  }

  // ---------------------------------------------------------------- ghost choreography

  private ghostTarget(x: number, y: number, z: number): void {
    this.choreo = [{ kind: 'move', dur: 0.6, from: [this.ghostTip.x, this.ghostTip.y, this.ghostTip.z], to: [x, y, z] }];
    this.choreoIndex = 0;
    this.choreoClock = 0;
  }

  /** The master writes the whole character: travel, press, draw, lift. */
  private startWatchChoreo(tempo: number): void {
    for (const r of this.demoRibbons) this.fadeOut(r, 0.5);
    this.demoRibbons = [];
    const seq: Choreo[] = [];
    let at: [number, number, number] = [this.ghostTip.x, this.ghostTip.y, this.ghostTip.z];
    this.paths.forEach((p, k) => {
      const above: [number, number, number] = [p.startX, HOVER_Y, p.startZ];
      seq.push({ kind: 'move', dur: k === 0 ? 0.8 : 0.45, from: at, to: above });
      seq.push({ kind: 'move', dur: 0.16, from: above, to: [p.startX, TIP_CONTACT_Y, p.startZ] });
      seq.push({ kind: 'draw', dur: p.duration(tempo), stroke: k });
      const end: [number, number, number] = [p.endX, TIP_CONTACT_Y, p.endZ];
      const lifted: [number, number, number] = [p.endX, HOVER_Y, p.endZ];
      seq.push({ kind: 'move', dur: 0.18, from: end, to: lifted });
      at = lifted;
    });
    seq.push({ kind: 'move', dur: 0.8, from: at, to: this.restTip });
    this.choreo = seq;
    this.choreoIndex = 0;
    this.choreoClock = 0;
    this.ghost.visible = true;
  }

  /** Advance the choreography; returns true while it is still running. */
  private stepChoreo(dt: number, layInk: boolean): boolean {
    if (this.choreoIndex >= this.choreo.length) return false;
    const c = this.choreo[this.choreoIndex];
    this.choreoClock += dt;
    const t = clamp01(this.choreoClock / c.dur);
    if (c.kind === 'move' && c.from && c.to) {
      const e = smooth(t);
      const arc = Math.sin(Math.PI * e) * 0.02 * (Math.hypot(c.to[0] - c.from[0], c.to[2] - c.from[2]) > 0.03 ? 1 : 0);
      this.ghostTip.set(
        c.from[0] + (c.to[0] - c.from[0]) * e,
        c.from[1] + (c.to[1] - c.from[1]) * e + arc,
        c.from[2] + (c.to[2] - c.from[2]) * e,
      );
      this.easeLean(0, 0, dt);
    } else if (c.kind === 'draw' && c.stroke !== undefined) {
      const path = this.paths[c.stroke];
      const px = this.ghostTip.x;
      const pz = this.ghostTip.z;
      path.sampleAtTime(t, this.sample);
      this.ghostTip.set(this.sample.x, TIP_CONTACT_Y, this.sample.z);
      const dx = this.sample.x - px;
      const dz = this.sample.z - pz;
      const len = Math.hypot(dx, dz);
      if (len > 1e-5) this.easeLean(dx / len, dz / len, dt);
      if (layInk) {
        let ribbon = this.demoRibbons[c.stroke];
        if (!ribbon) {
          ribbon = new InkRibbon(VERMILION, 0.0007 + c.stroke * 0.00002);
          this.desk.paper.add(ribbon.mesh);
          this.demoRibbons[c.stroke] = ribbon;
        }
        const speed = dt > 0 ? len / dt : 0;
        ribbon.add(this.sample.x, this.sample.z, 0.0118 - 0.006 * clamp01(speed / 0.22));
        if (t >= 1) ribbon.finish();
      }
    }
    if (t >= 1) {
      this.choreoIndex++;
      this.choreoClock = 0;
    }
    return this.choreoIndex < this.choreo.length;
  }

  private easeLean(x: number, z: number, dt: number): void {
    const k = 1 - Math.exp(-dt * 6);
    this.ghostLean.x += (x - this.ghostLean.x) * k;
    this.ghostLean.z += (z - this.ghostLean.z) * k;
  }

  private poseGhost(): void {
    this.desk.paper.updateWorldMatrix(true, false);
    this.poses[this.ghost.handedness].compose(
      this.desk.paper.matrixWorld,
      this.ghostTip.x,
      this.ghostTip.y,
      this.ghostTip.z,
      this.ghostLean.x,
      this.ghostLean.z,
      this.ghostJoints,
      this.mode === 'piano',
    );
    if (import.meta.env.DEV && this.clock - this.lastPoseLog > 3) {
      this.lastPoseLog = this.clock;
      const j = this.ghostJoints;
      const f = (i: number) => `[${j[i * 16 + 12].toFixed(3)}, ${j[i * 16 + 13].toFixed(3)}, ${j[i * 16 + 14].toFixed(3)}]`;
      this.log(`ghost ${this.ghost.handedness} wrist ${f(0)} index-tip ${f(9)} thumb-tip ${f(4)} middle-prox ${f(11)}`);
      const info = this.renderer.info.render;
      this.log(`render calls ${info.calls} triangles ${info.triangles} mode ${this.mode}`);
    }
    if (this.lockBlend > 0.001 && this.readUserJoints()) {
      this.blender.blend(this.ghostJoints, this.userJoints, this.lockBlend, this.shownJoints);
      this.ghost.setJoints(this.shownJoints);
    } else {
      this.ghost.setJoints(this.ghostJoints);
    }
  }

  // ---------------------------------------------------------------- hand tracking

  private readUserJoints(): boolean {
    const frame = this.xrFrame as
      | (XRFrame & { fillPoses?: (spaces: XRSpace[], base: XRSpace, out: Float32Array) => boolean })
      | undefined;
    const ref = this.renderer.xr.getReferenceSpace();
    const src = this.tipSource;
    if (!frame || !ref || !src?.hand || !frame.fillPoses) return false;
    let spaces = this.jointSpaces.get(src);
    if (!spaces) {
      spaces = Array.from(src.hand.values());
      this.jointSpaces.set(src, spaces);
    }
    if (!frame.fillPoses(spaces, ref, this.userJoints)) return false;
    if (!this.playerIsIdentity) {
      for (let i = 0; i < JOINT_COUNT; i++) {
        this.m.fromArray(this.userJoints, i * 16).premultiply(this.player.matrixWorld);
        this.m.toArray(this.userJoints, i * 16);
      }
    }
    return true;
  }

  /** Track the writing fingertip in paper-local space. */
  private readTip(dt: number): void {
    this.tipValid = false;
    const frame = this.xrFrame;
    const ref = this.renderer.xr.getReferenceSpace();
    const session = this.renderer.xr.getSession();
    if (!frame || !ref || !session || !frame.getJointPose) return;
    this.player.updateWorldMatrix(true, false);
    this.playerIsIdentity = this.player.matrixWorld.equals(this.m.identity());
    this.desk.paper.updateWorldMatrix(true, false);
    this.paperInv.copy(this.desk.paper.matrixWorld).invert();

    let bestH = Infinity;
    let bestSource: XRInputSource | undefined;
    for (const source of session.inputSources) {
      if (!source.hand) continue;
      if (this.penDown && this.tipSource && source !== this.tipSource) continue;
      const space = source.hand.get('index-finger-tip');
      const pose = space ? frame.getJointPose(space, ref) : undefined;
      if (!pose) continue;
      const p = pose.transform.position;
      this.v.set(p.x, p.y, p.z);
      if (!this.playerIsIdentity) this.v.applyMatrix4(this.player.matrixWorld);
      this.v.applyMatrix4(this.paperInv);
      const inside =
        Math.abs(this.v.x) < PAPER_W / 2 + 0.05 && Math.abs(this.v.z) < PAPER_D / 2 + 0.05;
      // A hand far below the paper is resting in a lap (under a virtual desk):
      // never let it steal the brush. Prefer the hand already writing.
      const below = this.v.y - this.surfaceOffset < -0.1;
      let h = inside && !below ? this.v.y : this.v.y + 1;
      if (below) h += 1;
      if (source === this.tipSource) h -= 0.02;
      if (h < bestH) {
        bestH = h;
        bestSource = source;
        this.v2.copy(this.v);
      }
    }
    if (!bestSource) {
      this.tipFilter.reset();
      return;
    }
    if (bestSource !== this.tipSource) this.tipFilter.reset();
    this.tipSource = bestSource;
    this.tipFilter.filter(this.v2.x, this.v2.y, this.v2.z, dt, this.tip);
    const sp = Math.hypot(this.tip.x - this.tipPrev.x, this.tip.z - this.tipPrev.z) / Math.max(dt, 1e-3);
    this.tipSpeed += (sp - this.tipSpeed) * (1 - Math.exp(-dt * 12));
    this.tipPrev.x = this.tip.x;
    this.tipPrev.z = this.tip.z;
    this.tipValid = true;
    const hand = bestSource.handedness === 'left' ? 'left' : 'right';
    const atPaper = this.tipOnPaper() && this.tip.y < 0.06;
    if (hand !== this.ghost.handedness && atPaper && !this.penDown && this.phase === 'ready') {
      this.ghost.setHandedness(hand);
      this.layoutPanels();
    }
  }

  /** Hover cursor: a ring under your fingertip that tightens as you near the paper. */
  private updateCursor(): void {
    const c = this.desk.cursor;
    const active = this.mode === 'practice' || this.mode === 'calibrate';
    const h = this.tipHeight();
    if (!active || !this.tipValid || this.penDown || !this.tipOnPaper() || h > 0.09 || h < -0.06) {
      c.visible = false;
      return;
    }
    c.visible = true;
    c.position.x = this.tip.x;
    c.position.z = this.tip.z;
    const k = clamp01(h / 0.09);
    c.scale.setScalar(1 + 3.5 * k);
    (c.material as { opacity: number }).opacity = 0.85 - 0.6 * k;
  }

  private tipHeight(): number {
    return this.tip.y - this.surfaceOffset;
  }

  private tipOnPaper(): boolean {
    return Math.abs(this.tip.x) < PAPER_W / 2 + 0.01 && Math.abs(this.tip.z) < PAPER_D / 2 + 0.01;
  }

  // ---------------------------------------------------------------- practice

  private updateCalibrate(dt: number): void {
    const pulse = 0.55 + 0.45 * Math.sin(this.clock * 5);
    const ring = this.desk.sealRing;
    ring.visible = true;
    ring.position.set(this.calX, ring.position.y, this.calZ);
    (ring.material as { opacity: number }).opacity = pulse;
    ring.scale.setScalar(1 + 0.15 * pulse);
    if (!this.tipValid) return;
    const near = Math.hypot(this.tip.x - this.calX, this.tip.z - this.calZ) < 0.03;
    if (near && this.tip.y < 0.045 && this.tipSpeed < 0.05) {
      this.calibHold += dt;
      if (this.calibHold > 0.35) {
        this.surfaceOffset = Math.min(0.04, Math.max(-0.03, this.tip.y - TIP_CONTACT_Y));
        this.progress.calibratedOffset = this.surfaceOffset;
        this.calibrated = true;
        this.desk.sealRing.scale.setScalar(1);
        (this.desk.sealRing.material as { opacity: number }).opacity = 0.25;
        this.sfx.stamp();
        this.log(`calibrated offset ${this.surfaceOffset.toFixed(4)}`);
        this.needLift = true; // the finger is still resting on the seal
        this.beginPractice();
      }
    } else {
      this.calibHold = 0;
    }
  }

  private updatePractice(dt: number): void {
    const path = this.paths[this.strokeIndex];
    if (!path) return;
    const h = this.tipHeight();

    if (this.phase === 'cooldown') {
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.phase = 'ready';
        this.promptStroke();
      }
    }

    if (this.phase === 'ready' && !this.breakShown && this.sessionStart && this.clock - this.sessionStart > BREAK_AFTER_S) {
      this.breakShown = true;
      this.setCaption(
        this.lessonEyebrow(),
        'Time for a short break',
        'You have practised for 25 minutes. Rest your hand and eyes for a moment; your progress is saved.',
      );
    }

    if (this.phase === 'ready') {
      // The master waits just above the start of the stroke, breathing gently.
      const bob = Math.sin(this.clock * 2.4) * 0.004;
      this.ghostTip.x += (path.startX - this.ghostTip.x) * Math.min(1, dt * 6);
      this.ghostTip.z += (path.startZ - this.ghostTip.z) * Math.min(1, dt * 6);
      this.ghostTip.y += (HOVER_Y + bob - this.ghostTip.y) * Math.min(1, dt * 6);
      this.easeLean(0, 0, dt);
      this.updateStartMarker(path, true);
      if (this.needLift && (!this.tipValid || h > UP_H || !this.tipOnPaper())) this.needLift = false;
      if (!this.needLift && this.tipValid && this.tipOnPaper() && h < DOWN_H && h > -0.08) {
        this.penDownStart();
      }
    } else if (this.phase === 'drawing') {
      this.updateStartMarker(path, false);
      // Ghost leads along the stroke at practice tempo, then waits at the end.
      this.ghostStrokeClock += dt;
      const t = this.ghostStrokeClock / path.duration(this.tempo);
      const px = this.ghostTip.x;
      const pz = this.ghostTip.z;
      path.sampleAtTime(t, this.sample);
      const lift = t > 1 ? Math.min(HOVER_Y, TIP_CONTACT_Y + (t - 1) * 0.08) : TIP_CONTACT_Y;
      this.ghostTip.set(this.sample.x, lift, this.sample.z);
      const dx = this.sample.x - px;
      const dz = this.sample.z - pz;
      const len = Math.hypot(dx, dz);
      if (len > 1e-5) this.easeLean(dx / len, dz / len, dt);

      if (this.tipValid) {
        // Ink: width follows a pressure proxy (slow = wet and wide).
        const target = 0.0118 - 0.0068 * clamp01(this.tipSpeed / 0.28);
        this.width += (target - this.width) * Math.min(1, dt * 10);
        if (this.current?.add(this.tip.x, this.tip.z, this.width)) {
          this.capX.push(this.tip.x);
          this.capZ.push(this.tip.z);
        }
        this.sfx.setScratch(this.tipSpeed);
        this.v.set(this.tip.x, 0, this.tip.z);
        this.desk.paper.localToWorld(this.v);
        this.sfx.setScratchPosition(this.v.x, this.v.y, this.v.z);

        // In step with the master?
        const d = Math.hypot(this.tip.x - this.ghostTip.x, this.tip.z - this.ghostTip.z);
        if (t <= 1.05) {
          this.syncTotal += dt;
          if (d < LOCK_DIST) {
            this.syncIn += dt;
            this.syncRun += dt;
          } else {
            this.syncRun = 0;
          }
        }
        if (!this.locked && this.syncRun > 0.3 && this.guideMode !== 'off') this.setLocked(true);
        else if (this.locked && d > UNLOCK_DIST) this.setLocked(false);
      }

      // A fingertip that plunges well below the surface right after "touching"
      // is a hand passing through the paper, not a brush stroke.
      if (this.clock - this.capStart < 0.25 && h < -0.05) this.fellThrough = true;
      const lifted = !this.tipValid || h > UP_H || h < -0.12 || !this.tipOnPaper();
      if (lifted) this.penUp();
    }
  }

  private updateStartMarker(path: StrokePath, show: boolean): void {
    const ring = this.desk.sealRing;
    if (!show) {
      ring.visible = false;
      return;
    }
    ring.visible = true;
    const pulse = 0.5 + 0.5 * Math.sin(this.clock * 5);
    ring.position.set(path.startX, ring.position.y, path.startZ + 0.0);
    ring.scale.setScalar(0.42 + 0.12 * pulse);
    (ring.material as { opacity: number }).opacity = 0.45 + 0.4 * pulse;
  }

  private penDownStart(): void {
    this.penDown = true;
    this.sfx.setMusicMood('writing');
    this.fellThrough = false;
    this.phase = 'drawing';
    this.capX = [this.tip.x];
    this.capZ = [this.tip.z];
    this.capStart = this.clock;
    this.ghostStrokeClock = 0;
    this.syncTotal = 0;
    this.syncIn = 0;
    this.syncRun = 0;
    this.width = 0.009;
    this.current = new InkRibbon(INK_COLOR, 0.0009 + this.strokeIndex * 0.00003);
    this.current.add(this.tip.x, this.tip.z, this.width);
    this.desk.paper.add(this.current.mesh);
  }

  private setLocked(on: boolean): void {
    if (on === this.locked) return;
    this.locked = on;
    if (on) {
      this.sfx.chime(this.strokeIndex + 2, 0.13);
      this.sparks.burst(this.tip.x, 0.004, this.tip.z, 18, 0.16);
    }
    this.sfx.setMusicMood(on ? 'unison' : this.penDown ? 'writing' : 'calm');
    if (on && !this.progress.seenLock) {
      this.progress.seenLock = true;
      saveProgress(this.progress);
      this.setCaption(
        this.lessonEyebrow(),
        'In unison',
        "Your hand is moving with the master's. While you stay together, your ink turns gold.",
      );
    }
    if (this.current) this.current.material.color.copy(on ? GOLD : INK_COLOR);
  }

  private penUp(): void {
    this.penDown = false;
    this.sfx.setMusicMood('calm');
    this.needLift = true;
    this.sfx.setScratch(0);
    const ribbon = this.current;
    this.current = undefined;
    this.setLocked(false);
    if (!ribbon) return;
    ribbon.finish();

    let length = 0;
    for (let i = 1; i < this.capX.length; i++) {
      length += Math.hypot(this.capX[i] - this.capX[i - 1], this.capZ[i] - this.capZ[i - 1]);
    }
    const duration = this.clock - this.capStart;
    const accidental =
      duration < 0.2 || // a hand passing through the paper on its way to the lap
      this.fellThrough ||
      (length < 0.012 && this.lesson.strokes[this.strokeIndex].name !== 'dot');
    if (accidental) {
      // An accidental touch: quietly discard it.
      this.log(`discarded touch (${duration.toFixed(2)}s, ${(length * 1000).toFixed(0)} mm)`);
      ribbon.mesh.removeFromParent();
      ribbon.dispose();
      this.phase = 'ready';
      return;
    }

    const path = this.paths[this.strokeIndex];
    const others = this.paths.filter((_, i) => i > this.strokeIndex);
    const sync = this.syncTotal > 0 ? this.syncIn / this.syncTotal : 0;
    const result = scoreStroke(
      { xs: this.capX, zs: this.capZ, duration: this.clock - this.capStart },
      path,
      others,
      this.tempo,
      this.guideMode === 'off' ? Math.max(sync, 0.6) : sync,
    );
    this.progress.strokes++;
    const n = this.capX.length;
    this.log(
      `capture ${n} pts ${(this.clock - this.capStart).toFixed(2)}s from [${this.capX[0].toFixed(3)}, ${this.capZ[0].toFixed(3)}] to [${this.capX[n - 1].toFixed(3)}, ${this.capZ[n - 1].toFixed(3)}] hand ${this.tipSource?.handedness}`,
    );
    this.onStrokeScored(result, ribbon);
  }

  private onStrokeScored(result: StrokeScore, ribbon: InkRibbon): void {
    this.log(
      `stroke ${this.strokeIndex} scored ${result.total} (path ${result.path}, speed ${result.speed}, sync ${result.sync.toFixed(2)}) ${result.verdict}${result.hint ? ' - ' + result.hint : ''}`,
    );
    const total = this.lesson.strokes.length;
    const label = `Stroke ${this.strokeIndex + 1} of ${total}`;
    if (result.pass) {
      ribbon.material.color.copy(result.gold ? GOLD : INK_COLOR);
      this.userRibbons.push(ribbon);
      this.strokeScores.push(result.total);
      this.sfx.chime(this.strokeIndex, result.gold ? 0.2 : 0.14);
      this.strokeIndex++;
      if (this.strokeIndex >= total) {
        this.completeLesson();
        return;
      }
      const tip = result.hint ? `${result.hint} ` : '';
      this.setCaption(
        this.lessonEyebrow(),
        result.verdict,
        `${tip}Next: ${this.lesson.strokes[this.strokeIndex].name}. Begin at the glowing point.`,
        `${label}  -  ${result.total} points`,
      );
      this.phase = 'cooldown';
      this.cooldown = 1.1;
    } else {
      this.fadeOut(ribbon, 0.9);
      this.sfx.tok(0.7);
      this.setCaption(
        this.lessonEyebrow(),
        result.verdict,
        result.hint || "Follow the master's hand closely.",
        `${label}  -  ${result.total} points`,
      );
      this.phase = 'cooldown';
      this.cooldown = 1.4;
    }
  }

  private completeLesson(): void {
    this.mode = 'complete';
    this.log('lesson complete');
    const score = Math.round(
      this.strokeScores.reduce((a, b) => a + b, 0) / Math.max(1, this.strokeScores.length),
    );
    const record = lessonProgress(this.progress, this.lesson.id);
    const improved = score > record.best;
    const prevBest = record.best;
    record.attempts++;
    record.best = Math.max(record.best, score);
    record.passed = record.passed || score >= PASS_SCORE;
    const days = markPracticeDay(this.progress);
    saveProgress(this.progress);

    // The jade seal stamps the page: lift, dip in paste, press, return.
    this.hankoAnim = 0;
    // A shower of gold rises off every stroke the learner wrote.
    for (const p of this.paths) {
      for (let k = 0; k <= 6; k++) {
        p.sampleAtFraction(k / 6, this.sample);
        this.sparks.burst(this.sample.x, 0.003, this.sample.z, 3, 0.14);
      }
    }
    this.ghostTarget(this.restTip[0], this.restTip[1], this.restTip[2]);
    this.desk.sealRing.visible = false;

    const stars = '*'.repeat(this.stars(score)) || '-';
    const isLast = this.lessonIndex === this.lessonCount() - 1;
    const body = improved && prevBest > 0
      ? `New best (was ${prevBest}). The master's guide will fade a little more next time.`
      : isLast
        ? 'You have written all eight principles of the brush in one character.'
        : this.lessonIndex === 0 && record.attempts === 1
          ? `The seal is yours. Try it in ${this.language === 'japanese' ? 'Chinese' : 'Japanese'} too: choose your language on the menu, or press "Next lesson".`
          : `The seal is yours. "Next lesson" is on the menu to your ${this.ghost.handedness === 'left' ? 'right' : 'left'}.`;
    this.setCaption(
      this.lessonEyebrow(),
      `${cap(this.lesson.meaning)} complete  ${stars}`,
      body,
      `Score ${score}  -  ${days > 1 ? `${days}-day streak` : 'practised today'}`,
    );
    this.menu?.getElementById('btn-next')?.setProperties({ display: isLast ? 'none' : 'flex' });
    this.showCaptionActions(true);
    this.refreshMenu();
  }

  // ---------------------------------------------------------------- crafts

  private lessons(): Lesson[] {
    return LESSON_SETS[this.language];
  }

  /** The surroundings and music for the current craft and language. */
  private applyScene(): void {
    const scene = this.craft === 'piano' ? SCENES.music : SCENES[LANGUAGES[this.language].scene];
    if (this.immersive) void this.env.show(scene, import.meta.env.BASE_URL);
    else this.env.hide();
    // In the place, a desk stands exactly where your real table is (the real
    // one is hidden); at the piano the grand takes its place.
    this.desk.virtualTable.visible = this.craft !== 'piano' && (this.immersive || !this.onRealDesk);
    // Light the objects with the same place they sit in.
    const level = this.world.activeLevel.peek();
    if (level?.hasComponent(IBLTexture)) {
      level.setValue(IBLTexture, 'src', `${import.meta.env.BASE_URL}${this.immersive ? scene.light : 'env/studio_1k.hdr'}`);
      level.setValue(IBLTexture, '_needsUpdate', true);
    }
    const tracks = scene.tracks.map((t) => `${import.meta.env.BASE_URL}${t}`);
    if (this.mode === 'demo2d') return;
    if (this.craft === 'piano' || tracks.length === 0) {
      this.sfx.stopMusic(0.8);
    } else if (this.sfx.tracks.join() !== tracks.join()) {
      this.sfx.stopMusic(0.6);
      this.sfx.tracks = tracks;
      setTimeout(() => this.sfx.restartMusic(), 700);
    } else {
      this.sfx.startMusic();
    }
  }

  private setLanguage(language: Language): void {
    if (language === this.language || this.mode === 'demo2d' || this.mode === 'placing') return;
    this.language = language;
    if (this.craft !== 'calligraphy') this.setCraft('calligraphy');
    else this.startLesson(this.firstUnpassed(), true);
    this.applyScene();
  }

  private lessonCount(): number {
    return this.craft === 'piano' ? SONGS.length + 1 : this.lessons().length;
  }

  private lessonIds(): string[] {
    return this.craft === 'piano' ? this.songs().map((s) => s.id) : this.lessons().map((l) => l.id);
  }

  private firstUnpassed(): number {
    const ids = this.lessonIds();
    const i = ids.findIndex((id) => !this.progress.lessons[id]?.passed);
    return i === -1 ? ids.length - 1 : i;
  }

  private setCraft(craft: Craft): void {
    if (craft === this.craft || this.mode === 'demo2d' || this.mode === 'placing') return;
    this.craft = craft;
    const piano = craft === 'piano';
    this.desk.callig.visible = !piano;
    this.piano.root.visible = piano;
    // At the piano the grand replaces any fallback table.
    this.desk.virtualTable.visible = !piano && !this.onRealDesk;
    this.desk.root.updateWorldMatrix(true, false);
    this.piano.fitToFloor(this.desk.root.matrixWorld.elements[13]);
    // New surroundings; background music is silenced at the piano (it would
    // compete with the notes).
    this.applyScene();
    this.layoutPanels();
    // The calibration seal sits on the paper, or beside the keyboard.
    this.calX = piano ? 0.215 : SEAL_X;
    this.calZ = piano ? 0.085 : SEAL_Z;
    this.desk.seal.position.set(this.calX, this.desk.seal.position.y, this.calZ);
    this.desk.sealRing.position.set(this.calX, this.desk.sealRing.position.y, this.calZ);
    this.desk.cursor.visible = false;
    this.startLesson(this.firstUnpassed(), true);
  }

  private pianoEyebrow(): string {
    return `PIANO  -  ${this.lessonIndex + 1} OF ${SONGS.length + 1}  -  ${this.piano.song.name.toUpperCase()}`;
  }

  /** The built-in songs, then the learner's own (or an empty "Your tune" slot). */
  private songs(): PianoSong[] {
    return [
      ...SONGS,
      this.customSong ?? { id: CUSTOM_ID, name: 'Your tune', teaching: '', bpm: 60, notes: [] },
    ];
  }

  /** The master listens while the learner plays their own tune. */
  private startListening(): void {
    if (this.craft !== 'piano' || this.mode === 'demo2d' || this.mode === 'placing') return;
    this.mode = 'piano';
    this.lessonIndex = SONGS.length;
    this.showCaptionActions(false);
    this.piano.startListen(SONGS.length);
    this.setCaption(
      'PIANO  -  YOUR TUNE',
      'Play me your tune',
      'Play any keys, one at a time: a melody you know, or a new one. Stop for three seconds when you are done and the master will learn it.',
    );
    this.refreshMenu();
    this.log('listen');
  }

  private startSong(index: number, watchFirst: boolean): void {
    const song = this.songs()[index];
    if (!song.notes.length) {
      this.startListening();
      return;
    }
    this.lessonIndex = index;
    this.piano.tempo = Math.max(0.5, Math.min(1, this.tempo + 0.2));
    this.piano.loadSong(index, song);
    this.showCaptionActions(false);
    // Clear calligraphy ink so a later switch back starts clean.
    for (const r of this.userRibbons) this.fadeOut(r, 0.3);
    this.userRibbons = [];
    this.ghost.visible = true;
    this.ghost.opacity = this.guideMode === 'off' ? 0.3 : 0.78 - 0.56 * this.skill();
    if (watchFirst) {
      this.mode = 'piano';
      this.piano.startWatch();
      this.setCaption(
        this.pianoEyebrow(),
        'Listen to the master',
        `${this.piano.song.teaching} ${this.piano.song.notes.length} notes. Just watch and listen for now.`,
      );
    } else {
      this.beginPractice();
    }
    this.refreshMenu();
    this.applyPanelVisibility();
    this.log(`lesson ${this.piano.song.id} (${watchFirst ? 'watch' : 'practice'})`);
    if (import.meta.env.DEV) {
      this.desk.paper.updateWorldMatrix(true, false);
      const w = (x: number, y: number, z: number) => {
        const p = new Vector3(x, y, z).applyMatrix4(this.desk.paper.matrixWorld);
        return [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)];
      };
      this.log(`piano-layout ${JSON.stringify({ ...(this.piano.layout(w) as object), seal: w(this.calX, 0, this.calZ) })}`);
    }
  }

  private promptNote(first = false): void {
    const total = this.piano.song.notes.length;
    const i = this.piano.noteIndex;
    this.setCaption(
      first && !this.progress.lessons[this.piano.song.id] ? 'YOUR TURN' : this.pianoEyebrow(),
      first ? 'Your turn' : `Note ${Math.min(i + 1, total)} of ${total}`,
      first
        ? 'Tap the glowing key with any fingertip. The master plays with you. Keep to the beat and the keys turn gold.'
        : 'Tap the glowing key. Stay on the beat to turn it gold.',
    );
  }

  private onPianoEvent(ev: ReturnType<PianoMode['update']>): void {
    if (ev.type === 'watch-done') {
      this.applyGuideStrength();
      this.beginPractice();
    } else if (ev.type === 'note') {
      this.progress.strokes++;
      if (ev.correct) {
        this.log(`note ${ev.index} correct${ev.inTime ? ' on-beat' : ''}`);
        if (ev.inTime && !this.progress.seenLock) {
          this.progress.seenLock = true;
          this.setCaption(this.pianoEyebrow(), 'In unison', 'You played with the master, on the beat. Notes on the beat turn gold.');
        } else if (this.clock - this.pianoHintAt > 1.5) {
          this.promptNote();
        }
      } else {
        this.log(`note ${ev.index} wrong`);
        this.pianoHintAt = this.clock;
        this.setCaption(this.pianoEyebrow(), 'Not that key', 'Look for the key that glows red-orange, under the master\'s finger.');
      }
    } else if (ev.type === 'heard') {
      if (ev.count === 1 || ev.count % 4 === 0) {
        this.setCaption('PIANO  -  YOUR TUNE', `Listening: ${ev.count} note${ev.count === 1 ? '' : 's'}`, 'Keep going. Stop for three seconds when your tune is done.');
      }
    } else if (ev.type === 'learned') {
      this.customSong = ev.song;
      saveCustomSong(ev.song);
      delete this.progress.lessons[CUSTOM_ID]; // a new tune starts a new record
      saveProgress(this.progress);
      this.sfx.chime(0);
      this.log(`learned ${ev.song.notes.length} notes bpm ${ev.song.bpm}`);
      this.startSong(SONGS.length, true);
      this.setCaption(
        'PIANO  -  YOUR TUNE',
        'The master learned your tune',
        `${ev.song.notes.length} notes. Listen to the master play it back, then play it together.`,
      );
    } else if (ev.type === 'complete') {
      this.completeSong(ev.score, ev.accuracy, ev.rhythm);
    }
  }

  private completeSong(score: number, accuracy: number, rhythm: number): void {
    this.log(`lesson complete score ${score} accuracy ${accuracy.toFixed(2)} rhythm ${rhythm.toFixed(2)}`);
    const song = this.piano.song;
    const record = lessonProgress(this.progress, song.id);
    const prevBest = record.best;
    record.attempts++;
    record.best = Math.max(record.best, score);
    record.passed = record.passed || score >= PASS_SCORE;
    const days = markPracticeDay(this.progress);
    saveProgress(this.progress);
    this.sfx.fanfare();
    for (const k of this.piano.keys) this.sparks.burst((k.x0 + k.x1) / 2, k.top - SURFACE_Y, (k.z0 + k.z1) / 2, 2, 0.14);
    const isLast = this.lessonIndex === this.lessonCount() - 1;
    const stars = '*'.repeat(this.stars(score)) || '-';
    this.setCaption(
      this.pianoEyebrow(),
      `${song.name} complete  ${stars}`,
      score > prevBest && prevBest > 0
        ? `New best (was ${prevBest}). The master's hand will fade a little more next time.`
        : `${Math.round(accuracy * 100)}% of keys right, ${Math.round(rhythm * 100)}% on the beat.`,
      `Score ${score}  -  ${days > 1 ? `${days}-day streak` : 'practised today'}`,
    );
    this.menu?.getElementById('btn-next')?.setProperties({ display: isLast ? 'none' : 'flex' });
    this.showCaptionActions(true);
    this.refreshMenu();
  }

  /** All ten fingertips (both hands), paper-local, for the piano. */
  private readAllTips(): void {
    for (const t of this.tips) t.valid = false;
    const frame = this.xrFrame as
      | (XRFrame & { fillPoses?: (spaces: XRSpace[], base: XRSpace, out: Float32Array) => boolean })
      | undefined;
    const ref = this.renderer.xr.getReferenceSpace();
    const session = this.renderer.xr.getSession();
    if (!frame?.fillPoses || !ref || !session) return;
    this.player.updateWorldMatrix(true, false);
    this.desk.paper.updateWorldMatrix(true, false);
    this.paperInv.copy(this.desk.paper.matrixWorld).invert();
    let h = 0;
    for (const source of session.inputSources) {
      if (!source.hand || h > 1) continue;
      let spaces = this.jointSpaces.get(source);
      if (!spaces) {
        spaces = Array.from(source.hand.values());
        this.jointSpaces.set(source, spaces);
      }
      const buf = this.handJoints[h];
      if (frame.fillPoses(spaces, ref, buf)) {
        [4, 9, 14, 19, 24].forEach((j, f) => {
          // Extended = tip far from its finger's base joint (curled tips tuck in close).
          const base = f === 0 ? 1 : j - 4;
          const reach = Math.hypot(
            buf[j * 16 + 12] - buf[base * 16 + 12],
            buf[j * 16 + 13] - buf[base * 16 + 13],
            buf[j * 16 + 14] - buf[base * 16 + 14],
          );
          this.v.set(buf[j * 16 + 12], buf[j * 16 + 13], buf[j * 16 + 14]);
          if (!this.playerIsIdentity) this.v.applyMatrix4(this.player.matrixWorld);
          this.v.applyMatrix4(this.paperInv);
          const t = this.tips[h * 5 + f];
          t.x = this.v.x;
          t.y = this.v.y;
          t.z = this.v.z;
          t.valid = true;
          if (f === 0) {
            // A thumb tucked against the side of the hand (pointing, fist) is
            // not playing, however straight it is: near the index finger's base.
            const tuck = Math.hypot(
              buf[4 * 16 + 12] - buf[6 * 16 + 12],
              buf[4 * 16 + 13] - buf[6 * 16 + 13],
              buf[4 * 16 + 14] - buf[6 * 16 + 14],
            );
            t.extended = reach > 0.045 && tuck > 0.045;
          } else {
            t.extended = reach > 0.06;
          }
        });
      }
      h++;
    }
  }

  private updateHanko(dt: number): void {
    if (this.hankoAnim < 0) return;
    const t = (this.hankoAnim += dt);
    const h = this.desk.hanko.position;
    const homeX = HANKO_HOME.x - 0.04;
    const homeZ = HANKO_HOME.z;
    const dishX = HANKO_HOME.x;
    const lerp = (a: number, b: number, k: number) => a + (b - a) * smooth(clamp01(k));
    if (t < 0.35) {
      // lift and slide over the paste dish
      h.set(lerp(homeX, dishX, t / 0.35), lerp(0, 0.05, t / 0.35), homeZ);
    } else if (t < 0.6) {
      // dip into the paste
      const k = (t - 0.35) / 0.25;
      h.set(dishX, 0.05 - 0.04 * Math.sin(Math.PI * k), homeZ);
    } else if (t < 1.1) {
      // arc over to the page corner
      const k = (t - 0.6) / 0.5;
      h.set(lerp(dishX, STAMP_X, k), 0.05 + Math.sin(Math.PI * smooth(k)) * 0.04, lerp(homeZ, STAMP_Z, k));
    } else if (t < 1.3) {
      // press
      const k = (t - 1.1) / 0.2;
      h.set(STAMP_X, lerp(0.05, SURFACE_Y, k), STAMP_Z);
      if (k >= 0.99 && !this.desk.stamp.visible) {
        this.desk.stamp.visible = true;
        this.stampAnim = 0;
        this.sfx.stamp();
        setTimeout(() => this.sfx.fanfare(), 200);
      }
    } else if (t < 1.55) {
      const k = (t - 1.3) / 0.25;
      h.set(STAMP_X, lerp(SURFACE_Y, 0.06, k), STAMP_Z);
    } else if (t < 2.2) {
      const k = (t - 1.55) / 0.65;
      h.set(lerp(STAMP_X, homeX, k), 0.06 * (1 - smooth(clamp01(k))), lerp(STAMP_Z, homeZ, k));
    } else {
      h.set(homeX, 0, homeZ);
      this.hankoAnim = -1;
    }
  }

  private fadeOut(ribbon: InkRibbon, dur: number): void {
    this.fading.push({ ribbon, t: 0, dur });
  }

  // ---------------------------------------------------------------- frame

  update(delta: number): void {
    const dt = Math.min(delta, 0.05);
    this.clock += dt;
    this.ghost.tick(this.clock);

    // Fading ink.
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i];
      f.t += dt;
      f.ribbon.material.opacity = 1 - clamp01(f.t / f.dur);
      if (f.t >= f.dur) {
        f.ribbon.mesh.removeFromParent();
        f.ribbon.dispose();
        this.fading.splice(i, 1);
      }
    }

    // Desk arrival: the paper unrolls toward you.
    if (this.arrival < 1) {
      this.arrival = Math.min(1, this.arrival + dt / 0.7);
      const e = smooth(this.arrival);
      this.desk.body.scale.set(1, 1, 0.04 + 0.96 * e);
      this.desk.body.position.y = 0.04 * (1 - e);
    }
    this.updateHanko(dt);
    // Surroundings follow the head: infinitely far, no parallax.
    if (this.mode === 'demo2d') this.camera.getWorldPosition(this.head);
    else this.player.head.getWorldPosition(this.head);
    this.env.update(dt, this.head.x, this.head.y, this.head.z);
    // Spatial audio: the ears follow the head.
    if (this.mode !== 'demo2d') {
      this.player.head.getWorldQuaternion(this.headQuat);
      this.earF.set(0, 0, -1).applyQuaternion(this.headQuat);
      this.earU.set(0, 1, 0).applyQuaternion(this.headQuat);
      this.sfx.setListener(this.head.x, this.head.y, this.head.z, this.earF.x, this.earF.y, this.earF.z, this.earU.x, this.earU.y, this.earU.z);
    }
    this.sparks.update(dt);
    if (this.locked && this.penDown && this.tipValid) {
      this.sparkClock += dt;
      if (this.sparkClock > 0.05) {
        this.sparkClock = 0;
        this.sparks.burst(this.tip.x, 0.003, this.tip.z, 2, 0.08);
      }
    }
    // Seal imprint appears.
    if (this.stampAnim < 1) {
      this.stampAnim = Math.min(1, this.stampAnim + dt / 0.35);
      const e = smooth(this.stampAnim);
      this.desk.stamp.scale.setScalar(1.6 - 0.6 * e);
      (this.desk.stamp.material as { opacity: number }).opacity = e;
    }

    switch (this.mode) {
      case 'demo2d': {
        if (!this.stepChoreo(dt, true)) {
          this.demoLoopPause += dt;
          if (this.demoLoopPause > 2.2) {
            this.demoLoopPause = 0;
            this.startWatchChoreo(0.9);
          }
        }
        this.poseGhost();
        return;
      }
      case 'placing': {
        this.placingClock += dt;
        if (this.tryPlaceOnPlane()) this.finishPlacing(true);
        else if (this.placingClock > PLACE_TIMEOUT) {
          this.logPlanes();
          this.placeVirtual();
          this.finishPlacing(false);
        }
        return;
      }
      default:
        break;
    }

    // Clean pause: while the Quest system menu has focus, freeze the lesson
    // (no ink, no timers) and resume exactly where the learner left off.
    if (this.world.visibilityState.peek() === VisibilityState.VisibleBlurred) {
      if (this.penDown) this.penUp();
      this.sfx.setScratch(0);
      return;
    }
    this.readTip(dt);
    this.updatePoke();
    this.updateCursor();
    this.lockBlend += ((this.locked ? 1 : 0) - this.lockBlend) * Math.min(1, dt * 8);
    this.ghost.gold = this.lockBlend;

    if (this.mode === 'watch') {
      this.ghost.visible = true;
      this.ghost.opacity = 0.8;
      if (!this.stepChoreo(dt, true)) {
        this.applyGuideStrength();
        this.beginPractice();
      }
    } else if (this.mode === 'calibrate') {
      // The master demonstrates: a slow tap on the seal, then a pause.
      if (!this.stepChoreo(dt, false)) {
        const cycle = (this.clock % 2.4) / 2.4;
        const tap = cycle < 0.45 ? Math.sin((cycle / 0.45) * Math.PI) : 0;
        this.ghostTip.set(this.calX + 0.004, TIP_CONTACT_Y + (1 - tap) * 0.035, this.calZ);
        this.easeLean(0, 0, dt);
      }
      this.updateCalibrate(dt);
    } else if (this.mode === 'piano') {
      this.ghost.visible = this.guideMode !== 'off' || this.piano.phase === 'watch';
      this.readAllTips();
      const ev = this.piano.update(dt, this.tips, this.surfaceOffset);
      this.ghostTip.copy(this.piano.ghostTip);
      this.easeLean(0, 0, dt);
      this.ghost.gold = Math.max(this.lockBlend, this.piano.gold);
      this.onPianoEvent(ev);
    } else if (this.mode === 'practice') {
      this.ghost.visible = this.guideMode !== 'off' || this.lockBlend > 0.01;
      this.updatePractice(dt);
    } else if (this.mode === 'complete') {
      this.stepChoreo(dt, false);
      this.ghost.opacity = Math.max(0, this.ghost.opacity - dt * 0.3);
    }
    if (this.ghost.visible) this.poseGhost();
  }
}

function pointInPolygon(polygon: ReadonlyArray<DOMPointReadOnly>, x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
