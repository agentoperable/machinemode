/**
 * AOI event emitter. Shared with aoi-lint and aoi-coreutils; will eventually
 * move to aoi-cli-sdk-ts as a published package.
 */

export type AoiEvent = {
  readonly type: string;
  readonly [key: string]: unknown;
};

export class Emitter {
  #out: NodeJS.WriteStream;
  #counts = { events: 0, warnings: 0, errors: 0 };
  #startedAt: number;

  constructor(out: NodeJS.WriteStream = process.stdout) {
    this.#out = out;
    this.#startedAt = Date.now();
    out.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EPIPE') process.exit(141);
      throw err;
    });
  }

  emit(event: AoiEvent): void {
    if (event.type === 'aoi:warning') this.#counts.warnings += 1;
    if (event.type === 'aoi:error') this.#counts.errors += 1;
    this.#counts.events += 1;
    this.#out.write(JSON.stringify(event) + '\n');
  }

  meta(opts: {
    tool: string;
    toolVersion: string;
    schemaName: string;
    schemaVersion: string;
    command: string;
    extra?: Record<string, unknown>;
  }): void {
    this.emit({
      type: 'aoi:meta',
      tool: opts.tool,
      tool_version: opts.toolVersion,
      aoi_version: '0.2',
      schema_name: opts.schemaName,
      schema_version: opts.schemaVersion,
      command: opts.command,
      ...(opts.extra ?? {}),
    });
  }

  summary(opts: {
    ok: boolean;
    truncated?: boolean;
    extra?: Record<string, unknown>;
  }): void {
    this.emit({
      type: 'aoi:summary',
      ok: opts.ok,
      count: this.#counts.events + 1,
      warning_count: this.#counts.warnings,
      error_count: this.#counts.errors,
      truncated: opts.truncated ?? false,
      elapsed_ms: Date.now() - this.#startedAt,
      ...(opts.extra ?? {}),
    });
  }

  error(opts: {
    code: string;
    category: string;
    message: string;
    retryable: boolean;
    extra?: Record<string, unknown>;
  }): void {
    this.emit({
      type: 'aoi:error',
      code: opts.code,
      category: opts.category,
      message: opts.message,
      retryable: opts.retryable,
      ...(opts.extra ?? {}),
    });
  }
}
