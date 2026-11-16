/**
 * Sound for Hands of a Master.
 *
 * - Music: CC0 tracks from OpenGameArt per place (credited in README.md),
 *   streamed through an <audio> element and alternated so long sessions
 *   never loop audibly.
 *   The music dips while ink is flowing and swells gently on lock-in.
 * - Effects: synthesized in code (no files):
 * Hand tracking has no haptics, so every interaction gets an audible answer:
 * a paper "scratch" while ink flows, a bell for success, a wood block for UI.
 * - Spatial: piano notes and the brush scratch come from where they happen
 *   (HRTF panners), with the listener following the head every frame.
 *
 * The AudioContext is created lazily and resumed on the first user gesture
 * (entering AR is one), which Quest Browser requires.
 */

const PENTATONIC = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2];

export class Sfx {
  private ctx?: AudioContext;
  private master?: GainNode;
  private scratchGain?: GainNode;
  private scratchFilter?: BiquadFilterNode;
  private scratchPanner?: PannerNode;
  private noise?: AudioBuffer;
  private bus?: DynamicsCompressorNode;
  private musicGain?: GainNode;
  private musicEl?: HTMLAudioElement;
  private trackIndex = 0;
  private musicLevel = 0.32;
  muted = false;
  musicOn = true;
  /** Track URLs, set by the app (built from import.meta.env.BASE_URL). */
  tracks: string[] = [];

  /** Call from a user-gesture handler or once an XR session has started. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        // Everything goes through one compressor so layered sounds never clip
        // on the headset's speakers.
        this.bus = this.ctx.createDynamicsCompressor();
        this.bus.threshold.value = -16;
        this.bus.knee.value = 12;
        this.bus.ratio.value = 4;
        this.bus.attack.value = 0.004;
        this.bus.release.value = 0.2;
        this.bus.connect(this.ctx.destination);
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(this.bus);
        this.noise = this.makeNoise(2);
        this.startScratchBed();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      // Audio is optional; captions carry every message.
    }
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private startScratchBed(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise!;
    src.loop = true;
    this.scratchFilter = ctx.createBiquadFilter();
    this.scratchFilter.type = 'bandpass';
    this.scratchFilter.frequency.value = 2200;
    this.scratchFilter.Q.value = 0.8;
    this.scratchGain = ctx.createGain();
    this.scratchGain.gain.value = 0;
    this.scratchPanner = this.makePanner();
    src.connect(this.scratchFilter).connect(this.scratchGain).connect(this.scratchPanner).connect(this.master!);
    src.start();
  }

  /** Start (or resume) the music playlist. Call after unlock(). */
  startMusic(): void {
    if (!this.ctx || !this.bus || this.tracks.length === 0) return;
    try {
      if (!this.musicEl) {
        const el = new Audio();
        el.crossOrigin = 'anonymous';
        el.preload = 'auto';
        el.addEventListener('ended', () => {
          this.trackIndex = (this.trackIndex + 1) % this.tracks.length;
          el.src = this.tracks[this.trackIndex];
          void el.play().catch(() => undefined);
        });
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0;
        this.ctx.createMediaElementSource(el).connect(this.musicGain).connect(this.bus);
        el.src = this.tracks[this.trackIndex];
        this.musicEl = el;
      }
      if (this.musicOn) {
        void this.musicEl.play().catch(() => undefined);
        this.setMusicLevel(this.musicLevel, 2.5);
      }
    } catch {
      // music is optional
    }
  }

  /** Start the playlist again from its first track (after `tracks` changed). */
  restartMusic(): void {
    this.trackIndex = 0;
    if (this.musicEl && this.tracks.length) {
      this.musicEl.src = this.tracks[0];
    }
    this.startMusic();
  }

  stopMusic(fade = 1.2): void {
    if (!this.ctx || !this.musicGain || !this.musicEl) return;
    this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
    const el = this.musicEl;
    setTimeout(() => el.pause(), fade * 1000);
  }

  setMusicOn(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic(0.6);
  }

  /** Mix moments: 'calm' (default), 'writing' (dip under the brush), 'unison' (gentle swell). */
  setMusicMood(mood: 'calm' | 'writing' | 'unison'): void {
    const level = mood === 'writing' ? 0.2 : mood === 'unison' ? 0.4 : 0.32;
    if (level === this.musicLevel) return;
    this.musicLevel = level;
    if (this.musicOn) this.setMusicLevel(level, mood === 'unison' ? 0.8 : 0.5);
  }

