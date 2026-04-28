import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/templateEditor.css';
import '@vscode/codicons/dist/codicon.css';
import type { TeWebviewToExtensionMessage } from '../../types/templateEditor';

interface VsCodeApi {
  postMessage: (msg: TeWebviewToExtensionMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

declare const acquireVsCodeApi: () => VsCodeApi;

export const vscode = acquireVsCodeApi();

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
