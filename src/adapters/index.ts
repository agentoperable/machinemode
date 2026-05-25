import type { Adapter } from './types.js';
import { lsAdapter } from './ls.js';

/**
 * Adapter registry. Add new adapters here as they ship. The CLI dispatches
 * `machinemode <tool> ...` by looking up `tool` in this map.
 */
export const adapters: ReadonlyMap<string, Adapter> = new Map([
  [lsAdapter.name, lsAdapter],
]);

export type { Adapter } from './types.js';
