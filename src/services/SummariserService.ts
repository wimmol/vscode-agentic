import { mkdir } from 'fs/promises';
import * as vscode from 'vscode';
import type { StateStorage } from '../db';
import { CONFIG_SECTION } from '../constants/views';
import { logger } from './Logger';

export type SummariserKind = 'prompt' | 'output';

interface SummariserConfig {
  enabled: boolean;
  thresholdChars: number;
  stabilityMs: number;
}

/** Subset of the transformers.js summarisation pipeline API we rely on.
 *  Kept minimal so we don't pull the package's types into the extension's
 *  public surface. */
type RawPipeline = (
  text: string,
  options?: { max_length?: number; min_length?: number },
) => Promise<Array<{ summary_text?: string }>>;

/**
 * Local-LLM summarisation with a guaranteed fallback.
 *
 * Lazy-loads `@xenova/transformers` + distilbart-cnn-6-6 on first use,
 * downloading the ~75 MB model into the extension's global storage (one-time,
 * shown as a single `withProgress` notification). Every call runs inside a
 * try/catch — if the model fails to load, or inference throws, the service
 * falls back to simple truncation. The caller never sees an error.
 *
 * Debounces per (agentId, kind) so the model isn't re-run while text is
 * still streaming; only the last stable value is summarised.
 *
 * Exists as a class because it owns the pipeline lifecycle, debounce timers,
 * and the cacheDir. Instantiated once per extension activation.
 */
export class SummariserService implements vscode.Disposable {
  /** Cached pipeline promise. Null until `getPipeline()` is invoked. */
  private pipelinePromise: Promise<RawPipeline | null> | null = null;
  /** True after the first failure to load the pipeline; short-circuits to
   *  truncation without another retry for the rest of the session. */
  private permanentlyFailed = false;
  /** Per-key debounce timer. Key = `${agentId}::${kind}`. */
  private pending = new Map<string, ReturnType<typeof setTimeout>>();
  /** Serialises all calls into the pipeline. Concurrent inference on a single
   *  pipeline instance is not safe in transformers.js. */
  private chain: Promise<unknown> = Promise.resolve();
  private disposed = false;

  constructor(
    private readonly storage: StateStorage,
    private readonly cacheDir: vscode.Uri,
  ) {}

  /** Drop every pending timer for an agent. Called when an agent is removed
   *  so the debounce doesn't fire an update on a deleted record. */
  cancel = (agentId: string): void => {
    for (const kind of ['prompt', 'output'] as const) {
      const key = `${agentId}::${kind}`;
      const timer = this.pending.get(key);
      if (timer) clearTimeout(timer);
      this.pending.delete(key);
    }
  };

  /**
   * Queue a summarisation. If `text` is below the configured threshold, the
   * current short field is cleared instead — preventing stale summaries from
   * hanging around after the user shortens a prompt.
   */
  schedule = (agentId: string, kind: SummariserKind, text: string | null): void => {
    if (this.disposed) return;
    const cfg = this.readConfig();
    if (!cfg.enabled) {
      // Config disabled — keep any existing short in place; the tile will
      // simply fall back to the raw text. No teardown needed.
      return;
    }

    const key = `${agentId}::${kind}`;
    const existing = this.pending.get(key);
    if (existing) clearTimeout(existing);
    this.pending.delete(key);

    if (!text || text.length < cfg.thresholdChars) {
      void this.writeShort(agentId, kind, null);
      return;
    }

    const timer = setTimeout(() => {
      this.pending.delete(key);
      void this.runSummarise(agentId, kind, text);
    }, cfg.stabilityMs);
    this.pending.set(key, timer);
  };

  private runSummarise = async (
    agentId: string,
    kind: SummariserKind,
    text: string,
  ): Promise<void> => {
    if (this.disposed) return;
    let short: string | null = null;
    try {
      const pipe = await this.getPipeline();
      if (pipe) {
        short = await this.runSerial(async () => {
          const res = await pipe(text, { max_length: 60, min_length: 12 });
          return res?.[0]?.summary_text?.trim() || null;
        });
      }
    } catch (err) {
      logger.warn('SummariserService inference failed, using truncation', {
        agentId,
        kind,
        err: String(err),
      });
    }
    if (!short) short = truncate(text, 160);
    await this.writeShort(agentId, kind, short);
  };

  private getPipeline = (): Promise<RawPipeline | null> => {
    if (this.permanentlyFailed) return Promise.resolve(null);
    if (!this.pipelinePromise) {
      this.pipelinePromise = this.createPipeline().catch((err) => {
        logger.warn('SummariserService pipeline unavailable', String(err));
        this.permanentlyFailed = true;
        return null;
      });
    }
    return this.pipelinePromise;
  };

  private createPipeline = async (): Promise<RawPipeline> => {
    await mkdir(this.cacheDir.fsPath, { recursive: true });

    // Dynamic import keeps the heavy ESM dep out of the CJS extension bundle
    // and defers its cost until the first summarisation call.
    const mod = await import('@xenova/transformers');
    const { pipeline, env } = mod;
    env.cacheDir = this.cacheDir.fsPath;
    env.allowLocalModels = true;
    env.allowRemoteModels = true;

    const modelId = 'Xenova/distilbart-cnn-6-6';
    const sum = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Agentic: preparing summarisation model (one-time, ~75 MB)…',
        cancellable: false,
      },
      async (progress) => {
        let last = 0;
        const onEvent = (event: { status?: string; progress?: number }) => {
          if (event.status === 'progress' && typeof event.progress === 'number') {
            const pct = Math.floor(event.progress);
            if (pct > last) {
              progress.report({ message: `${pct}%` });
              last = pct;
            }
          }
        };
        return pipeline('summarization', modelId, { progress_callback: onEvent });
      },
    );
    return sum as unknown as RawPipeline;
  };

  private runSerial = <T>(fn: () => Promise<T>): Promise<T> => {
    const previous = this.chain;
    const next = (async () => {
      await previous.catch(() => undefined);
      return fn();
    })();
    this.chain = next.catch(() => undefined);
    return next;
  };

  private writeShort = async (
    agentId: string,
    kind: SummariserKind,
    short: string | null,
  ): Promise<void> => {
    try {
      if (kind === 'prompt') {
        await this.storage.updateAgent(agentId, { lastPromptShort: short });
      } else {
        await this.storage.updateAgent(agentId, { outputShort: short });
      }
    } catch {
      // Agent likely removed between schedule and completion; ignore.
    }
  };

  private readConfig = (): SummariserConfig => {
    const cfg = vscode.workspace.getConfiguration(`${CONFIG_SECTION}.summariser`);
    return {
      enabled: cfg.get<boolean>('enabled', true),
      thresholdChars: cfg.get<number>('thresholdChars', 320),
      stabilityMs: cfg.get<number>('stabilityMs', 2000),
    };
  };

  dispose(): void {
    this.disposed = true;
    for (const t of this.pending.values()) clearTimeout(t);
    this.pending.clear();
  }
}

/** Word-boundary-aware truncation with an ellipsis. */
const truncate = (text: string, maxChars: number): string => {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const slice = trimmed.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
};
