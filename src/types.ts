export interface CapturedEvent {
  to: string;
  from: string | null;
  headers: Record<string, string>;
  body: unknown;
  timestamp: number;
}

export interface TestHarnessOptions {
  /** Path to resources folder. Defaults to auto-detect from cwd. */
  resourcePath?: string;
}
