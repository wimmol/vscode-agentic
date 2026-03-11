import { createRoot } from 'react-dom/client';
import { App } from './App';
import './shared/styles/index.css';
import type { WebviewToExtensionMessage } from '../types/messages';

declare const acquireVsCodeApi: () => { postMessage: (msg: WebviewToExtensionMessage) => void };

export const vscode = acquireVsCodeApi();

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
