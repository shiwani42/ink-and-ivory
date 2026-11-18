import {
  Color,
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
import { HeldTool } from './ghost/held-tool.js';
import { HandCues } from './hands/hand-cues.js';
import { HoldGate, thumbsUpConfidence } from './hands/hand-gestures.js';
import { GhostPoseBuilder, JOINT_COUNT, type Handedness } from './ghost/ghost-pose.js';
import { Sparks } from './fx/sparks.js';
import { type FingerTip, PianoMode } from './piano/piano-mode.js';
import {
  addTune,
  clearCustomSong,
  decodeTune,
  encodeTune,
  loadTunes,
  MAX_TUNES,
  songFromMidi,
  tuneCodeFromUrl,
} from './piano/custom-song.js';
import { parsePreset, type Preset } from './presets.js';
import { dailyEcho, phrasesOf, SONG_UNITS, SONGS, type PianoSong } from './piano/songs.js';
import { GOLD, GUIDE_COLOR, INK_COLOR, InkRibbon, VERMILION } from './ink/ink-ribbon.js';

import { Environment, SCENES, type SceneDef } from './env/environment.js';
import { loadOwnPano, makeOwnPano } from './env/own-pano.js';
import { generatePano } from './env/text-pano.js';
import { DeskMemory } from './mr/desk-memory.js';
import { gatherPlanes } from './mr/plane-source.js';
import { describeReport, emptyReport, findTableSpot, type PlaneInput, resetReport } from './mr/room-placement.js';
import { type Language, LANGUAGES, LESSON_SETS, LESSONS, type Lesson, type Unit, UNITS } from './lessons/lessons.js';
import { CHAR_SIZE, StrokePath } from './lessons/master-path.js';
import { PASS_SCORE, scoreStroke, type StrokeScore } from './lessons/scoring.js';
import {
  clearProgress,
  DAILY_GOAL,
  dailyCount,
  helpLevel,
  lessonProgress,
  loadProgress,
  markDaily,
  markPracticeDay,
  saveProgress,
  today,
  type Progress,
} from './progress.js';

/**
 * Ink and Ivory: the whole experience in one system.
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
const NEW_TUNE_ID = 'piano-new-tune';
const RULE_COLOR = new Color('#5f7fa3'); // ruled lines on lettering paper
/** Broad nib for English italic: held at 40 degrees, so thickness follows direction. */
const NIB_X = Math.cos((40 * Math.PI) / 180);
const NIB_Z = -Math.sin((40 * Math.PI) / 180); // up the page is -z
/** Ghost opacity for each help level (full guide, outline, from memory), before in-attempt fading. */
const HELP = [1, 0.55, 0.2];
/** Poke feedback: a fingertip within this distance in front of a button hovers it. */
const POKE_HOVER = 0.07;
/** Tracking loss: grace before a stroke is called off, and before the hint shows. */
const STROKE_LOST_GRACE = 0.15;
const HINT_AFTER_TIMED = 0.3; // piano playing, or mid-stroke: the lesson pauses at once
const HINT_AFTER_IDLE = 2.5; // waiting phases: resting hands are fine, so be patient
/**
 * Poke hover and press: UIKit "important" class layers outrank inline and
 * :hover styles, and come off cleanly. Dark buttons (Next lesson, Write it
 * again) get a darker gold so their cream label keeps its contrast.
 */
const HOVER_LIGHT = { important: { backgroundColor: '#ecd29a' } };
const HOVER_DARK = { important: { backgroundColor: '#6b4a1c' } };
const PRESS_LIGHT = { important: { backgroundColor: '#d9a441' } };
const PRESS_DARK = { important: { backgroundColor: '#a8231a' } };
type StyleClass = typeof HOVER_LIGHT;
interface ClassListOwner {
  classList: { add(c: StyleClass): void; remove(c: StyleClass): void };
}
/** Microgestures on the hand's xr-standard gamepad (IWSDK/IWER mapping). */
const MG_SWIPE_LEFT = 5;
const MG_SWIPE_RIGHT = 6;
const MG_TAP = 9;

const NO_PIANO_EVENT = { type: 'none' } as const;
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
  /** Menu elements set to display: none. Their old position must not take a poke. */
  private hidden = new Set<string>(['piano-row']);
  private pokeTip = new Vector3();
  private lastTriggerId = '';
  private lastTriggerAt = 0;
  private captionActionsShown = false;
  private nextButton?: PokeButton;
  private sparks = new Sparks();
  private sparkClock = 0;
  private craft: Craft = 'calligraphy';
  private language: Language = 'japanese';
  private env = new Environment(); // the place you practise in (real 360 photographs)
  /** Surroundings on (false = your own room, the default: mixed reality first). */
  private immersive = false;
  /** With surroundings on: your own photo instead of the craft's place. */
  private ownScene = false;
  private ownPanoUrl?: string;
  private ownPanoVersion = 0;
  private panoInput?: HTMLInputElement;
  private onRealDesk = false;
  private piano!: PianoMode;
  private tips: FingerTip[] = Array.from({ length: 10 }, () => ({ x: 0, y: 0, z: 0, valid: false, extended: false }));
  private handJoints = [new Float32Array(JOINT_COUNT * 16), new Float32Array(JOINT_COUNT * 16)];
  private calX = SEAL_X; // calibration target (moves beside the keyboard in piano mode)
  private calZ = SEAL_Z;
  private pianoHintAt = -10;
  /** The learner's own tunes (played to the master, from a MIDI file, or a shared link). */
  private tunes: PianoSong[] = loadTunes();
  /** A tune that arrived in the page link (?tune=...), opened once the keyboard is placed. */
  private sharedTune?: PianoSong;
  private daily: PianoSong = dailyEcho();
  private dailyDay = today();
  /** The unit shown on the menu. */
  private unitPage = 0;
  /**
   * In-attempt help, 0..1: falls while you move with the master, comes back
   * slowly after a slip (a skill-adaptive ghost, as in the CHI 2026 study).
   */
  private assist = 1;
  private assistNoted = false;
  /** Piano songs are taught phrase by phrase, then played whole. */
  private phrases: [number, number][] = [[0, 0]];
  private phraseIndex = 0;
  private wholeRun = true;
  private fullSong?: PianoSong;
  private dirX = 0;
  private dirZ = 1;
  /** The brush or dip pen in the master's hand and in yours (its tip where the ink lands). */
  private ghostTool?: HeldTool;
  private userTool?: HeldTool;
  private shownJointsRef: Float32Array = this.ghostJoints;
  private ruleRibbons: InkRibbon[] = [];
  private toolTip = new Vector3();
  private toolWeb = new Vector3();
  private toolTmp = new Vector3();
  private lastEye = new Vector3(0, 0.44, 0.4);
  private fitClock = 0;
  /**
   * Real pen mode (beta): you hold a real pen, brush or chopstick and its tip
   * touches the desk. Touching the seal with the tip teaches where the tip
   * sits relative to your index knuckle; from then on the tip is computed
   * from that joint every frame and read exactly like a fingertip.
   */
  private writeWith: 'finger' | 'pen' = 'finger';
  private penOffset?: Vector3;
  private penHand?: XRHandedness;
  private penM = new Matrix4();
  private penCand = new Matrix4();
  private penCandidate?: { m: Matrix4; height: number; hand?: XRHandedness };
  private midiInput?: HTMLInputElement;
  private genOverlay?: HTMLDivElement;
  private generating = false;
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
  private calibLow?: number; // lowest still touch over the calibration target, paper-local
  private calibAsked = false;
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
  // Mixed reality: room-aware placement and the remembered desk spot (src/mr/).
  private deskMemory!: DeskMemory;
  private planePool: PlaneInput[] = [];
  private placeReport = emptyReport();
  private placeHow = 'detected table';
  private parentInv = new Matrix4();
  private axis = new Vector3();
  private lastPoseLog = -10;

  // hand-input feedback and gestures
  private cues = new HandCues();
  private hoverButton?: PokeButton;
  private hoverStyle?: StyleClass;
  private pressButton?: PokeButton;
  private pressStyle?: StyleClass;
  private pressUntil = 0;
  private pokeBest: (PokeButton | undefined)[] = [undefined, undefined];
  private pokeBestDepth = [0, 0];
  private panelQuat = new Quaternion();
  private thumbsGate = new HoldGate(0.6, 0.7, 0.35);
  private thumbsAt = new Vector3();
  private thumbsLogged = 0;
  private handsLostFor = 0;
  private strokeLostFor = 0;
  private handsHint = false;
  private captionRecord = ['INK AND IVORY', ' ', ' ', ' '];
  private mgPrev = [0, 0];

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
        // Dev only, for tools/e2e_room.py: P places again where you are, M does the
        // same but may use the remembered spot (like a new session), L logs the planes.
        if (e.shiftKey && this.mode !== 'demo2d' && this.mode !== 'placing') {
          const k = e.key.toLowerCase();
          if (k === 'm') this.deskMemory.arm();
          if (k === 'p' || k === 'm') this.beginPlacing();
          if (k === 'l') this.logPlanes();
        }
      };
      window.addEventListener('keydown', onKey);
      this.cleanupFuncs.push(() => window.removeEventListener('keydown', onKey));
    }
    if (import.meta.env.DEV) {
      // Dev only: tools feed a test photo to the own-background converter.
      (window as unknown as { __hoamAddPano?: (f: File) => Promise<void> }).__hoamAddPano = (f) => this.addPano(f);
      (window as unknown as { __hoamPaint?: (t: string) => void }).__hoamPaint = (t) => {
        this.describePano();
        (this.genOverlay!.querySelector('#hoam-gen-text') as HTMLTextAreaElement).value = t;
        this.genOverlay!.querySelector('form')!.requestSubmit();
      };
      void import('./env/logo-cap.js').then(({ drawLogo }) => {
        (window as unknown as { __hoamLogo?: () => string }).__hoamLogo = () => drawLogo(1024).toDataURL('image/png');
      });
    }
    if (this.preset?.state === 'fresh') {
      clearProgress();
      clearCustomSong();
      this.tunes = [];
      this.preset = undefined;
      this.log('preset fresh: progress cleared');
    }
    this.progress = loadProgress();
    this.writeWith = this.progress.writeWith ?? 'finger';
    this.immersive = this.progress.scene === 'place' || this.progress.scene === 'own';
    this.ownScene = this.progress.scene === 'own';
    void loadOwnPano().then((blob) => {
      if (!blob) return;
      this.ownPanoUrl = URL.createObjectURL(blob);
      this.ownPanoVersion++;
      this.text(this.menu, 'btn-scene-label', this.sceneLabel());
    });
    const code = tuneCodeFromUrl();
    const shared = code ? decodeTune(code) : undefined;
    if (shared) {
      const { tunes, tune } = addTune(this.tunes, shared);
      this.tunes = tunes;
      this.sharedTune = tune;
      this.log(`shared tune ${tune.name} ${tune.notes.length} notes`);
    }
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
    this.deskMemory = new DeskMemory(this.world);
    // Effects live on their own layer at paper height, visible in both crafts.
    const fx = new Group();
    fx.position.y = SURFACE_Y;
    this.desk.body.add(fx);
    fx.add(this.sparks.points);
    this.piano = new PianoMode({
      play: (midi, velocity, x, y, z) => {
        this.sfx.piano(midi, velocity, x, y, z);
        if (import.meta.env.DEV) this.log(`key ${midi}`);
      },
      sparks: (x, y, z, n) => this.sparks.burst(x, y, z, n, 0.12),
      tick: (accent) => this.sfx.tok(accent ? 1.35 : 1.1),
    });
    this.piano.root.visible = false;
    this.desk.body.add(this.piano.root);
    this.ghost = new GhostHand();
    this.world.createTransformEntity(this.ghost.root, { persistent: true });
    this.poses = { left: new GhostPoseBuilder('left'), right: new GhostPoseBuilder('right') };
    this.ghostTool = new HeldTool(true);
    this.userTool = new HeldTool(false);
    this.world.createTransformEntity(this.ghostTool.root, { persistent: true });
    this.world.createTransformEntity(this.userTool.root, { persistent: true });
    this.world.createTransformEntity(this.cues.root, { persistent: true });
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
        make('welcome-panel', 0.115),
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
    this.welcome.position.set(0, 0.27, -0.36);
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
    } else {
      // On a computer or phone there is no mixed reality: say so plainly
      // instead of offering a button that cannot start anything.
      void this.checkXrSupport();
    }
    on(this.welcome, 'xr-button', () => this.world.launchXR());
    Array.from({ length: 9 }, (_, i) =>
      on(this.menu, `lesson-${i}`, () => {
        const unit = this.currentUnit();
        if (unit && i < unit.count) this.startLesson(unit.start + i, true);
      }),
    );
    on(this.menu, 'btn-unit-prev', () => this.pageUnit(-1));
    on(this.menu, 'btn-unit-next', () => this.pageUnit(1));
    on(this.menu, 'btn-review', () => this.startReview());
    on(this.menu, 'btn-tool', () => this.toggleWriteWith());
    on(this.menu, 'lang-english', () => this.setLanguage('english'));
    on(this.welcome, 'share-button', () => void this.copyTuneLink());
    on(this.menu, 'btn-slower', () => this.setTempo(this.tempo - 0.1));
    on(this.menu, 'btn-faster', () => this.setTempo(this.tempo + 0.1));
    on(this.menu, 'btn-watch', () => this.startLesson(this.lessonIndex, true));
    on(this.menu, 'btn-guide', () => this.cycleGuide());
    on(this.menu, 'btn-place', () => this.placeOrScan());
    on(this.menu, 'btn-text', () => this.toggleTextSize());
    on(this.menu, 'craft-cal', () => this.setCraft('calligraphy'));
    on(this.menu, 'lang-japanese', () => this.setLanguage('japanese'));
    on(this.menu, 'lang-chinese', () => this.setLanguage('chinese'));
    on(this.menu, 'btn-scene', () => this.cycleScene());
    on(this.welcome, 'pano-button', () => this.pickPano());
    on(this.welcome, 'gen-button', () => this.describePano());
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

    this.nextButton = this.pokeById('btn-next');
    this.refreshMenu();
    this.refreshWelcome();
    this.text(this.menu, 'btn-scene-label', this.sceneLabel());
    this.applyPanelVisibility();
  }

  private pokeById(id: string): PokeButton | undefined {
    for (const b of this.pokeButtons) if (b.id === id) return b;
    return undefined;
  }

  private async checkXrSupport(): Promise<void> {
    let supported = false;
    try {
      supported = !!(await navigator.xr?.isSessionSupported('immersive-ar'));
    } catch {
      supported = false;
    }
    this.log(`immersive-ar supported: ${supported}`);
    if (supported || !this.welcome) return;
    this.welcome.getElementById('xr-button')?.setProperties({ display: 'none' });
    this.welcome.getElementById<UIKit.Text>('xr-note')?.setProperties({ fontSize: 17, color: '#3d342c' });
    this.text(
      this.welcome,
      'xr-note',
      `This is a preview: the master writing on a loop. The lessons happen in mixed reality at your own desk. On a Meta Quest 3 or 3S, open ${location.host} in Meta Quest Browser.`,
    );
    if (!this.sharedTune) {
      this.text(
        this.welcome,
        'midi-note',
        'You can add a piano song here (a MIDI file), then copy its link and open that on your Quest: the master will already know it. Free public-domain pieces: mutopiaproject.org.',
      );
    }
  }

  private sceneLabel(): string {
    if (!this.immersive) return 'Scene: my room';
    return this.ownScene ? 'Scene: your photo' : 'Scene: 360 place';
  }

  /** Menu "Scene": your room, then the craft's 360 place, then your own photo (if added), then back. */
  private cycleScene(): void {
    if (!this.immersive) {
      this.immersive = true;
      this.ownScene = false;
    } else if (!this.ownScene && this.ownPanoUrl) {
      this.ownScene = true;
    } else {
      this.immersive = false;
      this.ownScene = false;
    }
    this.progress.scene = !this.immersive ? 'room' : this.ownScene ? 'own' : 'place';
    saveProgress(this.progress);
    this.text(this.menu, 'btn-scene-label', this.sceneLabel());
    this.log(`scene ${this.progress.scene}`);
    this.applyScene();
  }

  /** Start page: add your own background (a 360 panorama, or any photo converted into one). */
  private pickPano(): void {
    if (!this.panoInput) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) void this.addPano(file);
        input.value = '';
      });
      document.body.appendChild(input);
      this.panoInput = input;
      this.cleanupFuncs.push(() => input.remove());
    }
    this.panoInput.click();
  }

  /**
   * Start page (beta): describe a place in words and DiT360 paints a 360
   * panorama of it, which becomes your own background. A plain DOM form over
   * the 2D page: typing works with the Quest Browser's keyboard here, before
   * the headset session starts.
   */
  private describePano(): void {
    if (this.generating) return;
    if (!this.genOverlay) {
      const wrap = document.createElement('div');
      wrap.style.cssText =
        'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(21,17,13,0.55);z-index:20;font-family:Inter,system-ui,sans-serif';
      wrap.innerHTML = `
        <form style="width:min(520px,calc(100vw - 32px));box-sizing:border-box;background:#f4ede0;border:2px solid #d8ccb4;border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:12px;color:#1d1813">
          <div style="color:#a8231a;font-size:13px;font-weight:700;letter-spacing:2.4px">TEXT TO 360 (BETA)</div>
          <label for="hoam-gen-text" style="font-size:18px;font-weight:600;line-height:1.4">Describe the place you want around you while you practise.</label>
          <textarea id="hoam-gen-text" rows="3" maxlength="300" style="font:inherit;font-size:17px;padding:10px 12px;border-radius:12px;border:2px solid #d8ccb4;background:#fffaf1;color:#1d1813;resize:vertical">A quiet Japanese tea room with tatami mats and paper screens, soft morning light</textarea>
          <div style="display:flex;gap:10px">
            <button type="submit" id="hoam-gen-go" style="flex:1;height:52px;border:0;border-radius:14px;background:#1d1813;color:#f4ede0;font:inherit;font-size:17px;font-weight:700;cursor:pointer">Paint it</button>
            <button type="button" id="hoam-gen-close" style="height:52px;padding:0 18px;border:2px solid #d8ccb4;border-radius:14px;background:#ebe1cf;color:#1d1813;font:inherit;font-size:17px;font-weight:600;cursor:pointer">Close</button>
          </div>
          <div id="hoam-gen-status" role="status" style="font-size:15px;line-height:1.45;color:#3d342c;min-height:22px"></div>
          <div style="font-size:13px;line-height:1.4;color:#6f6255">Painted by DiT360 (Insta360 Research), a free public AI model on Hugging Face. It takes about a minute and only a few paintings a day per connection. Your words are sent to that service.</div>
        </form>`;
      document.body.appendChild(wrap);
      this.genOverlay = wrap;
      this.cleanupFuncs.push(() => wrap.remove());
      const form = wrap.querySelector('form')!;
      const close = () => {
        if (!this.generating) wrap.style.display = 'none';
      };
      wrap.querySelector('#hoam-gen-close')!.addEventListener('click', close);
      wrap.addEventListener('click', (e) => {
        if (e.target === wrap) close();
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = (wrap.querySelector('#hoam-gen-text') as HTMLTextAreaElement).value.trim();
        if (text) void this.paintPano(text);
      });
    }
    this.genOverlay.style.display = 'flex';
  }

  private async paintPano(prompt: string): Promise<void> {
    const wrap = this.genOverlay!;
    const status = wrap.querySelector('#hoam-gen-status') as HTMLDivElement;
    const go = wrap.querySelector('#hoam-gen-go') as HTMLButtonElement;
    const say = (s: string) => {
      status.textContent = s;
      this.text(this.welcome, 'midi-note', s);
    };
    this.generating = true;
    go.disabled = true;
    go.style.opacity = '0.5';
    const t0 = performance.now();
    say('Sending your description...');
    try {
      const file = await generatePano(prompt, say);
      this.log(`text to 360 painted in ${Math.round((performance.now() - t0) / 1000)} s, ${(file.size / 1e6).toFixed(1)} MB`);
      await this.addPano(file);
      say('Done: your painted place is now your background. Press "Begin at my desk"; the menu\'s Scene button switches it on or off.');
      this.generating = false;
      setTimeout(() => {
        if (!this.generating) wrap.style.display = 'none';
      }, 2500);
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      say(`Sorry, it could not be painted: ${why}`);
      this.log(`text to 360 failed: ${why}`);
    } finally {
      this.generating = false;
      go.disabled = false;
      go.style.opacity = '1';
    }
  }

  private async addPano(file: File): Promise<void> {
    this.text(this.welcome, 'midi-note', 'Making your background...');
    try {
      const { blob, converted, ms } = await makeOwnPano(file);
      if (this.ownPanoUrl) URL.revokeObjectURL(this.ownPanoUrl);
      this.ownPanoUrl = URL.createObjectURL(blob);
      this.ownPanoVersion++;
      this.immersive = true;
      this.ownScene = true;
      this.progress.scene = 'own';
      saveProgress(this.progress);
      this.text(this.menu, 'btn-scene-label', this.sceneLabel());
      this.text(
        this.welcome,
        'midi-note',
        converted
          ? 'Your photo is now a 360 background: it hangs in front of you, and its colours wrap all the way round. In the headset, the menu\'s Scene button switches it on or off.'
          : 'Your 360 panorama is your background. In the headset, the menu\'s Scene button switches it on or off.',
      );
      this.log(`own background ${converted ? 'converted from a photo' : 'panorama'} in ${ms} ms, ${(blob.size / 1e6).toFixed(1)} MB`);
      if (this.mode !== 'demo2d') this.applyScene();
    } catch (error) {
      this.text(this.welcome, 'midi-note', 'That image could not be used. Try a JPG or PNG photo.');
      console.warn('[hoam] own background failed', error);
    }
  }

  /** Your own photo as a place, turned so its centre is straight ahead of the writer. */
  private ownSceneDef(base: SceneDef): SceneDef {
    this.desk.root.getWorldPosition(this.v);
    if (this.mode !== 'demo2d') this.player.head.getWorldPosition(this.head);
    const fx = this.v.x - this.head.x;
    const fz = this.v.z - this.head.z;
    const yaw = Math.hypot(fx, fz) > 1e-3 ? -Math.atan2(fz, fx) : 0;
    return {
      ...base,
      id: `own-${this.ownPanoVersion}`,
      name: 'Your photo',
      panorama: this.ownPanoUrl!,
      light: 'env/studio_1k.hdr',
      credit: 'Your own photo',
      yaw,
      calm: 0.4,
    };
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
    let result: ReturnType<typeof songFromMidi>;
    try {
      result = songFromMidi(await file.arrayBuffer(), file.name);
    } catch {
      result = 'That MIDI file could not be read.';
    }
    if (typeof result === 'string') {
      this.text(this.welcome, 'midi-note', result);
      return;
    }
    const { tunes, tune } = addTune(this.tunes, result);
    this.tunes = tunes;
    delete this.progress.lessons[tune.id];
    saveProgress(this.progress);
    this.text(this.welcome, 'midi-note', `Added "${tune.name}" (${tune.notes.length} notes). In the headset: Piano, the "Your music" unit.`);
    this.log(`midi ${result.name} ${result.notes.length} notes bpm ${result.bpm}`);
    this.refreshMenu();
    this.refreshWelcome();
  }

  /** Start page: put a link to the newest tune on the clipboard (and in the address bar). */
  private async copyTuneLink(): Promise<void> {
    const tune = this.tunes[this.tunes.length - 1];
    if (!tune) return;
    const url = `${location.origin}${location.pathname}?tune=${encodeTune(tune)}`;
    try {
      history.replaceState(null, '', url);
    } catch {
      // ignore: the clipboard is the main path
    }
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      copied = false;
    }
    this.text(
      this.welcome,
      'midi-note',
      copied
        ? `Link to "${tune.name}" copied. Whoever opens it on a Quest finds the master already knows your tune.`
        : `The link to "${tune.name}" is now in the address bar: copy it from there and send it.`,
    );
    this.log(`share ${tune.name} ${copied ? 'copied' : 'address bar'}`);
  }

  private refreshWelcome(): void {
    const tune = this.tunes[this.tunes.length - 1];
    this.welcome?.getElementById('share-button')?.setProperties({ display: tune ? 'flex' : 'none' });
    if (tune) this.text(this.welcome, 'share-label', `Copy a link to "${tune.name}"`);
    if (this.sharedTune) {
      this.text(this.welcome, 'midi-note', `Someone shared a tune with you: "${this.sharedTune.name}". Begin at your desk and the master will teach it.`);
    }
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

  /** Show or hide a menu element, and remember it so a hidden button ignores pokes. */
  private display(id: string, on: boolean): void {
    this.menu?.getElementById(id)?.setProperties({ display: on ? 'flex' : 'none' });
    if (on) this.hidden.delete(id);
    else this.hidden.add(id);
  }

  private buttonActive(b: PokeButton): boolean {
    if (!b.panel.visible || this.hidden.has(b.id)) return false;
    if (b.id.startsWith('lang-') && this.hidden.has('languages')) return false;
    if (b.id === 'btn-record' && this.hidden.has('piano-row')) return false;
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
    this.pokeBest[0] = this.pokeBest[1] = undefined;
    if (this.penDown || this.pokeButtons.length === 0) {
      this.cues.hidePoke(0);
      this.cues.hidePoke(1);
      this.setPokeHover(undefined);
      return;
    }
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
        // Hover: the nearest button this fingertip is over, within reach in front.
        if (over && depth < POKE_HOVER && depth > -0.03) {
          const best = this.pokeBest[slot];
          if (!best || depth < this.pokeBestDepth[slot]) {
            this.pokeBest[slot] = b;
            this.pokeBestDepth[slot] = depth;
          }
        }
        if (over && prev > 0.004 && depth <= 0.004 && depth > -0.03) {
          this.trigger(b.id, b.fn);
          this.flashPress(b);
        }
      }
      // The poke cursor: on the panel surface, straight under the fingertip.
      const best = this.pokeBest[slot];
      if (best) {
        const d = this.pokeBestDepth[slot];
        const pe = best.panel.matrixWorld.elements;
        this.v2.set(pe[8], pe[9], pe[10]).normalize();
        best.panel.getWorldQuaternion(this.panelQuat);
        const surf = Math.max(0, d) - 0.0015; // just proud of the panel
        this.cues.showPoke(
          slot,
          this.pokeTip.x - this.v2.x * surf,
          this.pokeTip.y - this.v2.y * surf,
          this.pokeTip.z - this.v2.z * surf,
          this.panelQuat,
          d,
          POKE_HOVER,
        );
      } else {
        this.cues.hidePoke(slot);
      }
    }
    for (let s = handIndex; s < 2; s++) this.cues.hidePoke(s);
    // One hovered button at a time: the one a fingertip is closest to.
    const a = this.pokeBest[0];
    const b = this.pokeBest[1];
    this.setPokeHover(a && b ? (this.pokeBestDepth[0] <= this.pokeBestDepth[1] ? a : b) : (a ?? b));
    if (this.pressButton && this.clock > this.pressUntil) this.setPokePress(undefined);
  }

  private darkButton(b: PokeButton): boolean {
    return b.id === 'btn-next' || b.id === 'btn-again';
  }

  /** Light up the button under a fingertip (poke has no UIKit pointer, so no :hover). */
  private setPokeHover(b: PokeButton | undefined): void {
    if (b === this.hoverButton) return;
    if (this.hoverButton && this.hoverStyle) (this.hoverButton.el as unknown as ClassListOwner).classList.remove(this.hoverStyle);
    this.hoverButton = b;
    this.hoverStyle = undefined;
    if (b) {
      this.hoverStyle = this.darkButton(b) ? HOVER_DARK : HOVER_LIGHT;
      (b.el as unknown as ClassListOwner).classList.add(this.hoverStyle);
      this.log(`poke hover ${b.id}`);
    }
  }

  private setPokePress(b: PokeButton | undefined): void {
    if (this.pressButton && this.pressStyle) (this.pressButton.el as unknown as ClassListOwner).classList.remove(this.pressStyle);
    this.pressButton = b;
    this.pressStyle = undefined;
    if (b) {
      this.pressStyle = this.darkButton(b) ? PRESS_DARK : PRESS_LIGHT;
      (b.el as unknown as ClassListOwner).classList.add(this.pressStyle);
    }
  }

  /** A short flash on the button a fingertip pushed through, so the press reads at a glance. */
  private flashPress(b: PokeButton): void {
    this.setPokePress(b);
    this.pressUntil = this.clock + 0.28;
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
    this.lastEye.copy(eye);
    this.fitPanelsAboveDesk();
  }

  /**
   * No panel may cut into the desk (or the piano). Measure each panel's real
   * bounds in desk space, lift it so its lowest edge clears the surface, and
   * if that would raise its top far above the eyes, shrink it a little
   * instead (down to 80%). Re-run while panels lay themselves out.
   */
  private fitPanelsAboveDesk(): void {
    const piano = this.craft === 'piano';
    const clear = piano ? 0.07 : 0.03; // above the keys and case, or the paper and tools
    for (const [panel, cardId] of [[this.menu, 'menu-card'], [this.caption, 'caption-card']] as const) {
      if (!panel?.visible) continue;
      // A UIKit element's world matrix maps the unit square onto its
      // rectangle: its corners give the card's true extent (Box3 can't
      // measure UIKit's instanced text).
      const card = panel.getElementById(cardId) as unknown as Object3D | undefined;
      if (!card) continue;
      for (let pass = 0; pass < 2; pass++) {
        this.desk.root.updateWorldMatrix(true, true);
        panel.updateWorldMatrix(true, true);
        const e = card.matrixWorld.elements;
        const reach = Math.abs(e[1]) / 2 + Math.abs(e[5]) / 2; // half extent along world up
        if (reach < 1e-4) break; // not laid out yet
        const deskY = this.desk.root.matrixWorld.elements[13];
        const bottom = e[13] - reach - deskY;
        const top = e[13] + reach - deskY;
        if (bottom >= clear - 0.002) break;
        const lift = clear - bottom;
        const maxTop = this.lastEye.y + 0.12;
        if (top + lift > maxTop && pass === 0) {
          // Too tall to sit above the desk at this height: shrink, then lift.
          const height = Math.max(0.05, top - bottom);
          const k = Math.max(0.8, (maxTop - clear) / height);
          panel.scale.multiplyScalar(k);
          continue;
        }
        panel.position.y += lift;
        if (import.meta.env.DEV) this.log(`panel ${cardId} lifted ${(lift * 100).toFixed(1)} cm (bottom was ${(bottom * 100).toFixed(1)} cm)`);
      }
    }
  }

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
    const rec = this.captionRecord;
    rec[0] = eyebrow;
    rec[1] = title;
    rec[2] = body;
    rec[3] = score;
    // While the "bring your hands back" hint holds the card, keep the latest
    // caption and put it back when the hands return.
    if (this.handsHint) return;
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
    const level = ['', '  -  OUTLINE', '  -  FROM MEMORY'][this.guideMode === 'adaptive' ? helpLevel(this.progress, this.lesson.id) : 0];
    return `${LANGUAGES[this.language].name.toUpperCase()}  -  LESSON ${this.lessonIndex + 1} OF ${this.lessons().length}  -  ${this.lesson.meaning.toUpperCase()} (${this.lesson.reading})${level}`;
  }

  private refreshMenu(): void {
    if (!this.menu) return;
    const piano = this.craft === 'piano';
    const items = piano
      ? this.songs().map((s) => ({ id: s.id, name: s.name }))
      : this.lessons().map((l) => ({ id: l.id, name: cap(l.meaning) }));
    const units = this.units();
    this.unitPage = Math.min(units.length - 1, Math.max(0, this.unitPage));
    const unit = units[this.unitPage];
    this.text(this.menu, 'unit-count', `UNIT ${this.unitPage + 1} OF ${units.length}`);
    this.text(this.menu, 'unit-title', unit.title);
    this.text(this.menu, 'btn-unit-prev-label', '<');
    this.text(this.menu, 'btn-unit-next-label', '>');
    const dim = (id: string, off: boolean) =>
      this.menu?.getElementById<UIKit.Text>(id)?.setProperties({ color: off ? '#c9bba3' : '#1d1813' });
    dim('btn-unit-prev-label', this.unitPage === 0);
    dim('btn-unit-next-label', this.unitPage === units.length - 1);
    for (let i = 0; i < 9; i++) {
      const tile = this.menu.getElementById(`lesson-${i}`);
      const index = unit.start + i;
      const item = i < unit.count ? items[index] : undefined;
      this.display(`lesson-${i}`, !!item);
      if (!item) continue;
      const p = this.progress.lessons[item.id];
      // One star per pass: each pass, the master helps a little less.
      const stars = '*'.repeat(Math.min(3, p?.passes ?? (p?.passed ? 1 : 0)));
      this.text(this.menu, `lesson-${i}-label`, item.name);
      this.text(this.menu, `lesson-${i}-best`, p?.best ? `${stars} ${p.best}` : item.id === NEW_TUNE_ID ? 'Play it' : ' ');
      // The current lesson's tile is highlighted in warm gold.
      tile?.setProperties({ backgroundColor: index === this.lessonIndex ? '#e6cf9f' : '#ebe1cf' });
    }
    this.text(this.menu, 'menu-title', piano ? 'Piano lessons' : `${LANGUAGES[this.language].name} calligraphy`);
    this.display('languages', !piano);
    this.display('piano-row', piano);
    this.text(this.menu, 'btn-record-label', this.tunes.length ? 'Play a new tune' : 'Play your own tune');
    // Selected chips get a vermilion border and label (hover cannot override a border).
    const select = (id: string, on: boolean) => {
      this.menu?.getElementById(id)?.setProperties({ borderWidth: on ? 3 : 0, borderColor: '#a8231a' });
      this.menu?.getElementById<UIKit.Text>(`${id}-label`)?.setProperties({ color: on ? '#a8231a' : '#5e5246' });
    };
    for (const lang of ['japanese', 'chinese', 'english'] as Language[]) select(`lang-${lang}`, lang === this.language);
    select('craft-cal', !piano);
    select('craft-piano', piano);
    this.text(this.menu, 'tempo', `Tempo ${Math.round(this.tempo * 100)}%`);
    const guide = { adaptive: 'Guide: adaptive', always: 'Guide: always', off: 'Guide: off' }[this.guideMode];
    this.text(this.menu, 'btn-guide-label', guide);
    const days = this.progress.streak.days;
    const done = dailyCount(this.progress);
    const goal = done >= DAILY_GOAL ? 'goal met today' : `today ${done} of ${DAILY_GOAL}`;
    this.text(this.menu, 'streak', days > 0 ? `${days}-day streak  -  ${goal}` : `Daily goal: ${DAILY_GOAL} lessons`);
    this.display('btn-review', this.reviewIndex() >= 0);
    this.display('tool-row', !piano);
    this.text(this.menu, 'btn-tool-label', this.writeWith === 'pen' ? 'Write with: a real pen (beta)' : 'Write with: fingertip');
  }

  // ---------------------------------------------------------------- course

  /** The units of the current course (calligraphy in this language, or piano). */
  private units(): Unit[] {
    if (this.craft !== 'piano') return UNITS[this.language];
    const units: Unit[] = [];
    let start = 0;
    for (const u of SONG_UNITS) {
      units.push({ title: u.title, start, count: u.songs.length });
      start += u.songs.length;
    }
    units.push({ title: 'Your music', start, count: this.songs().length - start });
    return units;
  }

  private currentUnit(): Unit | undefined {
    return this.units()[this.unitPage];
  }

  private unitOf(index: number): number {
    const units = this.units();
    const k = units.findIndex((u) => index >= u.start && index < u.start + u.count);
    return k < 0 ? 0 : k;
  }

  private pageUnit(step: number): void {
    this.unitPage = Math.min(this.units().length - 1, Math.max(0, this.unitPage + step));
    this.refreshMenu();
  }

  /**
   * Review: the passed lesson that needs it most (lowest best score, then the
   * longest since it was practised). Practised from memory, no demonstration.
   */
  private reviewIndex(): number {
    const ids = this.lessonIds();
    let best = -1;
    let bestKey = Infinity;
    const now = today();
    ids.forEach((id, i) => {
      const p = this.progress.lessons[id];
      if (!p?.passed || i === this.lessonIndex) return;
      const key = p.best - (p.last && p.last !== now ? 10 : 0);
      if (key < bestKey) {
        bestKey = key;
        best = i;
      }
    });
    return best;
  }

  private startReview(): void {
    const i = this.reviewIndex();
    if (i < 0 || this.mode === 'demo2d' || this.mode === 'placing') return;
    this.log(`review ${this.lessonIds()[i]}`);
    this.startLesson(i, false);
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
    const demo = this.lessons().findIndex((l) => l.glyph === LESSONS[LESSONS.length - 1].glyph);
    this.loadLesson(demo < 0 ? 0 : demo);
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
    this.deskMemory.arm(); // the first placement may return to last session's spot
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

  private finishPlacing(realDesk: boolean, how = realDesk ? 'detected table' : 'virtual desk'): void {
    this.log(`placed on ${how} (room capture ${this.canScanRoom() ? 'available' : 'unavailable'})`);
    this.log(`placement ${describeReport(this.placeReport)}`);
    this.deskMemory.disarm();
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
    if (realDesk) this.deskMemory.remember(this.desk.root, how);
    if (this.applyPreset()) return;
    this.startLesson(this.lessonIndex, true);
    if (how === 'remembered spot') {
      this.setCaption(this.lessonEyebrow(), 'Welcome back', 'Your paper is on the same spot of your table as last time. Watch the master.');
    } else if (how === 'small table') {
      this.setCaption(this.lessonEyebrow(), 'Watch the master', 'Your table is small, so the paper overhangs it a little. Write over the table.');
    }
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
    if (!this.preset && this.sharedTune) {
      // A tune from a shared link: go straight to the piano and let the master play it.
      const id = this.sharedTune.id;
      this.sharedTune = undefined;
      this.mode = 'watch';
      if (this.craft !== 'piano') this.setCraft('piano');
      const index = this.songs().findIndex((x) => x.id === id);
      if (index >= 0) this.startLesson(index, true);
      return true;
    }
    const p = this.preset;
    if (!p) return false;
    this.preset = undefined; // once only; "Move paper here" later behaves normally
    if (p.lang) this.language = p.lang;
    if (p.scene) {
      this.immersive = p.scene === 'place';
      this.ownScene = false;
      this.text(this.menu, 'btn-scene-label', this.sceneLabel());
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
    this.unitPage = this.unitOf(index);
    this.assist = 1;
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
      this.calibLow = undefined;
      this.calibAsked = false;
      this.ghostTarget(this.calX + 0.03, HOVER_Y + 0.02, this.calZ + 0.02);
      if (this.writeWith === 'pen' && this.craft === 'calligraphy') {
        this.setCaption(
          'STEP 2 OF 3  -  YOUR PEN',
          'Rest your pen on the seal',
          'Hold a real pen, brush or chopstick the way you write. Rest its tip on the red seal, keep still while the ring grows, then lift.',
        );
        return;
      }
      if (this.craft === 'piano') {
        this.setCaption(
          'BEFORE YOU PLAY  -  TOUCH',
          'Rest a fingertip on the glowing C',
          'Middle C, glowing red. Rest your fingertip on it for a moment: this tells the keys where your table is.',
        );
        return;
      }
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
    this.applyTools();
    // Lettering paper: faint ruled lines for this lesson's letter size.
    for (const r of this.ruleRibbons) {
      r.mesh.removeFromParent();
      r.dispose();
    }
    this.ruleRibbons = [];
    for (const [k, g] of (this.lesson.guides ?? []).entries()) {
      const main = k === 1 || k === 2; // waist and baseline
      const r = new InkRibbon(RULE_COLOR, 0.00015, false);
      const z = (g - 0.5) * CHAR_SIZE;
      r.setPolyline([-0.115, 0.115], [z, z], main ? 0.0011 : 0.0007);
      r.material.opacity = main ? 0.5 : 0.28;
      r.mesh.renderOrder = 1;
      this.desk.paper.add(r.mesh);
      this.ruleRibbons.push(r);
    }
  }

  /** Brush and inkstone for Japanese and Chinese; dip pen, ink bottle and lined paper for English. */
  private applyTools(): void {
    const pen = this.language === 'english';
    this.desk.brushSet.visible = !pen;
    this.desk.penSet.visible = pen;
    this.desk.setPaper(pen ? 'lined' : 'grid');
    this.ghostTool?.setKind(pen ? 'pen' : 'brush');
    this.userTool?.setKind(pen ? 'pen' : 'brush');
  }

  /** Each frame: the master's tool in the ghost hand, yours in your writing hand. */
  private updateTools(): void {
    if (!this.ghostTool || !this.userTool) return;
    const callig = this.craft === 'calligraphy';
    // The master's: tip on the paper under the ghost fingertip, shaft through the ghost's thumb-index web.
    const ghostOn = callig && this.ghost.visible && this.ghost.opacity > 0.02 && this.mode !== 'placing';
    this.ghostTool.root.visible = ghostOn;
    if (ghostOn) {
      this.toolTip.set(this.ghostTip.x, Math.max(0.0008, this.ghostTip.y - TIP_CONTACT_Y + 0.0008), this.ghostTip.z);
      this.desk.paper.localToWorld(this.toolTip);
      this.jointWeb(this.shownJointsRef, this.toolWeb);
      this.ghostTool.place(this.toolTip, this.toolWeb, Math.min(0.85, this.ghost.opacity * 1.05));
    }
    // Yours: only while writing or calibrating, with the hand over the paper.
    const h = this.tipHeight();
    const userOn =
      callig &&
      this.writeWith === 'finger' &&
      (this.mode === 'practice' || this.mode === 'calibrate') &&
      this.tipValid &&
      h < 0.16 &&
      Math.abs(this.tip.x) < PAPER_W / 2 + 0.12 &&
      Math.abs(this.tip.z) < PAPER_D / 2 + 0.12 &&
      this.readWeb(this.toolWeb);
    this.userTool.root.visible = userOn;
    if (userOn) {
      this.toolTip.set(this.tip.x, Math.max(0.0008, h + 0.0008), this.tip.z);
      this.desk.paper.localToWorld(this.toolTip);
      this.userTool.place(this.toolTip, this.toolWeb);
    }
    // The resting tool is in your hand while you write.
    this.desk.restingBrush.visible = !(userOn && this.userTool.kind === 'brush');
    this.desk.restingPen.visible = !(userOn && this.userTool.kind === 'pen');
  }

  /** World point between thumb and index finger (proximal joints) from 25 joint matrices. */
  private jointWeb(j: Float32Array, out: Vector3): void {
    out.set(
      (j[2 * 16 + 12] + j[6 * 16 + 12]) / 2,
      (j[2 * 16 + 13] + j[6 * 16 + 13]) / 2,
      (j[2 * 16 + 14] + j[6 * 16 + 14]) / 2,
    );
  }

  /** Your writing hand's thumb-index web, in world space. */
  private readWeb(out: Vector3): boolean {
    const frame = this.xrFrame;
    const ref = this.renderer.xr.getReferenceSpace();
    const src = this.tipSource;
    if (!frame?.getJointPose || !ref || !src?.hand) return false;
    const a = src.hand.get('thumb-phalanx-proximal');
    const b = src.hand.get('index-finger-phalanx-proximal');
    const pa = a ? frame.getJointPose(a, ref) : undefined;
    const pb = b ? frame.getJointPose(b, ref) : undefined;
    if (!pa || !pb) return false;
    out.set(
      (pa.transform.position.x + pb.transform.position.x) / 2,
      (pa.transform.position.y + pb.transform.position.y) / 2,
      (pa.transform.position.z + pb.transform.position.z) / 2,
    );
    if (!this.playerIsIdentity) out.applyMatrix4(this.player.matrixWorld);
    return true;
  }

  /** How much the master helps on this lesson, 0..1, from how often it has been passed. */
  private help(id = this.craft === 'piano' ? this.piano.song.id : this.lesson.id): number {
    return HELP[helpLevel(this.progress, id)];
  }

  /** Ghost opacity for the current help level and in-attempt fading (0.08 to 0.8). */
  private ghostOpacity(): number {
    if (this.guideMode === 'off') return 0;
    if (this.guideMode === 'always') return 0.78;
    return 0.08 + 0.72 * this.help() * this.assist;
  }

  /** In-attempt fading: down while you keep up with the master, back up after a slip. */
  private nudgeAssist(delta: number): void {
    this.assist = Math.min(1, Math.max(0.12, this.assist + delta));
    if (!this.assistNoted && this.assist < 0.5 && this.guideMode === 'adaptive') {
      this.assistNoted = true;
      this.log('master letting go');
    }
  }

  private setGuideOpacity(v: number): void {
    for (const g of this.guideRibbons) g.material.opacity = v;
  }

  /**
   * The master lets go as you improve. Each pass of a lesson lowers the help:
   * full guide, then the outline only, then from memory (a faint trace).
   */
  private applyGuideStrength(): void {
    const level = this.guideMode === 'adaptive' ? helpLevel(this.progress, this.lesson.id) : 0;
    this.ghost.opacity = this.ghostOpacity();
    this.setGuideOpacity(this.guideMode === 'off' ? 0 : [0.3, 0.2, 0.05][level]);
  }

  /** English italic: a broad nib held at a fixed angle, thick or thin by direction. */
  private nibWidth(dx: number, dz: number): number {
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return 0.008;
    const cross = Math.abs((dx / len) * NIB_Z - (dz / len) * NIB_X);
    return 0.0022 + 0.0105 * cross;
  }

  private get broadNib(): boolean {
    return this.craft === 'calligraphy' && this.language === 'english';
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

  /** Try to put the paper on a detected table (src/mr/room-placement.ts). Returns true on success. */
  private tryPlaceOnPlane(): boolean {
    this.readHead();
    const count = gatherPlanes(this.queries.planes.entities, this.planePool);
    const spot = findTableSpot(this.planePool, this.head, this.fwd, resetReport(this.placeReport), count);
    if (!spot) return false;
    this.placeHow = spot.kind === 'small-table' ? 'small table' : 'detected table';
    const best = this.bestPlace.set(spot.x, spot.y + 0.001, spot.z);
    const yaw = Math.atan2(this.head.x - best.x, this.head.z - best.z);
    this.setDeskWorldPose(best, yaw);
    return true;
  }

  /** First placement of a session: last session's spot, if its persistent anchor came back. */
  private recallDesk(dt: number): 'wait' | 'placed' | 'no' {
    this.readHead();
    const r = this.deskMemory.recall(dt, this.head);
    if (r.state === 'pending') return 'wait';
    if (r.state === 'lost') {
      this.log(`remembered spot not used: ${r.why}`);
      this.deskMemory.disarm();
    }
    if (r.state !== 'ready') return 'no';
    resetReport(this.placeReport); // no planes were needed
    this.setDeskWorldPose(this.bestPlace.set(r.x, r.y, r.z), r.yaw);
    return 'placed';
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
        if (this.broadNib) {
          if (len > 1e-5) {
          this.dirX = dx / len;
          this.dirZ = dz / len;
        }
          ribbon.add(this.sample.x, this.sample.z, this.nibWidth(this.dirX, this.dirZ));
        } else {
          ribbon.add(this.sample.x, this.sample.z, 0.0118 - 0.006 * clamp01(speed / 0.22));
        }
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
      this.shownJointsRef = this.shownJoints;
    } else {
      this.ghost.setJoints(this.ghostJoints);
      this.shownJointsRef = this.ghostJoints;
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
      const pen = this.writeWith === 'pen';
      if (pen && this.penOffset && source.handedness !== this.penHand) continue; // only the calibrated hand
      const space = source.hand.get(pen ? 'index-finger-phalanx-proximal' : 'index-finger-tip');
      const pose = space ? frame.getJointPose(space, ref) : undefined;
      if (!pose) continue;
      if (pen) {
        this.penCand.fromArray(pose.transform.matrix);
        if (!this.playerIsIdentity) this.penCand.premultiply(this.player.matrixWorld);
        // The pen tip (once calibrated), else the knuckle itself (while calibrating).
        if (this.penOffset) this.v.copy(this.penOffset).applyMatrix4(this.penCand);
        else this.v.setFromMatrixPosition(this.penCand);
        this.v.applyMatrix4(this.paperInv);
        if (this.penOffset) this.v.y += TIP_CONTACT_Y; // read the tip like a fingertip pad
      } else {
        const p = pose.transform.position;
        this.v.set(p.x, p.y, p.z);
        if (!this.playerIsIdentity) this.v.applyMatrix4(this.player.matrixWorld);
        this.v.applyMatrix4(this.paperInv);
      }
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
        if (pen) this.penM.copy(this.penCand);
      }
    }
    if (!bestSource) {
      this.tipFilter.reset();
      return;
    }
    if (bestSource !== this.tipSource) {
      this.tipFilter.reset();
      // A different hand takes the brush (or one comes back from tracking
      // loss): it must be seen lifting before it can ink, so a hand that
      // reappears already on the paper never starts a stroke mid-page.
      if (!this.penDown && this.tipSource) this.needLift = true;
    }
    this.tipSource = bestSource;
    this.tipFilter.filter(this.v2.x, this.v2.y, this.v2.z, dt, this.tip);
    const ddx = this.tip.x - this.tipPrev.x;
    const ddz = this.tip.z - this.tipPrev.z;
    const moved = Math.hypot(ddx, ddz);
    if (moved > 0.0004) {
      const k = Math.min(1, dt * 18);
      this.dirX += (ddx / moved - this.dirX) * k;
      this.dirZ += (ddz / moved - this.dirZ) * k;
    }
    const sp = moved / Math.max(dt, 1e-3);
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
    if (this.writeWith === 'pen' && !this.penOffset) {
      this.calibratePen(dt);
      return;
    }
    if (this.craft === 'piano') this.piano.beacon('C4', 0.35 + 0.45 * pulse);
    // Where the fingertip actually rests is the real surface. Usually that is
    // within a centimetre of the detected table; but a room scan can be
    // stale (a standing desk raised or lowered since), so the touch can be far
    // above or below. Near (1.5 cm, the same bound as moving the set): accept
    // after a short hold. Anything further, including a pause on the way down: keep
    // the lowest still touch and confirm it when the finger lifts (a hand
    // hovering above the target never counts), then move the set onto it.
    const near = Math.hypot(this.tip.x - this.calX, this.tip.z - this.calZ) < 0.035;
    const h = this.tip.y;
    if (this.calibLow !== undefined && h > this.calibLow + 0.02) {
      this.finishCalibration(this.calibLow); // lifted: that lowest touch was the surface
      return;
    }
    if (near && h > -0.3 && h < 0.3 && this.tipSpeed < 0.05) {
      this.calibHold += dt;
      if (this.calibHold > 0.35 && (this.calibLow === undefined || h < this.calibLow - 0.002)) this.calibLow = h;
      if (this.calibLow !== undefined && Math.abs(this.calibLow - TIP_CONTACT_Y) <= 0.015) {
        this.finishCalibration(this.calibLow);
        return;
      }
      if (this.calibLow !== undefined && this.calibHold > 0.35 && !this.calibAsked) {
        this.calibAsked = true;
        this.setCaption('STEP 2 OF 3  -  TOUCH', 'Now lift your finger', 'Your table is at a different height than the room scan said. Lift your finger and everything moves onto it.');
      }
    } else if (this.calibLow === undefined) {
      this.calibHold = 0;
    }
  }

  /** The fingertip rested at height `touch` (paper-local) over the calibration target. */
  private finishCalibration(touch: number): void {
    const offset = touch - TIP_CONTACT_Y;
    this.calibLow = undefined;
    this.calibAsked = false;
    this.calibHold = 0;
    if (Math.abs(offset) > 0.015) {
      // Move the whole set (paper or keyboard, panels) onto the real surface.
      this.desk.root.position.y += offset;
      this.desk.root.updateWorldMatrix(true, true);
      this.piano.fitToFloor(this.desk.root.matrixWorld.elements[13]);
      this.surfaceOffset = 0;
      this.tipFilter.reset();
      this.log(`desk height corrected by ${(offset * 100).toFixed(1)} cm`);
    } else {
      this.surfaceOffset = offset;
    }
    this.progress.calibratedOffset = this.surfaceOffset;
    this.calibrated = true;
    this.desk.sealRing.scale.setScalar(1);
    (this.desk.sealRing.material as { opacity: number }).opacity = 0.25;
    if (this.craft === 'piano') this.piano.beacon('C4', 0);
    this.sfx.stamp();
    this.log(`calibrated offset ${this.surfaceOffset.toFixed(4)}`);
    this.needLift = Math.abs(offset) <= 0.015; // still resting on the target (a far touch was confirmed by a lift)
    this.beginPractice();
  }

  /**
   * Real pen: rest the tip on the seal, keep still, then lift. While the
   * hand is still above the seal we keep the lowest pose seen (that is when
   * the tip touches); the lift confirms it. A hand that only hovers and then
   * lowers is replaced by the lower pose, so hovering can't calibrate.
   * Here this.tip is the knuckle (no offset yet).
   */
  private calibratePen(dt: number): void {
    const ring = this.desk.sealRing;
    const near = Math.hypot(this.tip.x - this.calX, this.tip.z - this.calZ) < 0.12;
    const up = this.tip.y;
    const cand = this.penCandidate;
    if (cand && up > cand.height + 0.03) {
      // Lifted: the lowest still pose was the tip on the seal.
      this.v.set(this.calX, 0, this.calZ);
      this.desk.paper.localToWorld(this.v);
      const offset = this.v.clone().applyMatrix4(this.m.copy(cand.m).invert());
      this.penCandidate = undefined;
      this.calibHold = 0;
      if (offset.length() < 0.03 || offset.length() > 0.2) return; // not a pen held in the hand
      this.penOffset = offset;
      this.penHand = cand.hand;
      this.surfaceOffset = 0;
      this.calibrated = true;
      this.tipFilter.reset();
      ring.scale.setScalar(1);
      (ring.material as { opacity: number }).opacity = 0.25;
      this.sfx.stamp();
      this.log(`pen calibrated ${(offset.length() * 100).toFixed(1)} cm from the knuckle, ${this.penHand} hand`);
      this.needLift = false; // already lifted
      this.beginPractice();
      return;
    }
    if (near && up > 0.015 && up < 0.2 && this.tipSpeed < 0.04) {
      this.calibHold += dt;
      ring.scale.setScalar(1 + 0.7 * clamp01(this.calibHold / 0.6));
      if (this.calibHold >= 0.6 && (!cand || up < cand.height - 0.003)) {
        this.penCandidate = { m: this.penM.clone(), height: up, hand: this.tipSource?.handedness };
        this.setCaption('STEP 2 OF 3  -  YOUR PEN', 'Now lift your pen', 'Got it. Lift the pen off the seal and the paper is yours.');
      }
    } else if (!cand) {
      this.calibHold = 0;
      ring.scale.setScalar(1);
    }
  }

  /** Fingertip (default) or a real pen or brush held in the hand (beta). */
  private toggleWriteWith(): void {
    this.writeWith = this.writeWith === 'finger' ? 'pen' : 'finger';
    this.progress.writeWith = this.writeWith;
    saveProgress(this.progress);
    this.penOffset = undefined;
    this.penHand = undefined;
    this.penCandidate = undefined;
    this.tipFilter.reset();
    this.refreshMenu();
    this.log(`write with ${this.writeWith}`);
    if (this.craft === 'calligraphy' && (this.mode === 'practice' || this.mode === 'calibrate' || this.mode === 'complete')) {
      this.calibrated = false;
      this.startLesson(this.lessonIndex, false);
    } else {
      this.calibrated = false;
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
      // Only a seen lift clears it: a hand that vanishes and reappears on the
      // paper (tracking loss) has not lifted.
      if (this.needLift && this.tipValid && (h > UP_H || !this.tipOnPaper())) this.needLift = false;
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
        // Ink: width follows a pressure proxy (slow = wet and wide), or the
        // nib angle for italic.
        const target = this.broadNib ? this.nibWidth(this.dirX, this.dirZ) : 0.0118 - 0.0068 * clamp01(this.tipSpeed / 0.28);
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
            this.nudgeAssist(-0.5 * dt);
          } else {
            this.syncRun = 0;
            if (d > UNLOCK_DIST) this.nudgeAssist(0.15 * dt);
          }
        }
        if (!this.locked && this.syncRun > 0.3 && this.guideMode !== 'off') this.setLocked(true);
        else if (this.locked && d > UNLOCK_DIST) this.setLocked(false);
      }

      // A fingertip that plunges well below the surface right after "touching"
      // is a hand passing through the paper, not a brush stroke.
      if (this.clock - this.capStart < 0.25 && h < -0.05) this.fellThrough = true;
      // Tracking can drop for a frame or two mid-stroke: hold the pen through a
      // short gap; a longer one calls the stroke off rather than scoring a stub.
      this.strokeLostFor = this.tipValid ? 0 : this.strokeLostFor + dt;
      if (!this.tipValid) {
        if (this.strokeLostFor > STROKE_LOST_GRACE) this.cancelStroke();
        return;
      }
      const lifted = h > UP_H || h < -0.12 || !this.tipOnPaper();
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

  /** The hand left tracking mid-stroke: take the ink back and let the learner write it again. */
  private cancelStroke(): void {
    this.penDown = false;
    this.strokeLostFor = 0;
    this.sfx.setMusicMood('calm');
    this.sfx.setScratch(0);
    this.setLocked(false);
    const ribbon = this.current;
    this.current = undefined;
    if (ribbon) this.fadeOut(ribbon, 0.6);
    this.phase = 'ready';
    this.needLift = false;
    this.log(`stroke ${this.strokeIndex} cancelled: tracking lost`);
    this.setCaption(
      this.lessonEyebrow(),
      'Your hand left the view',
      'That stroke does not count. Keep your hand in front of you and write it again.',
    );
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
      this.nudgeAssist(0.4); // the master comes closer again
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
    const levelUp = this.recordPass(record, score);
    const days = markPracticeDay(this.progress);
    const daily = markDaily(this.progress);
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
    const others = (['japanese', 'chinese', 'english'] as Language[]).filter((l) => l !== this.language).map((l) => LANGUAGES[l].name);
    const body = levelUp
      ? levelUp
      : improved && prevBest > 0
        ? `New best (was ${prevBest}).`
        : this.lesson.glyph === '永'
          ? 'You have written all eight principles of the brush in one character.'
          : this.lessonIndex === 0 && record.attempts === 1
            ? `The seal is yours. Try ${others.join(' or ')} on the menu, or hold a thumbs up for the next lesson.`
            : `The seal is yours. Hold a thumbs up, or press "Next lesson" on your ${this.ghost.handedness === 'left' ? 'right' : 'left'}.`;
    this.setCaption(
      this.lessonEyebrow(),
      `${cap(this.lesson.meaning)} complete  ${stars}`,
      body,
      `Score ${score}  -  ${this.dailyLine(days, daily)}`,
    );
    this.menu?.getElementById('btn-next')?.setProperties({ display: isLast ? 'none' : 'flex' });
    this.showCaptionActions(true);
    this.refreshMenu();
  }

  /** Save a finished attempt. Returns a line about the next help level when a pass lowers it. */
  private recordPass(record: ReturnType<typeof lessonProgress>, score: number): string {
    record.attempts++;
    record.best = Math.max(record.best, score);
    record.last = today();
    if (score < PASS_SCORE) return '';
    record.passed = true;
    const before = Math.min(2, record.passes ?? 0);
    record.passes = (record.passes ?? 0) + 1;
    const after = Math.min(2, record.passes);
    if (after === before || this.guideMode !== 'adaptive') return '';
    return after === 1
      ? 'Passed. Next time the master shows less: only the outline.'
      : 'Passed again. Next time, from memory: the master only watches.';
  }

  private dailyLine(days: number, daily: number): string {
    const streak = days > 1 ? `${days}-day streak` : 'practised today';
    if (daily === DAILY_GOAL) return `${streak}  -  daily goal met`;
    if (daily < DAILY_GOAL) return `${streak}  -  ${daily} of ${DAILY_GOAL} today`;
    return streak;
  }

  // ---------------------------------------------------------------- crafts

  private lessons(): Lesson[] {
    return LESSON_SETS[this.language];
  }

  /** The surroundings and music for the current craft and language. */
  private applyScene(): void {
    const base = this.craft === 'piano' ? SCENES.music : SCENES[LANGUAGES[this.language].scene];
    const scene = this.immersive && this.ownScene && this.ownPanoUrl ? this.ownSceneDef(base) : base;
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
    return this.craft === 'piano' ? this.songs().length : this.lessons().length;
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
    // Calibration: the seal on the paper; at the piano, middle C itself
    // (a calligraphy seal has no place on a keyboard).
    if (piano) {
      this.piano.keyCentre('C4', this.v);
      this.calX = this.v.x;
      this.calZ = this.v.z;
    } else {
      this.calX = SEAL_X;
      this.calZ = SEAL_Z;
    }
    this.desk.seal.visible = !piano;
    this.desk.seal.position.set(this.calX, this.desk.seal.position.y, this.calZ);
    this.desk.sealRing.position.set(this.calX, piano ? this.piano.keyTop('C4') + 0.0012 : SURFACE_Y + 0.0006, this.calZ);
    this.desk.cursor.visible = false;
    this.startLesson(this.firstUnpassed(), true);
  }

  private pianoEyebrow(): string {
    const part = this.phrases.length > 1 && !this.wholeRun ? `  -  PHRASE ${this.phraseIndex + 1} OF ${this.phrases.length}` : '';
    return `PIANO  -  ${this.lessonIndex + 1} OF ${this.songs().length}  -  ${(this.fullSong ?? this.piano.song).name.toUpperCase()}${part}`;
  }

  /** The course songs, today's echo, the learner's own tunes, and a slot for a new one. */
  private songs(): PianoSong[] {
    if (this.daily.id === 'piano-daily' && this.dailyDay !== today()) {
      this.daily = dailyEcho();
      this.dailyDay = today();
    }
    const list = [...SONGS, this.daily, ...this.tunes];
    if (this.tunes.length < MAX_TUNES) list.push({ id: NEW_TUNE_ID, name: 'New tune', teaching: '', bpm: 60, notes: [] });
    return list;
  }

  private newTuneIndex(): number {
    const list = this.songs();
    const i = list.findIndex((x) => x.id === NEW_TUNE_ID);
    return i < 0 ? list.length - 1 : i;
  }

  /** The master listens while the learner plays their own tune. */
  private startListening(): void {
    if (this.craft !== 'piano' || this.mode === 'demo2d' || this.mode === 'placing') return;
    this.mode = 'piano';
    this.lessonIndex = this.newTuneIndex();
    this.unitPage = this.unitOf(this.lessonIndex);
    this.showCaptionActions(false);
    this.piano.startListen(this.lessonIndex);
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
    // Teach long songs phrase by phrase (master plays, you echo), then whole.
    // "Play it again" and review go straight to the whole song.
    this.fullSong = song;
    this.phrases = phrasesOf(song);
    this.phraseIndex = 0;
    this.wholeRun = !watchFirst || this.phrases.length === 1;
    this.showCaptionActions(false);
    // Clear calligraphy ink so a later switch back starts clean.
    for (const r of this.userRibbons) this.fadeOut(r, 0.3);
    this.userRibbons = [];
    this.ghost.visible = true;
    this.loadPhrase(watchFirst, true);
    this.refreshMenu();
    this.applyPanelVisibility();
    this.log(`lesson ${song.id} (${watchFirst ? 'watch' : 'practice'})`);
  }

  /** Machine-readable keyboard layout and the notes about to be played (tools/e2e.py). */
  private logPianoLayout(): void {
    if (!import.meta.env.DEV) return;
    this.desk.paper.updateWorldMatrix(true, false);
    const w = (x: number, y: number, z: number) => {
      const p = new Vector3(x, y, z).applyMatrix4(this.desk.paper.matrixWorld);
      return [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)];
    };
    const part = this.wholeRun ? 'whole' : `${this.phraseIndex + 1}/${this.phrases.length}`;
    this.log(`piano-layout ${JSON.stringify({ ...(this.piano.layout(w) as object), part, seal: w(this.calX, 0, this.calZ) })}`);
  }

  /** Load the current phrase (or the whole song) and either demonstrate it or start your turn. */
  private loadPhrase(watch: boolean, intro = false): void {
    const song = this.fullSong!;
    const range = this.phrases[Math.min(this.phraseIndex, this.phrases.length - 1)];
    const part = this.wholeRun ? song : { ...song, notes: song.notes.slice(range[0], range[1]) };
    this.piano.loadSong(this.lessonIndex, part);
    this.logPianoLayout();
    this.assist = 1;
    this.ghost.opacity = this.ghostOpacity();
    if (!watch) {
      this.beginPractice();
      return;
    }
    this.mode = 'piano';
    this.piano.startWatch();
    const phrased = this.phrases.length > 1 && !this.wholeRun;
    const body = intro
      ? phrased
        ? `${song.teaching} The master plays it a phrase at a time; echo each one, then play it all.`
        : `${song.teaching} ${song.notes.length} notes. Just watch and listen for now.`
      : 'Listen to the next phrase, then echo it.';
    this.setCaption(this.pianoEyebrow(), phrased ? `Phrase ${this.phraseIndex + 1}: listen` : 'Listen to the master', body);
    this.log(`phrase ${phrased ? `${this.phraseIndex + 1}/${this.phrases.length}` : 'whole'} watch`);
  }

  private promptNote(first = false): void {
    const total = this.piano.song.notes.length;
    const i = this.piano.noteIndex;
    const isNew = !this.progress.lessons[this.piano.song.id];
    const phrased = this.phrases.length > 1;
    const title = first
      ? phrased && !this.wholeRun
        ? `Phrase ${this.phraseIndex + 1}: your turn`
        : phrased
          ? 'Now the whole song'
          : 'Your turn'
      : `Note ${Math.min(i + 1, total)} of ${total}`;
    this.setCaption(
      first && isNew && this.phraseIndex === 0 && !this.wholeRun ? 'YOUR TURN' : this.pianoEyebrow(),
      title,
      first
        ? isNew && this.phraseIndex === 0
          ? 'The master counts four, then tap the glowing key with any fingertip. It pulses on the beat; keep with it and the keys turn gold.'
          : 'Four beats in, then tap each key as it pulses.'
        : 'Tap the glowing key as it pulses. On the beat turns it gold.',
    );
  }

  private onPianoEvent(ev: ReturnType<PianoMode['update']>): void {
    if (ev.type === 'watch-done') {
      this.applyGuideStrength();
      this.beginPractice();
    } else if (ev.type === 'note') {
      this.progress.strokes++;
      this.nudgeAssist(ev.correct ? (ev.inTime ? -0.1 : -0.03) : 0.3);
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
      const { tunes, tune } = addTune(this.tunes, { ...ev.song, name: `Tune ${this.tunes.length + 1}` });
      this.tunes = tunes;
      delete this.progress.lessons[tune.id]; // a new tune starts a new record
      saveProgress(this.progress);
      this.sfx.chime(0);
      this.log(`learned ${ev.song.notes.length} notes bpm ${ev.song.bpm}`);
      this.startSong(this.songs().findIndex((x) => x.id === tune.id), true);
      this.setCaption(
        'PIANO  -  YOUR TUNE',
        'The master learned your tune',
        `${ev.song.notes.length} notes. Listen to the master play it back, then play it together.`,
      );
    } else if (ev.type === 'complete') {
      if (!this.wholeRun) {
        // A phrase echoed: the next phrase, or the whole song once all are learned.
        this.sfx.chime(this.phraseIndex + 1, 0.14);
        this.log(`phrase-done ${this.phraseIndex + 1}/${this.phrases.length} score ${ev.score}`);
        this.phraseIndex++;
        if (this.phraseIndex < this.phrases.length) {
          this.loadPhrase(true);
        } else {
          this.wholeRun = true;
          this.log('phrases done: whole song');
          this.loadPhrase(false);
        }
        return;
      }
      this.completeSong(ev.score, ev.accuracy, ev.rhythm);
    }
  }

  private completeSong(score: number, accuracy: number, rhythm: number): void {
    this.log(`lesson complete score ${score} accuracy ${accuracy.toFixed(2)} rhythm ${rhythm.toFixed(2)}`);
    const song = this.piano.song;
    const record = lessonProgress(this.progress, song.id);
    const prevBest = record.best;
    const levelUp = this.recordPass(record, score);
    const days = markPracticeDay(this.progress);
    const daily = markDaily(this.progress);
    saveProgress(this.progress);
    this.sfx.fanfare();
    for (const k of this.piano.keys) this.sparks.burst((k.x0 + k.x1) / 2, k.top - SURFACE_Y, (k.z0 + k.z1) / 2, 2, 0.14);
    const isLast = this.lessonIndex === this.lessonCount() - 1;
    const stars = '*'.repeat(this.stars(score)) || '-';
    this.setCaption(
      this.pianoEyebrow(),
      `${song.name} complete  ${stars}`,
      levelUp ||
        (score > prevBest && prevBest > 0
          ? `New best (was ${prevBest}). ${Math.round(rhythm * 100)}% on the beat.`
          : `${Math.round(accuracy * 100)}% of keys right, ${Math.round(rhythm * 100)}% on the beat.`),
      `Score ${score}  -  ${this.dailyLine(days, daily)}`,
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
        for (let f = 0; f < 5; f++) {
          const j = 4 + f * 5;
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
        }
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

  // ---------------------------------------------------------------- hand input: loss, gestures

  /**
   * Tracking loss, handled gently. WebXR has no confidence value: when Quest
   * loses a hand (out of the cameras' view, occluded, poor light) its joints
   * stop resolving or the input source goes away. A timed moment (piano
   * playing) pauses at once and a body-locked card asks for the hands back;
   * waiting moments are patient, since resting your hands is allowed.
   * Returns true while the piano should hold still.
   */
  /** True when a Touch controller (not a tracked hand) is an active input. */
  private controllersInUse(): boolean {
    const session = this.renderer.xr.getSession();
    if (!session) return false;
    for (const source of session.inputSources) if (!source.hand && source.gamepad) return true;
    return false;
  }

  private updateTracking(dt: number): boolean {
    // A hand that reappears already on the paper must lift before it inks,
    // so tracking coming back never starts a stroke in the middle of the page.
    if (this.tipValid && this.handsLostFor > 0.1 && this.mode === 'practice' && !this.penDown) this.needLift = true;
    this.handsLostFor = this.tipValid ? 0 : this.handsLostFor + dt;
    const pianoPlay = this.mode === 'piano' && this.piano.phase === 'play';
    const waiting = this.mode === 'calibrate' || this.mode === 'practice' || pianoPlay;
    const show = waiting && this.handsLostFor > (pianoPlay ? HINT_AFTER_TIMED : HINT_AFTER_IDLE);
    if (show !== this.handsHint) {
      this.handsHint = show;
      this.log(show ? `hands lost: hint shown (${this.mode})` : 'hands back');
      if (show) {
        // The reading card over the work carries it (where the learner looks
        // while working); the body-locked card also says it if they look away.
        // Holding Touch controllers is the commonest cause for a first-time
        // visitor (a judge picks them up out of habit): say so plainly.
        const controllers = this.controllersInUse();
        const where = this.craft === 'piano' ? 'over the keys' : 'over the paper';
        const eyebrow = controllers ? 'HANDS ONLY' : pianoPlay ? 'PAUSED' : 'HANDS OUT OF VIEW';
        const title = controllers ? 'Put your controllers down' : 'Bring your hands back';
        const body = controllers
          ? `This is played with your bare hands. Set the controllers aside and hold your hands ${where}. If no hands appear, turn on hand tracking: Settings, Movement tracking, Hand and body tracking.`
          : `Hold them ${where}, in front of you, in good light. ${pianoPlay ? 'The song waits for you.' : 'The master waits for you.'}`;
        if (controllers) this.log('controllers in use: hint shown');
        this.setStatus(eyebrow, title, body);
        this.text(this.caption, 'cap-eyebrow', eyebrow);
        this.text(this.caption, 'cap-title', title);
        this.text(this.caption, 'cap-body', body);
        this.text(this.caption, 'cap-score', ' ');
      } else {
        const rec = this.captionRecord;
        this.setCaption(rec[0], rec[1], rec[2], rec[3]);
      }
    }
    if (this.status && this.mode !== 'placing') {
      // Looking at the work (within about 35 degrees): the caption is enough,
      // and a card at arm's length along the gaze would sink into the desk.
      let away = true;
      if (show) {
        this.desk.paper.getWorldPosition(this.v);
        this.v.sub(this.head).normalize();
        away = this.v.dot(this.earF) < 0.82;
        // Nor when the caption that already says it is in view (they would overlap).
        if (away && this.caption?.visible) {
          this.caption.getWorldPosition(this.v);
          this.v.sub(this.head).normalize();
          if (this.v.dot(this.earF) > 0.85) away = false;
        }
      }
      this.status.visible = show && away;
    }
    return pianoPlay && this.handsLostFor > HINT_AFTER_TIMED;
  }

  /**
   * Thumbs up = "Next lesson", only while that button is offered. It must be
   * held for 0.6 s with high confidence, a ring beside the thumb fills as it is
   * held, and a pose already shown when the button appears has to be let go
   * first, so a celebratory thumbs up never skips ahead by accident.
   */
  private updateThumbsUp(dt: number): void {
    const next = this.nextButton;
    const live = !!next && this.captionActionsShown && !this.penDown && this.buttonActive(next);
    if (!live) {
      this.thumbsGate.reset(true);
      this.cues.setHold(0, this.thumbsAt, this.head);
      return;
    }
    const frame = this.xrFrame as
      | (XRFrame & { fillPoses?: (spaces: XRSpace[], base: XRSpace, out: Float32Array) => boolean })
      | undefined;
    const ref = this.renderer.xr.getReferenceSpace();
    const session = this.renderer.xr.getSession();
    if (!frame?.fillPoses || !ref || !session) return;
    let best = 0;
    let h = 0;
    for (const source of session.inputSources) {
      if (!source.hand || h > 1) continue;
      let spaces = this.jointSpaces.get(source);
      if (!spaces) {
        spaces = Array.from(source.hand.values());
        this.jointSpaces.set(source, spaces);
      }
      const buf = this.handJoints[h++];
      if (!frame.fillPoses(spaces, ref, buf)) continue;
      const c = thumbsUpConfidence(buf);
      if (c > best) {
        best = c;
        this.thumbsAt.set(buf[4 * 16 + 12], buf[4 * 16 + 13] + 0.045, buf[4 * 16 + 14]);
      }
    }
    if (!this.playerIsIdentity) this.thumbsAt.applyMatrix4(this.player.matrixWorld);
    if (best > 0.3 && this.clock - this.thumbsLogged > 0.5) {
      this.thumbsLogged = this.clock;
      this.log(`thumbs-up confidence ${best.toFixed(2)} hold ${this.thumbsGate.progress.toFixed(2)}`);
    }
    const fired = this.thumbsGate.update(best, dt);
    this.cues.setHold(this.thumbsGate.progress, this.thumbsAt, this.head);
    if (fired && next) {
      this.log('gesture thumbs-up: next');
      this.sfx.chime(3, 0.12);
      this.flashPress(next);
      this.trigger(next.id, next.fn);
    }
  }

  /**
   * Microgestures (thumb tap and swipes on the side of the index finger), as
   * IWSDK maps them on the hand's xr-standard gamepad: 5 swipe left, 6 swipe
   * right, 9 tap. Meta documents them for Unity and native OpenXR, not for
   * Quest Browser, so these are optional shortcuts: tap = "Next lesson" when it
   * is offered, swipes page the units. Absent buttons simply never press.
   */
  private updateMicrogestures(): void {
    const session = this.renderer.xr.getSession();
    if (!session) return;
    let h = 0;
    for (const source of session.inputSources) {
      if (!source.hand || h > 1) continue;
      const slot = h++;
      const buttons = source.gamepad?.buttons;
      let bits = 0;
      if (buttons) {
        if (buttons[MG_SWIPE_LEFT]?.pressed) bits |= 1;
        if (buttons[MG_SWIPE_RIGHT]?.pressed) bits |= 2;
        if (buttons[MG_TAP]?.pressed) bits |= 4;
      }
      const rise = bits & ~this.mgPrev[slot];
      this.mgPrev[slot] = bits;
      if (!rise || this.penDown) continue;
      const id = rise & 4 ? 'btn-next' : rise & 1 ? 'btn-unit-prev' : 'btn-unit-next';
      const b = this.pokeById(id);
      if (!b || !this.buttonActive(b)) continue;
      this.log(`microgesture ${rise & 4 ? 'tap' : rise & 1 ? 'swipe-left' : 'swipe-right'}: ${id}`);
      this.flashPress(b);
      this.trigger(b.id, b.fn);
    }
  }

  // ---------------------------------------------------------------- frame

  update(delta: number): void {
    const dt = Math.min(delta, 0.05);
    this.clock += dt;
    this.ghost.tick(this.clock);
    const saved = this.deskMemory.tick(dt, this.desk.root);
    if (saved) this.log(saved);

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
        this.cues.hideAll();
        if (!this.stepChoreo(dt, true)) {
          this.demoLoopPause += dt;
          if (this.demoLoopPause > 2.2) {
            this.demoLoopPause = 0;
            this.startWatchChoreo(0.9);
          }
        }
        this.poseGhost();
        this.updateTools();
        return;
      }
      case 'placing': {
        this.updateTools();
        this.cues.hideAll();
        const recalled = this.recallDesk(dt);
        if (recalled === 'wait') return;
        if (recalled === 'placed') {
          this.finishPlacing(true, 'remembered spot');
          return;
        }
        this.placingClock += dt;
        if (this.tryPlaceOnPlane()) this.finishPlacing(true, this.placeHow);
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
      this.cues.hideAll();
      return;
    }
    this.fitClock += dt;
    if (this.fitClock > 0.5) {
      this.fitClock = 0;
      this.fitPanelsAboveDesk();
    }
    this.readTip(dt);
    this.updatePoke();
    this.updateCursor();
    const handsPaused = this.updateTracking(dt);
    this.updateThumbsUp(dt);
    this.updateMicrogestures();
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
        const top = this.craft === 'piano' ? this.piano.keyTop('C4') - SURFACE_Y : 0;
        this.ghostTip.set(this.calX + 0.004, top + TIP_CONTACT_Y + (1 - tap) * 0.035, this.calZ);
        this.easeLean(0, 0, dt);
      }
      this.updateCalibrate(dt);
    } else if (this.mode === 'piano') {
      this.ghost.visible = this.guideMode !== 'off' || this.piano.phase === 'watch';
      if (this.piano.phase === 'play') this.ghost.opacity += (this.ghostOpacity() - this.ghost.opacity) * Math.min(1, dt * 4);
      else if (this.piano.phase === 'watch') this.ghost.opacity = 0.8;
      this.readAllTips();
      // Hands lost while playing: the song holds still (its clock only runs on dt).
      const ev = handsPaused ? NO_PIANO_EVENT : this.piano.update(dt, this.tips, this.surfaceOffset);
      this.ghostTip.copy(this.piano.ghostTip);
      this.easeLean(0, 0, dt);
      this.ghost.gold = Math.max(this.lockBlend, this.piano.gold);
      this.onPianoEvent(ev);
    } else if (this.mode === 'practice') {
      this.ghost.visible = this.guideMode !== 'off' || this.lockBlend > 0.01;
      this.ghost.opacity += (this.ghostOpacity() - this.ghost.opacity) * Math.min(1, dt * 4);
      this.updatePractice(dt);
    } else if (this.mode === 'complete') {
      this.stepChoreo(dt, false);
      this.ghost.opacity = Math.max(0, this.ghost.opacity - dt * 0.3);
    }
    if (this.ghost.visible) this.poseGhost();
    this.updateTools();
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
