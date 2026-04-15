import {
  AGENT_STATUS_CREATED,
  AGENT_STATUS_RUNNING,
  AGENT_STATUS_IDLE,
  AGENT_STATUS_ERROR,
  AGENT_CLI_CLAUDE_CODE,
} from '../constants/agent';

export type AgentStatus =
  | typeof AGENT_STATUS_CREATED
  | typeof AGENT_STATUS_RUNNING
  | typeof AGENT_STATUS_IDLE
  | typeof AGENT_STATUS_ERROR;

export type AgentCli = typeof AGENT_CLI_CLAUDE_CODE;

export interface ContextUsage {
  used: number;
  total: number;
}
