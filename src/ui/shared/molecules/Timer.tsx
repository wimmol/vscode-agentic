import { useState, useEffect } from 'react';

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins === 0) {
    return `${secs}s`;
  }

  return `${mins}m ${secs}s`;
};

interface TimerProps {
  startedAt: number;
}

export const Timer = ({ startedAt }: TimerProps) => {
  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));

  useEffect(() => {
    const interval = setInterval(() => {
      const next = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setElapsed((prev) => (prev === next ? prev : next));
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  return <span className="timer">{formatTime(elapsed)}</span>;
};
