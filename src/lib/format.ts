import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { APP } from "@/lib/constants";

export function formatKickoff(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP.timezone,
  }).format(new Date(iso));
}

export function formatKickoffWithDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP.timezone,
  }).format(new Date(iso));
}

/** YYYY-MM-DD in the app timezone (not the server timezone). */
export function toDateKey(input: Date | string = new Date()): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP.timezone,
  }).format(date);
}

export function formatDateKey(dateKey: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

export function formatShortDate(dateKey: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

export function addDaysKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  try {
    return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
  } catch {
    return "unknown";
  }
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP.timezone,
  }).format(new Date(iso));
}

export function formatIsoDay(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd");
}

export function dayLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "Today";
  if (dateKey === addDaysKey(todayKey, 1)) return "Tomorrow";
  if (dateKey === addDaysKey(todayKey, -1)) return "Yesterday";
  return formatDateKey(dateKey);
}
