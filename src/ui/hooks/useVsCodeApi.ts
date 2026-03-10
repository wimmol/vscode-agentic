// Cached VS Code API singleton -- acquireVsCodeApi must be called exactly once

declare function acquireVsCodeApi(): {
	postMessage(message: unknown): void;
	getState(): unknown;
	setState(state: unknown): void;
};

const vsCodeApi = acquireVsCodeApi();
console.log("[useVsCodeApi] acquireVsCodeApi called and cached");

export const getVsCodeApi = () => {
	return vsCodeApi;
};

export const postCommand = (command: string, data?: Record<string, string>) => {
	console.log("[postCommand]", command, data);
	vsCodeApi.postMessage({ command, ...data });
};
