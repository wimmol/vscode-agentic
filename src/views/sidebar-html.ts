import * as vscode from "vscode";
import type { AgentEntry, AgentStatus } from "../models/agent.js";
import type { RepoConfig } from "../models/repo.js";
import { getNonce } from "../utils/nonce.js";
import * as path from "node:path";

/**
 * Escape HTML special characters to prevent XSS in webview content.
 */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/**
 * Return codicon HTML for a given agent status.
 */
export function getStatusIcon(status: AgentStatus): string {
	switch (status) {
		case "running":
			return '<span class="codicon codicon-loading spin"></span>';
		case "created":
			return '<span class="codicon codicon-person"></span>';
		case "finished":
			return '<span class="codicon codicon-check"></span>';
		case "error":
			return '<span class="codicon codicon-error"></span>';
	}
}

function renderAgentTile(agent: AgentEntry): string {
	const escapedName = escapeHtml(agent.agentName);
	const escapedRepo = escapeHtml(path.basename(agent.repoPath));
	const escapedPrompt = agent.initialPrompt ? escapeHtml(agent.initialPrompt) : "";

	const isRunning = agent.status === "running";
	const isFinishedOrError = agent.status === "finished" || agent.status === "error";

	const stopDisabled = !isRunning ? " disabled" : "";
	const resetDisabled = !isFinishedOrError ? " disabled" : "";
	const clearDisabled = !isFinishedOrError ? " disabled" : "";

	// Elapsed time display
	let elapsedDisplay = "--";
	if (agent.status === "running") {
		elapsedDisplay = "0s"; // JS timer will update this
	} else if (agent.finishedAt && agent.createdAt) {
		const start = new Date(agent.createdAt).getTime();
		const end = new Date(agent.finishedAt).getTime();
		const seconds = Math.floor((end - start) / 1000);
		if (seconds < 60) {
			elapsedDisplay = `${seconds}s`;
		} else if (seconds < 3600) {
			elapsedDisplay = `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
		} else {
			const h = Math.floor(seconds / 3600);
			const m = Math.floor((seconds % 3600) / 60);
			elapsedDisplay = `${h}h ${m}m`;
		}
	}

	// Exit code for error agents
	const exitCodeHtml =
		agent.status === "error" && agent.exitCode !== undefined
			? `<span class="exit-code">exit: ${agent.exitCode}</span>`
			: "";

	// Prompt line
	const promptHtml = escapedPrompt
		? `<div class="agent-prompt" title="${escapedPrompt}">${escapedPrompt}</div>`
		: "";

	return `<div class="agent-tile" data-repo-path="${escapeHtml(agent.repoPath)}" data-agent-name="${escapedName}" data-status="${agent.status}" data-created-at="${escapeHtml(agent.createdAt)}">
	<div class="tile-header">
		<span class="status-icon">${getStatusIcon(agent.status)}</span>
		<span class="agent-name">${escapedName}</span>
	</div>
	<div class="tile-info">
		<span class="info-item"><span class="codicon codicon-repo"></span> ${escapedRepo}</span>
		<span class="info-item elapsed-time"><span class="codicon codicon-clock"></span> ${elapsedDisplay}</span>
	</div>
	${promptHtml}
	<div class="tile-metrics">
		<span class="metric">+-- -- files</span>
		<span class="metric">ctx: --%</span>
		<span class="metric">RAM: --MB</span>
		${exitCodeHtml}
	</div>
	<div class="tile-actions">
		<button class="action-btn" data-action="stopAgent" title="Stop Agent"${stopDisabled}><span class="codicon codicon-debug-stop"></span></button>
		<button class="action-btn" data-action="resetChanges" title="Reset Changes"${resetDisabled}><span class="codicon codicon-discard"></span></button>
		<button class="action-btn" data-action="deleteAgent" title="Delete Agent"><span class="codicon codicon-trash"></span></button>
		<button class="action-btn" data-action="clearContext" title="Clear Context"${clearDisabled}><span class="codicon codicon-clear-all"></span></button>
	</div>
</div>`;
}

function renderRepoSection(repo: RepoConfig, agents: AgentEntry[]): string {
	const repoName = escapeHtml(path.basename(repo.path));
	const escapedPath = escapeHtml(repo.path);
	const hasActiveAgents = agents.some((a) => a.status === "running");
	const activeDot = hasActiveAgents
		? '<span class="active-dot"></span>'
		: "";

	const tilesHtml = agents.map((a) => renderAgentTile(a)).join("\n");

	return `<div class="repo-section" data-repo-path="${escapedPath}">
	<div class="repo-header">
		<button class="collapse-btn" title="Toggle section"><span class="codicon codicon-chevron-down"></span></button>
		<span class="repo-name">${repoName}</span>
		${activeDot}
		<div class="repo-actions">
			<button class="repo-action-btn" data-action="rootRepo" data-repo-path="${escapedPath}" title="Show Repo Root"><span class="codicon codicon-root-folder"></span></button>
			<button class="repo-action-btn" data-action="createAgent" data-repo-path="${escapedPath}" title="Create Agent"><span class="codicon codicon-add"></span></button>
			<button class="repo-action-btn" data-action="settings" data-repo-path="${escapedPath}" title="Settings"><span class="codicon codicon-gear"></span></button>
			<button class="repo-action-btn" data-action="removeRepo" data-repo-path="${escapedPath}" title="Remove Repository"><span class="codicon codicon-close"></span></button>
		</div>
	</div>
	<div class="repo-agents">
		${tilesHtml}
	</div>
</div>`;
}

function getDashboardStyles(): string {
	return `
		body {
			padding: 0;
			margin: 0;
			background: var(--vscode-sideBar-background);
			color: var(--vscode-foreground);
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
		}

		.dashboard {
			padding: 8px;
		}

		.repo-section {
			margin-bottom: 12px;
			transition: opacity 0.2s ease;
		}

		.repo-section.collapsed .repo-agents {
			display: none;
		}

		.repo-section.collapsed .collapse-btn .codicon-chevron-down {
			transform: rotate(-90deg);
		}

		.repo-header {
			display: flex;
			align-items: center;
			padding: 6px 8px;
			background: var(--vscode-sideBarSectionHeader-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 4px;
			gap: 6px;
		}

		.collapse-btn {
			background: none;
			border: none;
			color: var(--vscode-foreground);
			cursor: pointer;
			padding: 2px;
			display: flex;
			align-items: center;
		}

		.collapse-btn .codicon {
			transition: transform 0.15s ease;
		}

		.repo-name {
			flex: 1;
			font-weight: 600;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.active-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: var(--vscode-testing-runAction);
			flex-shrink: 0;
		}

		.repo-actions {
			display: flex;
			gap: 2px;
		}

		.repo-action-btn {
			background: none;
			border: none;
			color: var(--vscode-foreground);
			cursor: pointer;
			padding: 4px;
			border-radius: 4px;
			display: flex;
			align-items: center;
		}

		.repo-action-btn:hover {
			background: var(--vscode-toolbar-hoverBackground);
		}

		.repo-action-btn.scope-active {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border-radius: 4px;
		}

		.repo-agents {
			padding-top: 4px;
		}

		.agent-tile {
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 6px;
			padding: 12px;
			margin: 8px 0;
			cursor: pointer;
			transition: opacity 0.2s ease, transform 0.2s ease, border-color 0.15s ease;
		}

		.agent-tile:hover {
			border-color: var(--vscode-focusBorder);
		}

		.agent-tile.entering {
			opacity: 0;
			transform: translateY(-8px);
		}

		.agent-tile.exiting {
			opacity: 0;
			transform: translateY(8px);
			pointer-events: none;
		}

		.tile-header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 6px;
		}

		.status-icon {
			display: flex;
			align-items: center;
			transition: opacity 0.15s ease;
		}

		.agent-name {
			font-weight: 600;
			font-size: 1.05em;
		}

		.tile-info {
			display: flex;
			gap: 12px;
			margin-bottom: 4px;
			opacity: 0.8;
			font-size: 0.9em;
		}

		.info-item {
			display: flex;
			align-items: center;
			gap: 4px;
		}

		.agent-prompt {
			margin: 4px 0;
			opacity: 0.7;
			font-size: 0.9em;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.tile-metrics {
			display: flex;
			gap: 10px;
			margin: 6px 0;
			opacity: 0.6;
			font-size: 0.85em;
		}

		.exit-code {
			color: var(--vscode-errorForeground);
			font-weight: 600;
		}

		.tile-actions {
			display: flex;
			gap: 4px;
			margin-top: 8px;
		}

		.action-btn {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: none;
			border-radius: 4px;
			padding: 4px 8px;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.action-btn:hover:not(:disabled) {
			background: var(--vscode-button-secondaryHoverBackground);
		}

		.action-btn:disabled {
			opacity: 0.7;
			cursor: default;
		}

		@keyframes spin {
			from { transform: rotate(0deg); }
			to { transform: rotate(360deg); }
		}

		.spin {
			animation: spin 1s linear infinite;
			display: inline-block;
		}
	`;
}

function getDashboardScript(): string {
	return `
		const vscode = acquireVsCodeApi();

		// --- Status icon helper (mirrors server-side getStatusIcon) ---
		function getStatusIconHtml(status) {
			switch (status) {
				case 'running':
					return '<span class="codicon codicon-loading spin"></span>';
				case 'created':
					return '<span class="codicon codicon-person"></span>';
				case 'finished':
					return '<span class="codicon codicon-check"></span>';
				case 'error':
					return '<span class="codicon codicon-error"></span>';
				default:
					return '<span class="codicon codicon-person"></span>';
			}
		}

		// --- Elapsed time helper ---
		function formatElapsed(agent) {
			if (agent.status === 'running') return '0s';
			if (agent.finishedAt && agent.createdAt) {
				const start = new Date(agent.createdAt).getTime();
				const end = new Date(agent.finishedAt).getTime();
				const seconds = Math.floor((end - start) / 1000);
				if (seconds < 60) return seconds + 's';
				if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + (seconds % 60) + 's';
				const h = Math.floor(seconds / 3600);
				const m = Math.floor((seconds % 3600) / 60);
				return h + 'h ' + m + 'm';
			}
			return '--';
		}

		// --- Escape HTML helper ---
		function escapeHtml(text) {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		}

		// --- Create agent tile HTML (mirrors server-side renderAgentTile) ---
		function createAgentTileHtml(agent) {
			const escapedName = escapeHtml(agent.agentName);
			const repoName = agent.repoPath.split('/').pop() || agent.repoPath;
			const escapedRepo = escapeHtml(repoName);
			const escapedPrompt = agent.initialPrompt ? escapeHtml(agent.initialPrompt) : '';
			const isRunning = agent.status === 'running';
			const isFinishedOrError = agent.status === 'finished' || agent.status === 'error';
			const stopDisabled = !isRunning ? ' disabled' : '';
			const resetDisabled = !isFinishedOrError ? ' disabled' : '';
			const clearDisabled = !isFinishedOrError ? ' disabled' : '';
			const elapsedDisplay = formatElapsed(agent);
			const exitCodeHtml = agent.status === 'error' && agent.exitCode !== undefined
				? '<span class="exit-code">exit: ' + agent.exitCode + '</span>'
				: '';
			const promptHtml = escapedPrompt
				? '<div class="agent-prompt" title="' + escapedPrompt + '">' + escapedPrompt + '</div>'
				: '';

			return '<div class="agent-tile" data-repo-path="' + escapeHtml(agent.repoPath) + '" data-agent-name="' + escapedName + '" data-status="' + agent.status + '" data-created-at="' + escapeHtml(agent.createdAt) + '">'
				+ '<div class="tile-header">'
				+ '<span class="status-icon">' + getStatusIconHtml(agent.status) + '</span>'
				+ '<span class="agent-name">' + escapedName + '</span>'
				+ '</div>'
				+ '<div class="tile-info">'
				+ '<span class="info-item"><span class="codicon codicon-repo"></span> ' + escapedRepo + '</span>'
				+ '<span class="info-item elapsed-time"><span class="codicon codicon-clock"></span> ' + elapsedDisplay + '</span>'
				+ '</div>'
				+ promptHtml
				+ '<div class="tile-metrics">'
				+ '<span class="metric">+-- -- files</span>'
				+ '<span class="metric">ctx: --%</span>'
				+ '<span class="metric">RAM: --MB</span>'
				+ exitCodeHtml
				+ '</div>'
				+ '<div class="tile-actions">'
				+ '<button class="action-btn" data-action="stopAgent" title="Stop Agent"' + stopDisabled + '><span class="codicon codicon-debug-stop"></span></button>'
				+ '<button class="action-btn" data-action="resetChanges" title="Reset Changes"' + resetDisabled + '><span class="codicon codicon-discard"></span></button>'
				+ '<button class="action-btn" data-action="deleteAgent" title="Delete Agent"><span class="codicon codicon-trash"></span></button>'
				+ '<button class="action-btn" data-action="clearContext" title="Clear Context"' + clearDisabled + '><span class="codicon codicon-clear-all"></span></button>'
				+ '</div>'
				+ '</div>';
		}

		// --- Create repo section HTML (mirrors server-side renderRepoSection) ---
		function createRepoSectionHtml(repo) {
			const repoName = escapeHtml(repo.name);
			const escapedPath = escapeHtml(repo.path);
			const hasActiveAgents = repo.agents.some(function(a) { return a.status === 'running'; });
			const activeDot = hasActiveAgents ? '<span class="active-dot"></span>' : '';
			const tilesHtml = repo.agents.map(function(a) { return createAgentTileHtml(a); }).join('');

			return '<div class="repo-section" data-repo-path="' + escapedPath + '">'
				+ '<div class="repo-header">'
				+ '<button class="collapse-btn" title="Toggle section"><span class="codicon codicon-chevron-down"></span></button>'
				+ '<span class="repo-name">' + repoName + '</span>'
				+ activeDot
				+ '<div class="repo-actions">'
				+ '<button class="repo-action-btn" data-action="rootRepo" data-repo-path="' + escapedPath + '" title="Show Repo Root"><span class="codicon codicon-root-folder"></span></button>'
				+ '<button class="repo-action-btn" data-action="createAgent" data-repo-path="' + escapedPath + '" title="Create Agent"><span class="codicon codicon-add"></span></button>'
				+ '<button class="repo-action-btn" data-action="settings" data-repo-path="' + escapedPath + '" title="Settings"><span class="codicon codicon-gear"></span></button>'
				+ '<button class="repo-action-btn" data-action="removeRepo" data-repo-path="' + escapedPath + '" title="Remove Repository"><span class="codicon codicon-close"></span></button>'
				+ '</div>'
				+ '</div>'
				+ '<div class="repo-agents">'
				+ tilesHtml
				+ '</div>'
				+ '</div>';
		}

		// --- Patch an individual agent tile in-place ---
		function patchAgentTile(tileEl, agent) {
			const oldStatus = tileEl.dataset.status;
			const newStatus = agent.status;

			// Update data attributes
			tileEl.dataset.status = newStatus;
			tileEl.dataset.createdAt = agent.createdAt;

			// Update agent name
			const nameEl = tileEl.querySelector('.agent-name');
			if (nameEl) nameEl.textContent = agent.agentName;

			// Update status icon only if status changed (crossfade)
			if (oldStatus !== newStatus) {
				const iconEl = tileEl.querySelector('.status-icon');
				if (iconEl) iconEl.innerHTML = getStatusIconHtml(newStatus);
			}

			// Update elapsed time for non-running agents (running agents use the timer)
			if (newStatus !== 'running') {
				const elapsedEl = tileEl.querySelector('.elapsed-time');
				if (elapsedEl) {
					elapsedEl.innerHTML = '<span class="codicon codicon-clock"></span> ' + formatElapsed(agent);
				}
			}

			// Update prompt
			const promptEl = tileEl.querySelector('.agent-prompt');
			const escapedPrompt = agent.initialPrompt ? escapeHtml(agent.initialPrompt) : '';
			if (escapedPrompt) {
				if (promptEl) {
					promptEl.textContent = agent.initialPrompt;
					promptEl.title = agent.initialPrompt;
				} else {
					// Insert prompt element after tile-info
					const tileInfo = tileEl.querySelector('.tile-info');
					if (tileInfo) {
						const newPrompt = document.createElement('div');
						newPrompt.className = 'agent-prompt';
						newPrompt.title = agent.initialPrompt;
						newPrompt.textContent = agent.initialPrompt;
						tileInfo.insertAdjacentElement('afterend', newPrompt);
					}
				}
			} else if (promptEl) {
				promptEl.remove();
			}

			// Update tile-metrics (exit code)
			const metricsEl = tileEl.querySelector('.tile-metrics');
			if (metricsEl) {
				const exitCodeEl = metricsEl.querySelector('.exit-code');
				if (newStatus === 'error' && agent.exitCode !== undefined) {
					if (exitCodeEl) {
						exitCodeEl.textContent = 'exit: ' + agent.exitCode;
					} else {
						const span = document.createElement('span');
						span.className = 'exit-code';
						span.textContent = 'exit: ' + agent.exitCode;
						metricsEl.appendChild(span);
					}
				} else if (exitCodeEl) {
					exitCodeEl.remove();
				}
			}

			// Update button disabled states
			const isRunning = newStatus === 'running';
			const isFinishedOrError = newStatus === 'finished' || newStatus === 'error';
			const stopBtn = tileEl.querySelector('[data-action="stopAgent"]');
			const resetBtn = tileEl.querySelector('[data-action="resetChanges"]');
			const clearBtn = tileEl.querySelector('[data-action="clearContext"]');
			if (stopBtn) stopBtn.disabled = !isRunning;
			if (resetBtn) resetBtn.disabled = !isFinishedOrError;
			if (clearBtn) clearBtn.disabled = !isFinishedOrError;
		}

		// --- Patch a repo section in-place ---
		function patchRepoSection(sectionEl, repoData) {
			const agentsContainer = sectionEl.querySelector('.repo-agents');
			if (!agentsContainer) return;

			// Update active dot in header
			const header = sectionEl.querySelector('.repo-header');
			if (header) {
				const existingDot = header.querySelector('.active-dot');
				const hasActive = repoData.agents.some(function(a) { return a.status === 'running'; });
				if (hasActive && !existingDot) {
					const repoName = header.querySelector('.repo-name');
					if (repoName) {
						const dot = document.createElement('span');
						dot.className = 'active-dot';
						repoName.insertAdjacentElement('afterend', dot);
					}
				} else if (!hasActive && existingDot) {
					existingDot.remove();
				}
			}

			// Build map of existing tiles by agent name
			const existingTiles = new Map();
			agentsContainer.querySelectorAll('.agent-tile').forEach(function(tile) {
				existingTiles.set(tile.dataset.agentName, tile);
			});

			// Track which agents we've seen
			const seenAgents = new Set();

			repoData.agents.forEach(function(agent) {
				seenAgents.add(agent.agentName);
				const existing = existingTiles.get(agent.agentName);
				if (existing) {
					patchAgentTile(existing, agent);
				} else {
					// New agent -- insert with entering animation
					const temp = document.createElement('div');
					temp.innerHTML = createAgentTileHtml(agent);
					const newTile = temp.firstElementChild;
					if (newTile) {
						newTile.classList.add('entering');
						agentsContainer.appendChild(newTile);
						// Double rAF to trigger transition (per Research Pitfall 6)
						requestAnimationFrame(function() {
							requestAnimationFrame(function() {
								newTile.classList.remove('entering');
							});
						});
					}
				}
			});

			// Remove tiles for deleted agents with exit animation
			existingTiles.forEach(function(tile, name) {
				if (!seenAgents.has(name)) {
					tile.classList.add('exiting');
					tile.addEventListener('transitionend', function() {
						tile.remove();
					}, { once: true });
					// Fallback removal in case transitionend doesn't fire
					setTimeout(function() {
						if (tile.parentNode) tile.remove();
					}, 300);
				}
			});
		}

		// --- Update scope highlight on root buttons ---
		function updateScopeHighlight(scope) {
			// Remove scope-active from all rootRepo buttons
			document.querySelectorAll('.repo-action-btn[data-action="rootRepo"]').forEach(function(btn) {
				btn.classList.remove('scope-active');
			});
			// If scope is repo-specific, highlight the matching button
			if (scope && scope.startsWith('repo:')) {
				const repoPath = scope.substring(5);
				const btn = document.querySelector('.repo-action-btn[data-action="rootRepo"][data-repo-path="' + repoPath + '"]');
				if (btn) btn.classList.add('scope-active');
			}
		}

		// --- Main dashboard patcher ---
		function patchDashboard(data) {
			const dashboard = document.querySelector('.dashboard');
			if (!dashboard) return;

			// Build map of existing repo sections
			const existingSections = new Map();
			dashboard.querySelectorAll('.repo-section').forEach(function(section) {
				existingSections.set(section.dataset.repoPath, section);
			});

			const seenRepos = new Set();

			data.repos.forEach(function(repo) {
				seenRepos.add(repo.path);
				const existing = existingSections.get(repo.path);
				if (existing) {
					patchRepoSection(existing, repo);
				} else {
					// New repo section -- insert with entering animation
					const temp = document.createElement('div');
					temp.innerHTML = createRepoSectionHtml(repo);
					const newSection = temp.firstElementChild;
					if (newSection) {
						newSection.style.opacity = '0';
						dashboard.appendChild(newSection);
						requestAnimationFrame(function() {
							requestAnimationFrame(function() {
								newSection.style.opacity = '';
							});
						});
					}
				}
			});

			// Remove sections for deleted repos with exit animation
			existingSections.forEach(function(section, path) {
				if (!seenRepos.has(path)) {
					section.style.opacity = '0';
					section.addEventListener('transitionend', function() {
						section.remove();
					}, { once: true });
					setTimeout(function() {
						if (section.parentNode) section.remove();
					}, 300);
				}
			});

			updateScopeHighlight(data.scope);
		}

		// --- Message receiver for postMessage-based updates ---
		window.addEventListener('message', function(event) {
			const msg = event.data;
			if (msg.type === 'update') {
				patchDashboard(msg.data);
			}
		});

		const dashboard = document.querySelector('.dashboard');
		if (dashboard) {
			dashboard.addEventListener('click', (e) => {
				const target = e.target;

				// Handle collapse toggle
				const collapseBtn = target.closest('.collapse-btn');
				if (collapseBtn) {
					const section = collapseBtn.closest('.repo-section');
					if (section) {
						section.classList.toggle('collapsed');
					}
					return;
				}

				// Handle repo action buttons
				const repoActionBtn = target.closest('.repo-action-btn');
				if (repoActionBtn) {
					const action = repoActionBtn.dataset.action;
					const repoPath = repoActionBtn.dataset.repoPath;
					if (action === 'createAgent') {
						vscode.postMessage({ command: 'createAgent', repoPath });
					} else if (action === 'removeRepo') {
						vscode.postMessage({ command: 'removeRepo', repoPath });
					} else if (action === 'rootRepo') {
						vscode.postMessage({ command: 'rootRepo', repoPath });
					} else if (action === 'settings') {
						// Settings not wired yet -- placeholder for future phase
					}
					return;
				}

				// Handle tile action buttons (check BEFORE tile click per Pitfall 6)
				const actionBtn = target.closest('.action-btn');
				if (actionBtn) {
					if (actionBtn.disabled) return;
					const tile = actionBtn.closest('.agent-tile');
					if (!tile) return;
					const repoPath = tile.dataset.repoPath;
					const agentName = tile.dataset.agentName;
					const action = actionBtn.dataset.action;

					switch (action) {
						case 'stopAgent':
							vscode.postMessage({ command: 'stopAgent', repoPath, agentName });
							break;
						case 'resetChanges':
							vscode.postMessage({ command: 'resetChanges', repoPath, agentName });
							break;
						case 'deleteAgent':
							vscode.postMessage({ command: 'deleteAgent', repoPath, agentName });
							break;
						case 'clearContext':
							vscode.postMessage({ command: 'clearContext', repoPath, agentName });
							break;
					}
					return;
				}

				// Handle tile click -> focusAgent
				const tile = target.closest('.agent-tile');
				if (tile) {
					const repoPath = tile.dataset.repoPath;
					const agentName = tile.dataset.agentName;
					vscode.postMessage({ command: 'focusAgent', repoPath, agentName });
				}
			});
		}

		// Timer for running agents
		setInterval(() => {
			const tiles = document.querySelectorAll('.agent-tile[data-status="running"]');
			tiles.forEach((tile) => {
				const createdAt = tile.dataset.createdAt;
				if (!createdAt) return;
				const start = new Date(createdAt).getTime();
				const elapsed = Math.floor((Date.now() - start) / 1000);
				const elapsedEl = tile.querySelector('.elapsed-time');
				if (!elapsedEl) return;
				if (elapsed < 60) {
					elapsedEl.innerHTML = '<span class="codicon codicon-clock"></span> ' + elapsed + 's';
				} else if (elapsed < 3600) {
					const m = Math.floor(elapsed / 60);
					const s = elapsed % 60;
					elapsedEl.innerHTML = '<span class="codicon codicon-clock"></span> ' + m + 'm ' + s + 's';
				} else {
					const h = Math.floor(elapsed / 3600);
					const m = Math.floor((elapsed % 3600) / 60);
					elapsedEl.innerHTML = '<span class="codicon codicon-clock"></span> ' + h + 'h ' + m + 'm';
				}
			});
		}, 1000);
	`;
}

/**
 * Generate complete HTML for the sidebar webview dashboard.
 */
export function getHtmlForWebview(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
	repos: RepoConfig[],
	agentsByRepo: Map<string, AgentEntry[]>,
): string {
	const nonce = getNonce();

	const codiconsUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode/codicons", "dist", "codicon.css"),
	);

	const sectionsHtml = repos
		.map((repo) => {
			const agents = agentsByRepo.get(repo.path) || [];
			return renderRepoSection(repo, agents);
		})
		.join("\n");

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
	<link href="${codiconsUri}" rel="stylesheet" />
	<style>${getDashboardStyles()}</style>
</head>
<body>
	<div class="dashboard">
		${sectionsHtml}
	</div>
	<script nonce="${nonce}">${getDashboardScript()}</script>
</body>
</html>`;
}
