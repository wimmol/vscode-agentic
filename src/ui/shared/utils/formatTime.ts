import { SECONDS_PER_MINUTE } from '../../../constants/timing';

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / SECONDS_PER_MINUTE);
  const secs = seconds % SECONDS_PER_MINUTE;

  if (mins === 0) {
    return `${secs}s`;
  }

  return `${mins}m ${secs}s`;
};
