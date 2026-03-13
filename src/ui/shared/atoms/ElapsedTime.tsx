import { formatTime } from '../utils/formatTime';

interface ElapsedTimeProps {
  startedAt: number;
  completedAt: number;
}

export const ElapsedTime = ({ startedAt, completedAt }: ElapsedTimeProps) => {
  const elapsed = Math.max(0, Math.floor((completedAt - startedAt) / 1000));

  return <span className="timer">{formatTime(elapsed)}</span>;
};
