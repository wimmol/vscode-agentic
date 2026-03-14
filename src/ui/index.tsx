import { createRoot } from 'react-dom/client';
import { App } from './App';
import './shared/styles/index.css';
import type { WebviewToExtensionMessage } from '../types/messages';
import type { RepoWithZones } from '../types';

interface WebviewState {
  repos?: RepoWithZones[];
}

interface VsCodeApi {
  postMessage: (msg: WebviewToExtensionMessage) => void;
  getState: () => WebviewState | undefined;
  setState: (state: WebviewState) => void;
}

declare const acquireVsCodeApi: () => VsCodeApi;

export const vscode = acquireVsCodeApi();

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
