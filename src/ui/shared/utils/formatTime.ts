import { SECONDS_PER_MINUTE } from '../../../constants/timing';

const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * 60;

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
