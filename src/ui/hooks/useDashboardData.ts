import { useState, useEffect } from "react";
import type { DashboardData } from "../types";
import { postCommand } from "./useVsCodeApi";

export const useDashboardData = () => {
	const [data, setData] = useState<DashboardData | null>(null);

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const msg = event.data;
			if (msg.type === "update") {
				console.log("[Dashboard] received update", msg.data);
				setData(msg.data);
			}
		};
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, []);

	const onRootGlobal = () => {
		console.log("[Dashboard] rootGlobal");
		postCommand("rootGlobal");
	};

	const onAddRepo = () => {
		console.log("[Dashboard] addRepo");
		postCommand("addRepo");
	};

	return { data, onRootGlobal, onAddRepo };
};
