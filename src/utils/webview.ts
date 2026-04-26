import { randomBytes } from 'crypto';
import * as vscode from 'vscode';

const getNonce = (): string => randomBytes(16).toString('hex');

const FONTS_STYLE = 'https://fonts.googleapis.com';
const FONTS_DATA = 'https://fonts.gstatic.com';
const FONTS_LINK =
  'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap';

export const buildWebviewHtml = (
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  scriptFile: string,
  cssFile: string,
): string => {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'out', 'ui', scriptFile),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'out', 'ui', cssFile),
  );
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} ${FONTS_STYLE}; font-src ${webview.cspSource} ${FONTS_DATA}; img-src ${webview.cspSource} data:;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="${FONTS_STYLE}" />
  <link rel="preconnect" href="${FONTS_DATA}" crossorigin />
  <link rel="stylesheet" href="${FONTS_LINK}" />
  <link rel="stylesheet" href="${styleUri}" />
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
};
