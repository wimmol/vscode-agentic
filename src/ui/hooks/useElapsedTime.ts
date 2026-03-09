import { useState, useEffect } from "react";

function formatElapsed(startMs: number, endMs: number): string {
	const seconds = Math.floor((endMs - startMs) / 1000);
	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return `${h}h ${m}m`;
}

export function useElapsedTime(
	startedAt: string | undefined,
	finishedAt: string | undefined,
	isRunning: boolean,
): string {
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		if (!isRunning) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [isRunning]);

	if (!startedAt) return "--";

	const startMs = new Date(startedAt).getTime();

	if (isRunning) {
		return formatElapsed(startMs, now);
	}

	if (finishedAt) {
		return formatElapsed(startMs, new Date(finishedAt).getTime());
	}

	return "--";
}
