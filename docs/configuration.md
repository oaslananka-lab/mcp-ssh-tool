# Configuration

`mcp-ssh-tool` reads configuration from environment variables and, for some
tools, per-request arguments. Request arguments win over environment variables,
and environment variables win over built-in defaults.

## Core Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logger verbosity. Supported values: `error`, `warn`, `info`, `debug`. |
| `LOG_FORMAT` | `plain` | Log output format. Use `json` for log shippers and aggregators. |
| `STRICT_HOST_KEY_CHECKING` | `false` | Enables SSH host key verification in the session manager. |
| `KNOWN_HOSTS_PATH` | `~/.ssh/known_hosts` | Overrides the `known_hosts` file used when strict host checking is enabled. |
| `SSH_DEFAULT_KEY_DIR` | `~/.ssh` | Directory used for SSH key auto-discovery (`id_ed25519`, `id_rsa`, `id_ecdsa`). |
| `SSH_MCP_MAX_SESSIONS` | `20` | Maximum number of concurrent SSH sessions stored by the session manager. |
| `SSH_MCP_SESSION_TTL` | `900000` | Default session time-to-live in milliseconds. |
| `SSH_MCP_COMMAND_TIMEOUT` | `30000` | Default command timeout in milliseconds for command execution helpers. |
| `SSH_MCP_RATE_LIMIT` | `true` | Enables or disables global rate limiting. |
| `SSH_MCP_DEBUG` | `false` | Compatibility flag used by `ConfigManager`; keep `LOG_LEVEL=debug` as the main switch for verbose logs. |
| `SSH_MCP_STRICT_HOST_KEY` | `false` | Legacy compatibility alias for strict host key verification. Prefer `STRICT_HOST_KEY_CHECKING`. |

## Runtime Mode Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SSH_MCP_DAEMON` | `false` | Keeps the CLI process alive after startup for daemon-style launches. |
| `SSH_MCP_ONESHOT` | `false` | Allows a single request/response lifecycle in wrapper scripts. |
| `PORT` | `3000` | HTTP/SSE port used by `npm run start:http`. |

## Example `.env`

```dotenv
LOG_LEVEL=info
LOG_FORMAT=json
STRICT_HOST_KEY_CHECKING=true
KNOWN_HOSTS_PATH=/etc/ssh/ssh_known_hosts
SSH_MCP_MAX_SESSIONS=50
SSH_MCP_SESSION_TTL=1800000
SSH_MCP_COMMAND_TIMEOUT=45000
SSH_MCP_RATE_LIMIT=true
PORT=3000
```

## Notes

- `ssh_open_session` accepts `strictHostKeyChecking`, `knownHostsPath`, and
  authentication fields directly; those request-level values override the
  environment.
- `SSH_AUTH_SOCK` is consumed automatically when SSH agent authentication is
  available. It is usually supplied by the host environment and does not need
  to be stored in `.env`.
- Package and service helpers intentionally target Unix-like systems. Windows
  hosts can still use the lower-level SSH and file tools.
