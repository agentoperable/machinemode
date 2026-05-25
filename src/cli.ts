#!/usr/bin/env node
import { adapters } from './adapters/index.js';
import { Emitter } from './emit.js';

const TOOL = 'machinemode';
const TOOL_VERSION = '0.1.0';

function usageExit(code: number, msg?: string): never {
  if (msg) process.stderr.write(`machinemode: ${msg}\n`);
  process.stderr.write(
    'usage: machinemode <tool> [args...]\n' +
      '       machinemode capabilities\n' +
      '       machinemode --help\n' +
      '       machinemode --version\n' +
      '\n' +
      'available tools (v0.1):\n' +
      Array.from(adapters.values())
        .map((a) => `  ${a.name.padEnd(12)} ${a.description}`)
        .join('\n') +
      '\n',
  );
  process.exit(code);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0) usageExit(64, 'no tool specified');
  const first = argv[0]!;

  if (first === '--help' || first === '-h') usageExit(0);
  if (first === '--version') {
    process.stdout.write(`machinemode ${TOOL_VERSION}\n`);
    process.exit(0);
  }

  if (first === 'capabilities') {
    const emitter = new Emitter();
    emitter.meta({
      tool: TOOL,
      toolVersion: TOOL_VERSION,
      schemaName: 'io.agentoperable.machinemode.capabilities',
      schemaVersion: '1.0.0',
      command: 'capabilities',
    });
    process.stdout.write(
      JSON.stringify({
        tool: TOOL,
        tool_version: TOOL_VERSION,
        aoi_versions: ['0.2'],
        adapters: Array.from(adapters.values()).map((a) => ({
          name: a.name,
          schema_name: a.schemaName,
          schema_version: a.schemaVersion,
          description: a.description,
        })),
      }) + '\n',
    );
    emitter.summary({ ok: true, extra: { adapter_count: adapters.size } });
    process.exit(0);
  }

  const adapter = adapters.get(first);
  if (!adapter) {
    process.stderr.write(
      `machinemode: no adapter for "${first}" yet. Known: ${Array.from(adapters.keys()).join(', ')}.\n` +
        `Pull requests adding adapters are the project's primary form of contribution — see\n` +
        `https://github.com/agentoperable/machinemode for the pattern.\n`,
    );
    process.exit(64);
  }

  const emitter = new Emitter();
  emitter.meta({
    tool: TOOL,
    toolVersion: TOOL_VERSION,
    schemaName: adapter.schemaName,
    schemaVersion: adapter.schemaVersion,
    command: first,
    extra: { wrapped: [first, ...argv.slice(1)].join(' ') },
  });

  const exitCode = await adapter.run(argv.slice(1), emitter);
  process.exit(exitCode);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `machinemode internal error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(70);
});
