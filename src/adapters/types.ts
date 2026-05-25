import type { Emitter } from '../emit.js';

/**
 * The per-tool adapter contract. One module per upstream tool.
 * Each adapter declares its schema coordinates, knows how to run the
 * upstream binary, and translates its output into AOI events.
 */
export interface Adapter {
  readonly name: string;
  readonly description: string;
  readonly schemaName: string;
  readonly schemaVersion: string;
  run(args: ReadonlyArray<string>, emitter: Emitter): Promise<number>;
}