  private setMusicLevel(level: number, seconds: number): void {
    if (!this.ctx || !this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(this.muted ? 0 : level, this.ctx.currentTime, seconds / 3);
  }

  // ------------------------------------------------------------ sampled piano
  // Salamander Grand Piano (Alexander Holm, CC-BY 3.0), six samples spread a
  // minor third apart and pitch-shifted to every key in A3 to E5.
  private pianoSamples: { midi: number; buffer: AudioBuffer }[] = [];
  private pianoLoading = false;

  async loadPiano(baseUrl: string): Promise<void> {
    if (!this.ctx || this.pianoLoading || this.pianoSamples.length) return;
    this.pianoLoading = true;
    const files: [string, number][] = [['A3', 57], ['C4', 60], ['Ds4', 63], ['Fs4', 66], ['A4', 69], ['C5', 72], ['Ds5', 75]];
    const ctx = this.ctx;
    const loaded = await Promise.all(
      files.map(async ([name, midi]) => {
        try {
          const res = await fetch(`${baseUrl}audio/piano/${name}.mp3`);
          const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
          return { midi, buffer };
        } catch {
          return undefined;
        }
      }),
    );
    this.pianoSamples = loaded.filter((x): x is { midi: number; buffer: AudioBuffer } => !!x);
    this.pianoLoading = false;
  }

  /** Play a piano note (MIDI number) at velocity 0..1. Falls back to a bell if samples are missing. */
  /** Play a piano note; with a position (world metres) it sounds from that key. */
  piano(midi: number, velocity = 0.8, x?: number, y?: number, z?: number): void {
    if (!this.ready()) return;
    if (!this.pianoSamples.length) {
      this.tone(440 * Math.pow(2, (midi - 69) / 12), this.ctx!.currentTime, 1.2, 0.18 * velocity);
      return;
    }
    let best = this.pianoSamples[0];
    for (const s of this.pianoSamples) if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = best.buffer;
    src.playbackRate.value = Math.pow(2, (midi - best.midi) / 12);
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.55 * velocity, t);
    g.gain.setTargetAtTime(0, t + 1.6, 0.4);
    if (x !== undefined && y !== undefined && z !== undefined) {
      const p = this.makePanner();
      Sfx.place(p, x, y, z);
      src.connect(g).connect(p).connect(this.master!);
    } else {
      src.connect(g).connect(this.master!);
    }
    src.start(t);
    src.stop(t + 3.5);
  }

  /** Continuous brush-on-paper texture. `speed` in m/s, 0 = silent. */
  /** An HRTF panner for a sound source in the room (metres, world space). */
  private makePanner(): PannerNode {
    const p = this.ctx!.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 0.6; // at arm's length the level is unchanged
    p.rolloffFactor = 0.6;
    return p;
  }

  private static place(p: PannerNode, x: number, y: number, z: number): void {
    if (p.positionX) {
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    } else {
      (p as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(x, y, z);
    }
  }

  /** Move the ears with the head (world position, forward and up vectors). Call every frame. */
  setListener(px: number, py: number, pz: number, fx: number, fy: number, fz: number, ux: number, uy: number, uz: number): void {
    const l = this.ctx?.listener;
    if (!l) return;
    if (l.positionX) {
      l.positionX.value = px;
      l.positionY.value = py;
      l.positionZ.value = pz;
      l.forwardX.value = fx;
      l.forwardY.value = fy;
      l.forwardZ.value = fz;
      l.upX.value = ux;
      l.upY.value = uy;
      l.upZ.value = uz;
    } else {
      const legacy = l as unknown as { setPosition(x: number, y: number, z: number): void; setOrientation(...v: number[]): void };
      legacy.setPosition(px, py, pz);
      legacy.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  /** Where the brush is touching the paper (world space). */
  setScratchPosition(x: number, y: number, z: number): void {
    if (this.scratchPanner) Sfx.place(this.scratchPanner, x, y, z);
  }

  setScratch(speed: number): void {
    if (!this.ctx || !this.scratchGain || !this.scratchFilter) return;
    const target = this.muted ? 0 : Math.min(0.09, speed * 0.6);
    const t = this.ctx.currentTime;
    this.scratchGain.gain.setTargetAtTime(target, t, 0.04);
    this.scratchFilter.frequency.setTargetAtTime(1600 + speed * 6000, t, 0.05);
  }

  private tone(
    freq: number,
    start: number,
    decay: number,
    gain: number,
    type: OscillatorType = 'sine',
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    osc.connect(g).connect(this.master!);
    osc.start(start);
    osc.stop(start + decay + 0.05);
  }

  private ready(): boolean {
    return !!this.ctx && !this.muted && this.ctx.state === 'running';
  }

  /** Temple-bell style chime; `step` walks up a pentatonic scale. */
  chime(step = 0, gain = 0.18): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const f = 660 * PENTATONIC[Math.abs(step) % PENTATONIC.length];
    this.tone(f, t, 1.6, gain);
    this.tone(f * 2.76, t, 0.6, gain * 0.25);
    this.tone(f * 5.4, t, 0.25, gain * 0.08);
  }

  /** Three rising chimes: lesson complete. */
  fanfare(): void {
    if (!this.ready()) return;
    [0, 2, 4, 5].forEach((s, i) =>
      setTimeout(() => this.chime(s, 0.16), i * 140),
    );
  }

  /** Wooden block: UI presses and gentle "try again". Slightly different every time, like real wood. */
  tok(pitch = 1): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const p = pitch * (1 + (Math.random() - 0.5) * 0.06); // +-3%
    const g = 0.2 + Math.random() * 0.04;
    this.tone(520 * p, t, 0.09, g, 'triangle');
    this.tone(1250 * p * (1 + (Math.random() - 0.5) * 0.04), t, 0.03, 0.06, 'sine');
  }

  /** Soft low thud: the seal stamp landing on paper. */
  stamp(): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.tone(95 * (1 + (Math.random() - 0.5) * 0.08), t, 0.35, 0.35);
    const src = ctx.createBufferSource();
    src.buffer = this.noise!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 760 + Math.random() * 280; // a different paper "thump" each time
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + 0.15);
  }
}
