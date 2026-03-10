export type AgentStatus = 'created' | 'running' | 'completed' | 'error';

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  lastPrompt: string;
  startedAt?: number;
}

export interface Repo {
  id: string;
  name: string;
  expanded: boolean;
  agents: Agent[];
}
