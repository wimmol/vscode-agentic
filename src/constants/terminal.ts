export const terminalName = (agentName: string, branch: string, repoName: string): string =>
  `${agentName} · ${branch} (${repoName})`;
