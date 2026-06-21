import { format } from "date-fns";
import { AppendToResponse } from "./tmdb/queries";

export function normalizeRating(rating?: number) {
  if (rating === undefined || rating === null) return "0.00";
  return rating.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export function appendToResponse(...append: AppendToResponse[]) {
  return append.join(",");
}

export function formatDate(date?: string | Date) {
  if (!date) return "";
  try {
    return format(new Date(date), "MMMM dd, yyyy");
  } catch {
    return typeof date === "string" ? date : "";
  }
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
