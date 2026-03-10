import { useElapsedTime } from "../hooks/useElapsedTime";

interface ElapsedTimerProps {
	startedAt?: string;
	finishedAt?: string;
	isRunning: boolean;
}

export const ElapsedTimer = ({ startedAt, finishedAt, isRunning }: ElapsedTimerProps) => {
	const elapsed = useElapsedTime(startedAt, finishedAt, isRunning);
	return <span className="elapsed-time">{elapsed}</span>;
};
