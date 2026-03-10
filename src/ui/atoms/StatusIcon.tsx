import type { AgentData } from "../types";

const iconMap: Record<AgentData["status"], string> = {
	running: "codicon codicon-loading spin",
	created: "codicon codicon-person",
	finished: "codicon codicon-check",
	error: "codicon codicon-error",
};

export const StatusIcon = ({ status }: { status: AgentData["status"] }) => {
	return <span className={`status-icon ${iconMap[status]} status-${status}`} />;
};
