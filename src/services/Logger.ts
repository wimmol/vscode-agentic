import * as vscode from 'vscode';

/** Lazily-created shared log channel for the Agentic extension. */
let channel: vscode.LogOutputChannel | undefined;

const getChannel = (): vscode.LogOutputChannel => {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Agentic', { log: true });
  }
  return channel;
};

export const logger = {
  trace: (msg: string, ...args: unknown[]) => getChannel().trace(msg, ...args),
  info: (msg: string, ...args: unknown[]) => getChannel().info(msg, ...args),
  warn: (msg: string, ...args: unknown[]) => getChannel().warn(msg, ...args),
  error: (msg: string, err?: unknown, ...args: unknown[]) => {
    const detail = err instanceof Error ? err.stack ?? err.message : err;
    getChannel().error(msg, detail, ...args);
  },
  dispose: () => {
    channel?.dispose();
    channel = undefined;
  },
};
