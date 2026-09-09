import { format } from "date-fns";
import { AppendToResponse } from "./tmdb/queries";

export function normalizeRating(rating?: number) {
  if (rating === undefined || rating === null) return "0.00";
  return rating.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export function appendToResponse(...append: AppendToResponse[]) {
  return append.join(",");
}

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * TMDB sends calendar days with no time and no zone ("2026-09-09"), and the ES
 * spec reads a bare date as UTC midnight. Rendered in local time that instant
 * falls on the previous day for every viewer west of UTC, and it stays in the
 * future for the first offset hours of the day for everyone east of it — so a
 * calendar-only value is anchored to local midnight instead. Anything carrying a
 * time (or already a Date) is left alone. Null when the input isn't a date.
 */
export function parseCalendarDate(date?: string | Date) {
  if (!date) return null;
  const parsed = typeof date === "string" && CALENDAR_DATE.test(date) ? new Date(`${date}T00:00:00`) : new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The one date format the app renders. Every surface goes through here so a day
 * can't read as "September 09, 2026" on the detail page and "Sep 9, 2026" one
 * click later on the watch page. It is the short form because the tightest
 * caller — an episode row in the watch sidebar at 375px — has no room for the
 * long one. Falls back to the raw string when the input isn't a date.
 */
export function formatDate(date?: string | Date) {
  const parsed = parseCalendarDate(date);
  if (!parsed) return typeof date === "string" ? date : "";
  return format(parsed, "MMM d, yyyy");
}

export function getYear(date?: string) {
  if (!date) return "";
  return date.split("-")[0];
}

export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
