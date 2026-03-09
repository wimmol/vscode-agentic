import * as vscode from "vscode";
import { type AgentEntry, AGENT_REGISTRY_KEY } from "../models/agent";

export class AgentsStore {
	private readonly emitter = new vscode.EventEmitter<void>();
	readonly onDidChange = this.emitter.event;

	constructor(private readonly state: vscode.Memento) {
		console.log("[AgentsStore] created");
	}

	getAll(): AgentEntry[] {
		console.log("[AgentsStore.getAll]");
		return this.state.get<AgentEntry[]>(AGENT_REGISTRY_KEY, []);
	}

	getForRepo(repoPath: string): AgentEntry[] {
		console.log("[AgentsStore.getForRepo]", { repoPath });
		return this.getAll().filter((e) => e.repoPath === repoPath);
	}

	async save(entries: AgentEntry[]): Promise<void> {
		console.log("[AgentsStore.save]", { count: entries.length });
		await this.state.update(AGENT_REGISTRY_KEY, entries);
		this.emitter.fire();
	}

	dispose(): void {
		console.log("[AgentsStore.dispose]");
		this.emitter.dispose();
	}
}
