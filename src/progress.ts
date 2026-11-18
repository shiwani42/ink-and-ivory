/**
 * Practice progress kept in localStorage (per browser, per device).
 * Every access is wrapped: storage can be blocked or empty (private mode),
 * and the app must still run.
 */

export interface LessonProgress {
  best: number; // best character score 0..100
  attempts: number;
  passed: boolean;
  /** Times passed: 1, 2, 3 and the master's help fades (full guide, outline, from memory). */
  passes?: number;
  /** Day last practised (for review: the weakest and longest-unpractised come back first). */
  last?: string;
}

export interface Progress {
  lessons: Record<string, LessonProgress>;
  streak: { lastDay: string; days: number };
  strokes: number;
  calibratedOffset?: number;
  seenLock?: boolean; // the gold lock-in has been explained once
  /** Write with the index fingertip (default) or a real pen or brush held in the hand (beta). */
  writeWith?: 'finger' | 'pen';
  /** Real pen: where its tip is from the index knuckle (knuckle-local metres) and in which hand, once learned. */
  penOffset?: [number, number, number];
  penHand?: 'left' | 'right' | 'none';
  /** Surroundings: your own room (default), the craft's 360 place, or your own photo. */
  scene?: 'room' | 'place' | 'own';
  /** Lessons completed today, toward the daily goal. */
  daily?: { day: string; count: number };
}

/** Lessons a day that make the daily goal (a few minutes of practice). */
export const DAILY_GOAL = 3;

const KEY = 'hands-of-a-master.v1';

export const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const yesterday = (): string => {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Progress;
      if (parsed && parsed.lessons && parsed.streak) return parsed;
    }
  } catch {
    // fall through to a fresh record
  }
  return { lessons: {}, streak: { lastDay: '', days: 0 }, strokes: 0 };
}

/** Forget everything (the "fresh" shortcut): the next visit is a first-time one. */
export function clearProgress(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: nothing to clear
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage unavailable: progress lasts for this session only
  }
}

/** Count today as a practice day. Returns the current streak length. */
export function markPracticeDay(p: Progress): number {
  const t = today();
  if (p.streak.lastDay === t) return p.streak.days;
  p.streak.days = p.streak.lastDay === yesterday() ? p.streak.days + 1 : 1;
  p.streak.lastDay = t;
  return p.streak.days;
}

export function lessonProgress(p: Progress, id: string): LessonProgress {
  return (p.lessons[id] ??= { best: 0, attempts: 0, passed: false });
}

/** Count one completed lesson toward today's goal. Returns today's count. */
export function markDaily(p: Progress): number {
  const t = today();
  if (p.daily?.day !== t) p.daily = { day: t, count: 0 };
  p.daily.count++;
  return p.daily.count;
}

export function dailyCount(p: Progress): number {
  return p.daily?.day === today() ? p.daily.count : 0;
}

/** Help level for a lesson: 0 = full guide, 1 = outline only, 2 = from memory. */
export function helpLevel(p: Progress, id: string): number {
  return Math.min(2, p.lessons[id]?.passes ?? (p.lessons[id]?.passed ? 1 : 0));
}
