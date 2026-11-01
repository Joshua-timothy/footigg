import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function pct(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function pctPoints(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}pp`;
}

export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return fallback;
  }
  return numerator / denominator;
}

export function logit(p: number): number {
  const bounded = clamp(p, 1e-6, 1 - 1e-6);
  return Math.log(bounded / (1 - bounded));
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Deterministic 32-bit string hash — used for stable demo data. */
export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function groupBy<T, K extends string | number>(
  items: T[],
  key: (item: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export function initials(name: string): string {
  return name
    .replace(/\b(FC|CF|SC|AC|AS|SS|CD|CA|RC|RCD|UD|SV|VfB|VfL|TSG|BSC|1\.)\b/gi, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
