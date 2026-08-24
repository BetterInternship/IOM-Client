import { clsx, type ClassValue } from "clsx";
import {
  differenceInCalendarDays,
  differenceInMonths,
  isValid,
  startOfDay,
} from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Return a formatted date string from a timestamp/date string without the time.
 */
export const formatDateWithoutTime = (dateString?: string | null) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Return the elapsed time since a date, e.g. "42 minutes ago", "3 hours
 * ago", or "5 days ago". Precision steps down from minutes to hours to days
 * as each threshold is crossed.
 */
export const formatTimeElapsed = (dateString?: string | null) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (!isValid(date)) return "-";

  const diffMinutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60_000),
  );

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

/**
 * Return a formatted date + time string, e.g. for audit logs.
 */
export const formatDateTime = (dateString?: string | null) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

/**
 * Return a human-friendly expiry countdown. Full months are shown until only
 * one month remains, then the countdown switches to calendar days.
 */
export const formatExpiryCountdown = (
  expiryDate: string | Date,
  from = new Date(),
) => {
  const expiry = startOfDay(new Date(expiryDate));
  const today = startOfDay(from);

  if (!isValid(expiry) || !isValid(today)) return "-";

  const daysRemaining = differenceInCalendarDays(expiry, today);
  if (daysRemaining < 0) return "Expired";
  if (daysRemaining === 0) return "Expires today";

  const monthsRemaining = differenceInMonths(expiry, today);
  if (monthsRemaining > 1) return `Expires in ${monthsRemaining} months`;

  return `Expires in ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"}`;
};
