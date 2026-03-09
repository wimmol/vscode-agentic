import * as vscode from "vscode";
import { type RepoConfig, REPO_CONFIGS_KEY } from "../models/repo";

export class ReposStore {
	private readonly emitter = new vscode.EventEmitter<void>();
	readonly onDidChange = this.emitter.event;

	constructor(private readonly state: vscode.Memento) {
		console.log("[ReposStore] created");
	}

	getAll(): RepoConfig[] {
		console.log("[ReposStore.getAll]");
		return this.state.get<RepoConfig[]>(REPO_CONFIGS_KEY, []);
	}

	getForRepo(repoPath: string): RepoConfig | undefined {
		console.log("[ReposStore.getForRepo]", { repoPath });
		return this.getAll().find((c) => c.path === repoPath);
	}

	async save(configs: RepoConfig[]): Promise<void> {
		console.log("[ReposStore.save]", { count: configs.length });
		await this.state.update(REPO_CONFIGS_KEY, configs);
		this.emitter.fire();
	}

	dispose(): void {
		console.log("[ReposStore.dispose]");
		this.emitter.dispose();
	}
}
