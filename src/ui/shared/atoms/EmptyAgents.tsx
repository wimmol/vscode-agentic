interface EmptyAgentsProps {
  text?: string;
}

/** Minimalist one-liner shown when a scope has no agents. */
export const EmptyAgents = ({ text = 'No agents. Pick a template.' }: EmptyAgentsProps) => (
  <div className="empty-agents">{text}</div>
);
