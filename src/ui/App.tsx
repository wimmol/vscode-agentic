import { AgentPanelPage } from './agentPanel/AgentPanelPage';
import { ErrorBoundary } from './shared/atoms/ErrorBoundary';

export const App = () => {
  return (
    <ErrorBoundary>
      <AgentPanelPage />
    </ErrorBoundary>
  );
};
