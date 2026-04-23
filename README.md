# mcp-ssh-tool

[![npm version](https://img.shields.io/npm/v/mcp-ssh-tool.svg)](https://www.npmjs.com/package/mcp-ssh-tool)
[![Official MCP Registry](https://img.shields.io/badge/MCP%20Registry-active-green.svg)](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.oaslananka%2Fmcp-ssh-tool/versions/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/mcp-ssh-tool.svg)](https://www.npmjs.com/package/mcp-ssh-tool)

Production-grade MCP SSH automation for operators, developers, and AI clients. `mcp-ssh-tool` opens persistent SSH sessions and exposes safe, structured tools for command execution, file operations, transfers, tunnels, package/service management, metrics, resources, and guided prompts.

v2 is secure by default: strict host-key verification is on, root login is off, raw sudo is policy-gated, destructive commands and filesystem mutations are denied unless policy allows them, and remote HTTP starts on loopback only unless bearer auth and allowed origins are configured.

## Why This Server

- **Trust:** central policy engine, structured audit events, redacted logs, strict host keys, and machine-readable errors.
- **MCP quality:** stdio for local clients, Streamable HTTP for remote clients, legacy SSE only behind an explicit compatibility flag.
- **AI-friendly tools:** stable output schemas, `structuredContent`, annotations for read-only/destructive/idempotent behavior, resources, and curated prompts.
- **Operations:** session TTL/eviction, command timeouts, transfer checksum verification, real SSH forwarding, Prometheus metrics, and OpenTelemetry hooks.
- **Portability:** SFTP first, POSIX/BusyBox-aware shell fallbacks for basic file operations, and explicit support boundaries.

## Quick Start

```bash
npm install -g mcp-ssh-tool
```

Add a stdio MCP server to your client:

```json
{
  "servers": {
    "ssh-mcp": {
      "type": "stdio",
      "command": "mcp-ssh-tool",
      "args": []
    }
  }
}
```

Use it from your MCP client:

```text
Open a safe SSH session to prod-1 as deploy, inspect host capabilities, then show disk usage.
```

## Requirements

- Node.js `22.22.2+` or `24.14.1+` (LTS only)
- SSH access to target hosts
- A populated `known_hosts` file for strict host verification, or an explicit per-session host-key policy

## Transports

| Mode | Command | Use When |
|------|---------|----------|
| stdio | `mcp-ssh-tool` | Local desktop clients such as ChatGPT, Claude Desktop, VS Code, Cursor, or Codex. |
| Streamable HTTP | `mcp-ssh-tool --transport=http --host 127.0.0.1 --port 3000` | Remote MCP clients, reverse proxies, or Inspector sessions. |
| legacy SSE | `mcp-ssh-tool --transport=http --enable-legacy-sse` | Temporary v1 compatibility only. Prefer Streamable HTTP. |

Non-loopback HTTP startup is refused unless both `--bearer-token-file` and allowed origins are configured.

## Secure Defaults

| Area | v2 Default |
|------|------------|
| Host keys | `hostKeyPolicy=strict`, `knownHostsPath=~/.ssh/known_hosts` |
| Root SSH login | denied |
| Raw `proc_sudo` | denied unless `allowRawSudo=true` |
| Destructive commands | denied unless `allowDestructiveCommands=true` |
| Destructive fs operations | allowed only under policy prefixes, denied elsewhere |
| HTTP bind | `127.0.0.1` |
| Legacy SSE | disabled |
| File reads | size-limited by `SSH_MCP_MAX_FILE_SIZE` |

Per-session `policyMode: "explain"` returns a plan/verdict without executing. Use it before mutations when an AI client needs to summarize risk.

## Policy Example

Set `SSH_MCP_POLICY_FILE=/etc/mcp-ssh-tool/policy.json`:

```json
{
  "mode": "enforce",
  "allowRootLogin": false,
  "allowRawSudo": false,
  "allowDestructiveCommands": false,
  "allowDestructiveFs": false,
  "allowedHosts": ["^prod-[0-9]+\\.example\\.com$"],
  "commandAllow": ["^(uname|df|uptime|systemctl status)\\b"],
  "commandDeny": ["rm\\s+-rf\\s+/", "shutdown", "reboot"],
  "pathAllowPrefixes": ["/tmp", "/var/tmp", "/home/deploy"],
  "pathDenyPrefixes": ["/etc/shadow", "/etc/sudoers", "/boot", "/dev", "/proc"]
}
```

Simple deploys can use environment overrides such as `SSH_MCP_ALLOW_RAW_SUDO=true`, `SSH_MCP_ALLOWED_HOSTS=prod-1.example.com`, or `SSH_MCP_PATH_ALLOW_PREFIXES=/tmp,/home/deploy`.

## Core Tools

- `ssh_open_session`, `ssh_close_session`, `ssh_list_sessions`, `ssh_ping`, `ssh_list_configured_hosts`, `ssh_resolve_host`
- `proc_exec`, `proc_sudo`, `proc_exec_stream`
- `fs_read`, `fs_write`, `fs_list`, `fs_stat`, `fs_mkdirp`, `fs_rmrf`, `fs_rename`
- `file_upload`, `file_download`
- `ensure_package`, `ensure_service`, `ensure_lines_in_file`, `patch_apply`
- `os_detect`, `get_metrics`
- `tunnel_local_forward`, `tunnel_remote_forward`, `tunnel_list`, `tunnel_close`

All tools return text plus stable `structuredContent`. Tool metadata includes titles, output schemas, and annotations that disclose read-only, destructive, idempotent, and external side-effect behavior.

## Resources And Prompts

Resources:

- `mcp-ssh-tool://sessions/active`
- `mcp-ssh-tool://metrics/json`
- `mcp-ssh-tool://metrics/prometheus`
- `mcp-ssh-tool://ssh-config/hosts`
- `mcp-ssh-tool://policy/effective`
- `mcp-ssh-tool://audit/recent`
- `mcp-ssh-tool://capabilities/support-matrix`

Prompts:

- `safe-connect`
- `inspect-host-capabilities`
- `plan-mutation`
- `managed-config-change`

## Support Matrix

| Target | Status |
|--------|--------|
| Linux | Full support. |
| macOS/BSD | Session, process, fs, and transfer supported; package/service helpers only where tested. |
| BusyBox/dropbear | Experimental for session, process, and basic fs fallbacks. |
| Windows SSH targets | Experimental for session, process, fs, and transfer; no `proc_sudo` or `ensure_*`. |

## Client Examples

ChatGPT or Claude Desktop:

```json
{
  "mcpServers": {
    "ssh-mcp": {
      "command": "npx",
      "args": ["-y", "mcp-ssh-tool"]
    }
  }
}
```

VS Code or Cursor:

```json
{
  "servers": {
    "ssh-mcp": {
      "type": "stdio",
      "command": "mcp-ssh-tool"
    }
  }
}
```

MCP Inspector over HTTP:

```bash
printf '%s' 'super-secret-token' > .mcp-token
mcp-ssh-tool --transport=http --host 127.0.0.1 --port 3000 --bearer-token-file .mcp-token
```

## Configuration

High-value environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `SSH_MCP_POLICY_FILE` | unset | Canonical JSON policy source. |
| `SSH_MCP_HOST_KEY_POLICY` | `strict` | `strict`, `accept-new`, or `insecure`. |
| `SSH_MCP_KNOWN_HOSTS_PATH` | `~/.ssh/known_hosts` | Known-hosts file for strict verification. |
| `SSH_MCP_MAX_FILE_SIZE` | `10485760` | Max bytes for `fs_read`. |
| `SSH_MCP_COMMAND_TIMEOUT` | `30000` | Default command timeout. |
| `SSH_MCP_HTTP_HOST` | `127.0.0.1` | Streamable HTTP bind host. |
| `SSH_MCP_HTTP_PORT` / `PORT` | `3000` | Streamable HTTP port. |
| `SSH_MCP_HTTP_BEARER_TOKEN_FILE` | unset | Required for non-loopback HTTP. |
| `SSH_MCP_HTTP_ALLOWED_ORIGINS` | loopback origins | Comma-separated allowed origins. |

Deprecated aliases `STRICT_HOST_KEY_CHECKING` and `SSH_MCP_STRICT_HOST_KEY` are still accepted for one v2 compatibility cycle. Prefer `SSH_MCP_HOST_KEY_POLICY`.

## Development

Use the exact local runtime from `.nvmrc` / `.node-version`, then run:

```bash
npm ci
npm run check
```

Live SSH suites are opt-in:

```bash
RUN_SSH_INTEGRATION=1 npm run test:integration
RUN_SSH_E2E=1 npm run test:e2e
```

Local quality gates are layered:

- `pre-commit`: formats staged files and lints staged TypeScript only
- `pre-push`: runs `npm run check:push`
- manual/full parity: `npm run check`

## CI/CD Ownership

The personal repository `https://github.com/oaslananka/mcp-ssh-tool` is the main source repository. Automatic CI/CD and trusted npm publishing run from the organization mirror `https://github.com/oaslananka-lab/mcp-ssh-tool`; Azure, GitLab, and personal GitHub release actions are manual-only.

See [docs/ci-cd-topology.md](docs/ci-cd-topology.md) for mirror secrets, release flow, and manual fallback guidance.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [SECURITY_DECISIONS.md](SECURITY_DECISIONS.md)
- [MIGRATION.md](MIGRATION.md)
- [docs/ci-cd-topology.md](docs/ci-cd-topology.md)
- [docs/configuration.md](docs/configuration.md)
- [docs/security-model.md](docs/security-model.md)
- [docs/troubleshooting.md](docs/troubleshooting.md)
- [docs/enterprise-deployment.md](docs/enterprise-deployment.md)

## License

MIT License. See [LICENSE](LICENSE).
