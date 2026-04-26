import { SECONDS_PER_MINUTE } from '../../../constants/timing';

const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * 60;

/** Human duration, e.g. "48s", "2m 14s", "1h 3m". Used for completed runs. */
export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const mins = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = seconds % SECONDS_PER_MINUTE;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  if (mins === 0) {
    return `${secs}s`;
  }
  return `${mins}m ${secs}s`;
};

/** Digital `MM:SS` (or `H:MM:SS` past an hour). Used for running timers. */
export const formatMmss = (seconds: number): string => {
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const mins = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = seconds % SECONDS_PER_MINUTE;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
};
