"use client";

export type Macros = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type FoodItem = { name: string } & Macros;

export type FoodEntry = {
  id: string;
  time: number; // epoch ms
  text: string;
  items: FoodItem[];
  totals: Macros;
  explanation?: string;
  pending?: boolean; // true while the model is still estimating
};

export type ActivityEntry = {
  id: string;
  time: number;
  text: string;
  name: string;
  caloriesBurned: number;
  explanation?: string;
  pending?: boolean;
};

export type DayLog = {
  date: string; // YYYY-MM-DD (local)
  entries: FoodEntry[];
  activities: ActivityEntry[];
};

export const DEFAULT_TARGETS: Macros = {
  calories: 2200,
  protein: 160,
  fat: 70,
  carbs: 220,
};

export type WeightUnit = "kg" | "lb";
export type Profile = {
  weight: number | null; // in `weightUnit`
  weightUnit: WeightUnit;
  heightCm: number | null;
  age: number | null;
  sex: "male" | "female" | "";
};

export const DEFAULT_PROFILE: Profile = {
  weight: null,
  weightUnit: "kg",
  heightCm: null,
  age: null,
  sex: "",
};

const TARGETS_KEY = "macro-rings:targets";
const PROFILE_KEY = "macro-rings:profile";
const LOG_PREFIX = "macro-rings:log:";

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

export function loadTargets(): Macros {
  if (typeof window === "undefined") return DEFAULT_TARGETS;
  try {
    const raw = localStorage.getItem(TARGETS_KEY);
    if (!raw) return DEFAULT_TARGETS;
    const p = JSON.parse(raw);
    return {
      calories: num(p.calories, DEFAULT_TARGETS.calories),
      protein: num(p.protein, DEFAULT_TARGETS.protein),
      fat: num(p.fat, DEFAULT_TARGETS.fat),
      carbs: num(p.carbs, DEFAULT_TARGETS.carbs),
    };
  } catch {
    return DEFAULT_TARGETS;
  }
}

export function saveTargets(t: Macros) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TARGETS_KEY, JSON.stringify(t));
}

export function loadProfile(): Profile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const p = JSON.parse(raw);
    return {
      weight: p.weight === null || p.weight === undefined ? null : num(p.weight, 0),
      weightUnit: p.weightUnit === "lb" ? "lb" : "kg",
      heightCm: p.heightCm === null || p.heightCm === undefined ? null : num(p.heightCm, 0),
      age: p.age === null || p.age === undefined ? null : num(p.age, 0),
      sex: p.sex === "male" || p.sex === "female" ? p.sex : "",
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(p: Profile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

// Compact one-line description sent to the model for personalization.
export function profileToPrompt(p: Profile): string | null {
  const bits: string[] = [];
  if (p.weight && p.weight > 0) bits.push(`weight ${p.weight} ${p.weightUnit}`);
  if (p.heightCm && p.heightCm > 0) bits.push(`height ${p.heightCm} cm`);
  if (p.age && p.age > 0) bits.push(`age ${p.age}`);
  if (p.sex) bits.push(p.sex);
  return bits.length ? bits.join(", ") : null;
}

export function loadDay(date = todayKey()): DayLog {
  const empty: DayLog = { date, entries: [], activities: [] };
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(LOG_PREFIX + date);
    if (!raw) return empty;
    const p = JSON.parse(raw) as DayLog;
    return {
      date,
      entries: Array.isArray(p?.entries) ? p.entries : [],
      activities: Array.isArray(p?.activities) ? p.activities : [],
    };
  } catch {
    return empty;
  }
}

export function saveDay(day: DayLog) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOG_PREFIX + day.date, JSON.stringify(day));
}

export function sumEaten(day: DayLog): Macros {
  return day.entries.reduce<Macros>(
    (acc, e) => ({
      calories: acc.calories + e.totals.calories,
      protein: acc.protein + e.totals.protein,
      fat: acc.fat + e.totals.fat,
      carbs: acc.carbs + e.totals.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
}

export function sumBurned(day: DayLog): number {
  return day.activities.reduce((acc, a) => acc + a.caloriesBurned, 0);
}

export function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
