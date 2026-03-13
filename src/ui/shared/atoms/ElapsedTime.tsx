import { formatTime } from '../utils/formatTime';
import { MS_PER_SECOND } from '../../../constants/timing';

interface ElapsedTimeProps {
  startedAt: number;
  completedAt: number;
}

export const ElapsedTime = ({ startedAt, completedAt }: ElapsedTimeProps) => {
  const elapsed = Math.max(0, Math.floor((completedAt - startedAt) / MS_PER_SECOND));

  return <span className="timer">{formatTime(elapsed)}</span>;
};
