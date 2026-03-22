# mcp-ssh-tool

[![npm version](https://img.shields.io/npm/v/mcp-ssh-tool.svg)](https://www.npmjs.com/package/mcp-ssh-tool)
[![npm downloads](https://img.shields.io/npm/dm/mcp-ssh-tool.svg)](https://www.npmjs.com/package/mcp-ssh-tool)
[![license](https://img.shields.io/npm/l/mcp-ssh-tool.svg)](https://github.com/oaslananka/mcp-ssh-tool/blob/main/LICENSE)
[![LobeHub](https://img.shields.io/badge/LobeHub-MCP%20Server-6D4AFF)](https://lobehub.com/tr/mcp/oaslananka-mcp-ssh-tool)

A Model Context Protocol (MCP) SSH client server that provides autonomous SSH operations for GitHub Copilot and VS Code. Enable natural language SSH automation without manual prompts or GUI interactions.

## Quick Start

### Install

- Global install (recommended): `npm install -g mcp-ssh-tool`
- One-off run: `npx mcp-ssh-tool`

### MCP Client Configuration (VS Code / Claude Desktop / others)

Add to your MCP configuration (`mcp.json`, `.vscode/mcp.json`, or the Claude Desktop MCP config):

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

### Usage Examples

Once configured, you can use natural language with your MCP client:

- **SSH Connection**: "Connect to server 192.168.1.100 as admin using SSH key"
- **File Operations**: "Read the content of /etc/nginx/nginx.conf on the server"
- **Command Execution**: "Run 'systemctl status nginx' on the remote server"
- **Package Management**: "Install htop package on Ubuntu server"
- **Service Control**: "Restart the nginx service"
- **Claude Desktop**: "connect to my server and check disk usage"
- **Install a package/service stack**: "install nginx on my remote server"
- **Read a config file**: "read the file /etc/nginx/nginx.conf"
- **Restart a service**: "restart the nginx service"
- **Browse logs**: "list files in /var/log"

### Available Tools

- `ssh_open_session` - Establish SSH connection with various auth methods
- `ssh_close_session` - Close SSH session
- `ssh_list_sessions` - List all active SSH sessions
- `ssh_ping` - Check if a session is alive and responsive
- `ssh_list_configured_hosts` - List hosts from ~/.ssh/config
- `ssh_resolve_host` - Resolve host alias from SSH config
- `proc_exec` - Execute commands remotely (with optional timeout)
- `proc_sudo` - Execute commands with sudo privileges
- `fs_read`, `fs_write`, `fs_list`, `fs_stat`, `fs_mkdirp`, `fs_rmrf`, `fs_rename` - File system operations
- `ensure_package` - Package management with `present` and `absent` states
- `ensure_service` - Service control including `restarted`
- `ensure_lines_in_file` - File line management with `present` and `absent` states
- `patch_apply` - Apply patches to files
- `os_detect` - System information detection
- `get_metrics` - Server metrics in JSON or Prometheus format

## Overview

The SSH MCP Server acts as a bridge between GitHub Copilot and remote systems via SSH. It supports:

- **Non-interactive SSH operations** - No prompts or GUI interactions
- **Multiple authentication methods** - Password, SSH keys, or SSH agent
- **Session management** - Automatic connection pooling with TTL and LRU eviction
- **File system operations** - Read, write, list, and manage remote files via SFTP, with SSH-shell fallbacks for hosts that do not expose an SFTP subsystem
- **Process execution** - Run commands and sudo operations remotely
- **High-level automation** - Package management, service control, and configuration management
- **Security** - Automatic redaction of sensitive data in logs

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  GitHub Copilot │────│  SSH MCP Server  │────│  Remote Systems │
│     / VS Code   │    │                  │    │   (via SSH)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │ MCP stdio protocol    │ Session management    │ SSH + optional SFTP
         │                       │ LRU cache + TTL       │
         │                       │ Auth strategies       │
```

### Embedded / BusyBox Targets

Some embedded targets expose SSH command execution but do not ship an SFTP
subsystem, which is common with Dropbear- or BusyBox-based systems. In that
case `ssh_open_session` still succeeds and reports `sftpAvailable: false`.
Core file tools such as `fs_read`, `fs_write`, `fs_stat`, `fs_list`,
`fs_mkdirp`, `fs_rmrf`, and `fs_rename` automatically fall back to shell-based
implementations.

## Installation

### Prerequisites

- Node.js ≥ 20 (LTS)
- SSH access to target systems
- SSH keys or credentials for authentication

### Install from npm

```bash
npm install -g mcp-ssh-tool
```

### Build from source

```bash
git clone https://github.com/oaslananka/mcp-ssh-tool.git
cd mcp-ssh-tool
npm install
npm run build
npm link
```

### CLI Flags

- `--help` / `-h`: Show usage and examples.
- `--version` / `-v`: Print version.
- `--stdio`: Force stdio mode (default).

**Note:** This is an MCP stdio server. The terminal is not an interactive shell; use an MCP client (Claude Desktop, VS Code MCP, etc.) or send JSON-RPC over stdio.

### Platform Notes

- **Linux / macOS:** Uses POSIX shell wrappers with safe quoting. Default temp directory: `/tmp`.
- **Windows targets:** Requires OpenSSH server/agent; key discovery checks `C:\\Users\\<you>\\.ssh\\`. Commands are wrapped for PowerShell-safe execution. Package/service helpers are intentionally disabled on Windows targets.
- **Host keys:** Host key checking is relaxed by default. Set `STRICT_HOST_KEY_CHECKING=true` and optionally `KNOWN_HOSTS_PATH` to enforce verification.

## ChatGPT Desktop Integration

### Quick Setup

```bash
npm run setup:chatgpt
```

This command automatically configures ChatGPT Desktop to use mcp-ssh-tool.

### Manual Setup

Add to your ChatGPT Desktop MCP config:

- **macOS**: `~/Library/Application Support/ChatGPT/mcp.json`
- **Windows**: `%APPDATA%\ChatGPT\mcp.json`
- **Linux**: `~/.config/chatgpt/mcp.json`

```json
{
  "mcpServers": {
    "ssh-mcp-server": {
      "name": "ssh-mcp-server",
      "command": "npx",
      "args": ["-y", "mcp-ssh-tool"]
    }
  }
}
```

For detailed usage, see [docs/chatgpt-usage.md](docs/chatgpt-usage.md).

## VS Code Copilot Integration

### User-level Configuration (Recommended)

Open VS Code and press `Ctrl+Shift+P`, then run **"MCP: Open User Configuration"**.

Add to your `mcp.json`:

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

### Workspace-level Configuration

Create `.vscode/mcp.json` in your workspace:

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

### Verification

1. Restart VS Code
2. Open Copilot Chat
3. The SSH MCP tools should appear in the available tools list
4. Test with: *"Connect to 192.168.1.100 as admin and run 'uname -a'"*

## Usage Examples

### Basic Connection and Command Execution

```
"Connect to 10.11.12.13 as deployer with password 'mypass' and run 'df -h'"
```

### File Operations

```
"Connect to server.example.com as admin, read /etc/nginx/nginx.conf and show me the server blocks"
```

### System Administration

```
"Connect to 192.168.1.50 as root, install htop package, start nginx service, and list /var/www contents"
```

### Configuration Management

```
"Connect to web-server as admin, add these lines to /etc/hosts:
192.168.1.10 db-server
192.168.1.20 cache-server
Then restart networking service"
```

### Ready-to-use Prompt Ideas

```text
"connect to my server and check disk usage"
```

```text
"install nginx on my remote server"
```

```text
"read the file /etc/nginx/nginx.conf"
```

```text
"restart the nginx service"
```

```text
"list files in /var/log"
```

## Pro Tips

- **Multiple sessions**: Open one session per host or environment and keep them alive with `ssh_list_sessions` and `ssh_ping` when you are switching between production, staging, and development machines.
- **SFTP fallback for BusyBox/Dropbear**: On embedded systems that do not expose an SFTP subsystem, `ssh_open_session` can still succeed with `sftpAvailable: false`, and the core `fs_*` tools automatically fall back to shell-based implementations.
- **Host key verification**: Set `STRICT_HOST_KEY_CHECKING=true` in the MCP server environment and optionally `KNOWN_HOSTS_PATH` for stricter production-grade SSH verification.

## API Reference

### Session tools

#### `ssh_open_session`

```json
{
  "host": "example.com",
  "username": "admin",
  "port": 22,
  "auth": "auto",
  "password": "optional",
  "privateKey": "optional-inline-key",
  "privateKeyPath": "optional-path",
  "passphrase": "optional",
  "useAgent": false,
  "readyTimeoutMs": 20000,
  "ttlMs": 900000
}
```

Returns:

```json
{
  "sessionId": "ssh-1645123456789-1",
  "host": "example.com",
  "username": "admin",
  "expiresInMs": 900000
}
```

#### `ssh_close_session`

```json
{
  "sessionId": "ssh-1645123456789-1"
}
```

#### `ssh_list_sessions`, `ssh_ping`, `ssh_list_configured_hosts`, `ssh_resolve_host`

- `ssh_list_sessions` returns active sessions with remaining TTL.
- `ssh_ping` checks liveness and latency for a session.
- `ssh_list_configured_hosts` reads `~/.ssh/config`.
- `ssh_resolve_host` expands an SSH host alias into connection parameters.

### Command tools

#### `proc_exec`

```json
{
  "sessionId": "ssh-1645123456789-1",
  "command": "ls -la /home",
  "cwd": "/tmp",
  "env": {
    "DEBUG": "1"
  },
  "timeoutMs": 30000
}
```

#### `proc_sudo`

```json
{
  "sessionId": "ssh-1645123456789-1",
  "command": "systemctl restart nginx",
  "password": "sudo-password",
  "cwd": "/etc",
  "timeoutMs": 30000
}
```

Both return:

```json
{
  "code": 0,
  "stdout": "command output",
  "stderr": "",
  "durationMs": 245
}
```

### File tools

- `fs_read`

```json
{
  "sessionId": "ssh-1645123456789-1",
  "path": "/etc/hosts",
  "encoding": "utf8"
}
```

- `fs_write`

```json
{
  "sessionId": "ssh-1645123456789-1",
  "path": "/tmp/config.txt",
  "data": "server_name example.com;\nlisten 80;",
  "mode": 420
}
```

- `fs_stat` returns `size`, `mtime`, `mode`, and `type`.
- `fs_list` returns `{ "entries": [...], "nextToken": "optional" }`.
- `fs_mkdirp` creates directories recursively.
- `fs_rmrf` removes files or directories recursively.
- `fs_rename` renames or moves a path.

### Configuration and automation tools

#### `ensure_package`

```json
{
  "sessionId": "ssh-1645123456789-1",
  "name": "nginx",
  "state": "present",
  "sudoPassword": "optional"
}
```

`state` supports `present` and `absent`.

#### `ensure_service`

```json
{
  "sessionId": "ssh-1645123456789-1",
  "name": "nginx",
  "state": "restarted",
  "sudoPassword": "optional"
}
```

`state` supports `started`, `stopped`, `restarted`, `enabled`, and `disabled`.

#### `ensure_lines_in_file`

```json
{
  "sessionId": "ssh-1645123456789-1",
  "path": "/etc/hosts",
  "lines": [
    "192.168.1.10 db-server",
    "192.168.1.20 cache-server"
  ],
  "state": "present",
  "createIfMissing": true,
  "sudoPassword": "optional"
}
```

`state` supports `present` and `absent`.

#### `patch_apply`

```json
{
  "sessionId": "ssh-1645123456789-1",
  "path": "/etc/hosts",
  "diff": "@@ -1 +1 @@\n-old\n+new"
}
```

#### `os_detect`

Returns remote platform, distro, version, package manager, init system, shell, and temp directory.

#### `get_metrics`

Returns server metrics. Default output is JSON; optional `{ "format": "prometheus" }` emits Prometheus text format.

## Authentication

The server supports multiple authentication methods with automatic fallback:

### Authentication Strategy Priority

1. **Password** (if provided)
2. **SSH Key** (inline → path → auto-discovery)
3. **SSH Agent** (if available)

### SSH Key Auto-Discovery

The server automatically searches for SSH keys in:

- `~/.ssh/id_ed25519`
- `~/.ssh/id_rsa`
- `~/.ssh/id_ecdsa`

> **Note:** DSA keys (`id_dsa`) are no longer supported due to security concerns.

Custom key directory: Set `SSH_DEFAULT_KEY_DIR` environment variable.

### Examples

**Password Authentication:**

```json
{
  "host": "server.com",
  "username": "admin",
  "auth": "password",
  "password": "secret"
}
```

**SSH Key (inline):**

```json
{
  "host": "server.com",
  "username": "admin",
  "auth": "key",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...",
  "passphrase": "optional"
}
```

**SSH Key (file path):**

```json
{
  "host": "server.com",
  "username": "admin",
  "auth": "key",
  "privateKeyPath": "/home/user/.ssh/id_rsa"
}
```

**SSH Agent:**

```json
{
  "host": "server.com",
  "username": "admin",
  "auth": "agent"
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level (`error`, `warn`, `info`, `debug`) | `info` |
| `STRICT_HOST_KEY_CHECKING` | Enable strict SSH host key verification | `false` |
| `KNOWN_HOSTS_PATH` | Custom `known_hosts` file path | `~/.ssh/known_hosts` |
| `SSH_DEFAULT_KEY_DIR` | SSH key search directory | `~/.ssh` |
| `SSH_MCP_MAX_SESSIONS` | Maximum concurrent sessions | `20` |
| `SSH_MCP_SESSION_TTL` | Session TTL in milliseconds | `900000` |
| `SSH_MCP_COMMAND_TIMEOUT` | Default command timeout in milliseconds | `30000` |
| `SSH_MCP_DEBUG` | Enable debug logging | `false` |
| `SSH_MCP_RATE_LIMIT` | Enable rate limiting (`true` / `false`) | `true` |

### Default Settings

- **Connection timeout:** 20 seconds
- **Session TTL:** 15 minutes
- **Max concurrent sessions:** 20
- **Host key checking:** Relaxed (disabled by default)

## Error Codes

The server returns structured error codes for machine-readable error handling:

- **EAUTH** - Authentication failed
- **ECONN** - Connection error
- **ETIMEOUT** - Operation timeout
- **ENOSUDO** - Sudo operation failed
- **EPMGR** - Package manager not found
- **EFS** - File system operation failed
- **EPATCH** - Patch application failed
- **EBADREQ** - Invalid request parameters

Each error includes:

- `name`: Error class name
- `code`: Machine-readable error code
- `message`: Human-readable error message
- `hint`: Optional suggestion for resolution

## Security Features

### Data Redaction

Sensitive data is automatically redacted from logs:

- Passwords
- Private keys
- Passphrases
- Sudo passwords
- SSH agent socket paths

### Connection Security

- Configurable host key verification
- Support for known_hosts files
- Connection timeout enforcement
- Automatic session cleanup

### Session Management

- TTL-based session expiration
- LRU cache eviction
- Graceful connection cleanup
- No persistent credential storage

## Development

### Setup

```bash
git clone https://github.com/oaslananka/mcp-ssh-tool.git
cd mcp-ssh-tool
npm install
```

### Scripts

```bash
npm run build      # Compile TypeScript
npm run dev        # Watch mode compilation
npm run test       # Run unit tests
npm run test:e2e   # Run E2E tests (requires RUN_SSH_E2E=1)
npm run lint       # Type-check (no emit)
npm run format     # Run Prettier
npm run test:coverage
npm run docs
```

### Testing

**Unit Tests:**

```bash
npm test
```

**E2E Tests (optional):**

```bash
RUN_SSH_E2E=1 npm run test:e2e
```

## License

MIT License

Copyright (c) 2025 Osman Aslan (oaslananka)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

E2E tests require a local Docker container or SSH server for testing.

## Contributing

1. Follow TypeScript and ESLint rules
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass
5. Use conventional commit messages

## License

MIT License - see LICENSE file for details.

## References

- [Model Context Protocol](https://modelcontextprotocol.io)
- [Anthropic MCP on GitHub](https://github.com/anthropics/mcp)
- [Glama MCP Server Listing](https://glama.ai/mcp/servers/oaslananka/mcp-ssh-tool)
- [LobeHub MCP Listing](https://lobehub.com/tr/mcp/oaslananka-mcp-ssh-tool)
- [VS Code MCP Guide](https://code.visualstudio.com/docs/copilot/copilot-extensibility-overview) - VS Code Copilot extensibility
- [GitHub Copilot](https://github.com/features/copilot) - GitHub Copilot documentation
