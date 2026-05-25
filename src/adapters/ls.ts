import { spawn } from 'node:child_process';

import type { Emitter } from '../emit.js';
import type { Adapter } from './types.js';

/**
 * Wraps the system `ls` binary, parses its long-format output, and emits
 * one `entry` event per filesystem entry. Forces `-l` (long format) on top
 * of whatever the caller passed so parsing has a stable shape.
 *
 * GNU vs BSD ls differ in subtle column behavior (locale-dependent dates,
 * total-line presence, extended attributes). This adapter handles the
 * common cases; corner cases (filenames with spaces beyond the last column,
 * extended attribute markers) are tracked as follow-up work.
 */
export const lsAdapter: Adapter = {
  name: 'ls',
  description:
    'AOI wrapper around the system `ls`. Emits one entry event per filesystem entry.',
  schemaName: 'io.agentoperable.machinemode.ls.events',
  schemaVersion: '1.0.0',

  async run(args, emitter): Promise<number> {
    // Force long format so we always have a stable shape to parse, regardless
    // of what the caller asked for. -l is idempotent with itself.
    const finalArgs = args.includes('-l') || args.some((a) => /^-l\w*$|^-\w*l\w*$/.test(a))
      ? args
      : ['-l', ...args];

    return new Promise<number>((resolve) => {
      const child = spawn('ls', [...finalArgs], { stdio: ['ignore', 'pipe', 'pipe'] });

      let stderrBuf = '';
      let stdoutBuf = '';
      let totalEntries = 0;

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      child.stdout.on('data', (chunk: string) => {
        stdoutBuf += chunk;
        let nl: number;
        while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
          const line = stdoutBuf.slice(0, nl);
          stdoutBuf = stdoutBuf.slice(nl + 1);
          const parsed = parseLine(line);
          if (parsed !== null) {
            emitter.emit({ type: 'entry', ...parsed });
            totalEntries += 1;
          }
        }
      });

      child.stderr.on('data', (chunk: string) => {
        stderrBuf += chunk;
      });

      child.on('close', (code) => {
        // Flush a final partial line if any
        if (stdoutBuf.length > 0) {
          const parsed = parseLine(stdoutBuf);
          if (parsed !== null) {
            emitter.emit({ type: 'entry', ...parsed });
            totalEntries += 1;
          }
        }

        if (code !== 0 || stderrBuf.length > 0) {
          emitter.error({
            code: 'LS_FAILED',
            category: code === 0 ? 'temporary' : code === 1 ? 'not_found' : 'internal',
            message: stderrBuf.trim() || `ls exited with code ${code}`,
            retryable: false,
          });
        }

        emitter.summary({
          ok: code === 0,
          extra: { exit_code: code ?? 0, total_entries: totalEntries },
        });

        resolve(code ?? 0);
      });

      child.on('error', (err) => {
        emitter.error({
          code: 'LS_SPAWN_FAILED',
          category: 'internal',
          message: err.message,
          retryable: false,
        });
        emitter.summary({ ok: false, extra: { exit_code: 70 } });
        resolve(70);
      });
    });
  },
};

type ParsedEntry = {
  perms: string;
  links: number;
  owner: string;
  group: string;
  size: number;
  mtime: string;
  name: string;
  is_dir: boolean;
  is_link: boolean;
  link_target?: string;
};

/**
 * Parse one line of `ls -l` long-format output.
 * Returns null for lines that aren't entries (e.g. the "total N" header).
 */
function parseLine(line: string): ParsedEntry | null {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('total ')) return null;

  // Long-format: PERMS LINKS OWNER GROUP SIZE MONTH DAY TIME-OR-YEAR NAME [-> LINK_TARGET]
  // GNU and BSD largely agree on column layout; the date is locale-dependent.
  const cols = trimmed.split(/\s+/);
  if (cols.length < 9) return null;

  const perms = cols[0]!;
  const links = Number(cols[1]);
  const owner = cols[2]!;
  const group = cols[3]!;
  const size = Number(cols[4]);
  const mtime = `${cols[5]} ${cols[6]} ${cols[7]}`;

  // Filename starts at column 8 and may include spaces.
  const rest = cols.slice(8).join(' ');
  let name = rest;
  let linkTarget: string | undefined;

  // Handle "name -> target" for symlinks
  const arrowIdx = rest.indexOf(' -> ');
  if (perms.startsWith('l') && arrowIdx !== -1) {
    name = rest.slice(0, arrowIdx);
    linkTarget = rest.slice(arrowIdx + 4);
  }

  const isDir = perms.startsWith('d');
  const isLink = perms.startsWith('l');

  return {
    perms,
    links: Number.isFinite(links) ? links : 0,
    owner,
    group,
    size: Number.isFinite(size) ? size : 0,
    mtime,
    name,
    is_dir: isDir,
    is_link: isLink,
    ...(linkTarget !== undefined ? { link_target: linkTarget } : {}),
  };
}
