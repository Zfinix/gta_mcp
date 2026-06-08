// Reset-time utilities. GTA Online daily collectibles reset at 06:00 UTC and the
// weekly event resets Thursday 07:00 UTC. All math is in UTC to avoid local drift.

const DAILY_UTC_HOUR = 6;
const WEEKLY_UTC_DAY = 4; // Thursday (0 = Sunday)
const WEEKLY_UTC_HOUR = 7;

export function nextDailyReset(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(DAILY_UTC_HOUR, 0, 0, 0);
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export function nextWeeklyReset(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(WEEKLY_UTC_HOUR, 0, 0, 0);
  const dayDiff = (WEEKLY_UTC_DAY - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + dayDiff);
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

/** Key identifying the active daily window (date rolls at 06:00 UTC). */
export function currentDailyWindowKey(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - DAILY_UTC_HOUR * 3600_000);
  return shifted.toISOString().slice(0, 10);
}

/** Key identifying the active weekly window (the Thursday that started it). */
export function currentWeeklyWindowKey(now: Date = new Date()): string {
  const reset = nextWeeklyReset(now);
  const start = new Date(reset.getTime() - 7 * 24 * 3600_000);
  return start.toISOString().slice(0, 10);
}

export function msUntil(target: Date, now: Date = new Date()): number {
  return Math.max(0, target.getTime() - now.getTime());
}

export function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(" ");
}
