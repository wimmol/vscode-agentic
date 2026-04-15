import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { AgentPanelPage } from './agentPanel/AgentPanelPage';

interface ErrorBoundaryState {
  error: string | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Agentic] React error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '12px', color: 'var(--vscode-errorForeground)', fontSize: '12px' }}>
          <p><strong>Agentic encountered an error:</strong></p>
          <p style={{ opacity: 0.7, marginTop: '4px' }}>{this.state.error}</p>
          <p style={{ opacity: 0.5, marginTop: '8px' }}>Check the Developer Tools console for details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export const App = () => {
  return (
    <ErrorBoundary>
      <AgentPanelPage />
    </ErrorBoundary>
  );
};
