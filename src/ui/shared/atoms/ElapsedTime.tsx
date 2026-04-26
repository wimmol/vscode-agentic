import { formatTime } from '../utils/formatTime';
import { MS_PER_SECOND } from '../../../constants/timing';

interface ElapsedTimeProps {
  startedAt: number;
  completedAt: number;
}

/** Human duration for a finished run, e.g. "2m 14s". */
export const ElapsedTime = ({ startedAt, completedAt }: ElapsedTimeProps) => {
  const elapsed = Math.max(0, Math.floor((completedAt - startedAt) / MS_PER_SECOND));
  return <span className="tile__time">{formatTime(elapsed)}</span>;
};
