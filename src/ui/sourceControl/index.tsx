import { createRoot } from 'react-dom/client';
import { SourceControlPage } from './SourceControlPage';
import './styles/sourceControl.css';
import '@vscode/codicons/dist/codicon.css';
import type { ScWebviewToExtensionMessage } from '../../types/sourceControl';

interface VsCodeApi {
  postMessage: (msg: ScWebviewToExtensionMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

declare const acquireVsCodeApi: () => VsCodeApi;

export const vscode = acquireVsCodeApi();

const root = createRoot(document.getElementById('root')!);
root.render(<SourceControlPage />);
