# machinemode

An AOI mode for `ls`, `find`, `grep`, and the other coreutils-class tools agents touch constantly.

For the standard, see <https://machinemode.io>.
For why this matters, see <https://machinemode.io/direction#07> ("The coreutils gap").

## What it does

```bash
machinemode <tool> [args...]
```

Runs an existing non-AOI tool against your system and wraps its output as a typed AOI event stream. The system's `ls` becomes:

```bash
machinemode ls -la /var/log
```

```jsonl
{"type":"aoi:meta","tool":"machinemode","tool_version":"0.1.0","aoi_version":"0.2","schema_name":"io.agentoperable.machinemode.ls.events","schema_version":"1.0.0","command":"ls","wrapped":"ls -la /var/log"}
{"type":"entry","name":"syslog","perms":"-rw-r-----","links":1,"owner":"root","group":"adm","size":2034531,"mtime":"May 24 08:14"}
{"type":"entry","name":"auth.log","perms":"-rw-r-----","links":1,"owner":"syslog","group":"adm","size":48291,"mtime":"May 24 19:02"}
{"type":"aoi:summary","ok":true,"count":2,"truncated":false,"elapsed_ms":7}
```

Works against the system's existing binaries — nothing new to install on the target side.

## Why two projects (this and aoi-coreutils)

`machinemode` is the **wrapper** path: invoke the system's existing utilities, parse their human-formatted output, emit AOI events. Pros: broad coverage today, no install-on-target. Cons: parser brittleness, GNU vs BSD output variance.

[`aoi-coreutils`](https://github.com/agentoperable/aoi-coreutils) is the **native** path: rewrite the same utilities as first-class AOI tools. Pros: clean event emission, OS-independent output. Cons: per-tool reimplementation, need to install.

They're complementary. Use `machinemode` for breadth; use `aoi-coreutils` for the tools where parser brittleness or cross-platform consistency matters.

## v0.1 adapters

| Tool | Status |
|---|---|
| `ls` | ✓ shipped — entry events with name, perms, owner, group, size, mtime |
| `find`, `grep`, `cat`, `wc`, `du`, `stat`, `cp`, `mv`, `rm`, `head`, `tail`, `sort`, `uniq`, `cut`, `tr`, `awk`, `sed`, `xargs`, `curl`, `jq`, `git log` | planned |

One PR per upstream tool. Adapter modules live under `src/adapters/`. See `src/adapters/ls.ts` for the reference shape.

## Install

```bash
npm i -g machinemode
# or, locally:
pnpm add -D machinemode
```

## Use

```bash
machinemode ls -la
machinemode ls --output jsonl -la /var/log     # --output jsonl is the default in machinemode, so this is equivalent
machinemode capabilities                        # list known adapters
machinemode --version
```

Output is always JSONL on stdout; `meta` first, terminal `aoi:summary` last. Compatible with `jq -e 'select(.type=="aoi:summary") | .ok == true'` for pipefail-style chains.

## Status

**v0.1 — single adapter scaffold.** Proves the per-tool adapter pattern. PRs adding adapters are the goal.

## License

MIT
