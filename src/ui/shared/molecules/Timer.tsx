import { useState, useEffect } from 'react';
import { formatTime } from '../utils/formatTime';
import { TIMER_INTERVAL_MS, MS_PER_SECOND } from '../../../constants/timing';

interface TimerProps {
  startedAt: number;
}

export const Timer = ({ startedAt }: TimerProps) => {
  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.floor((Date.now() - startedAt) / MS_PER_SECOND)));

  useEffect(() => {
    const interval = setInterval(() => {
      const next = Math.max(0, Math.floor((Date.now() - startedAt) / MS_PER_SECOND));
      setElapsed((prev) => (prev === next ? prev : next));
    }, TIMER_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [startedAt]);

  return <span className="timer">{formatTime(elapsed)}</span>;
};
