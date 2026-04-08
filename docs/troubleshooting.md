# Troubleshooting

This guide covers the most common issues when wiring `mcp-ssh-tool` into an MCP
client or when opening SSH sessions against remote hosts.

## The MCP server does not appear in my client

Checklist:

1. Confirm the package is installed or reachable via `npx`.
2. Verify the MCP client points to a stdio command such as `mcp-ssh-tool` or
   `npx -y mcp-ssh-tool`.
3. Restart the client after editing its MCP configuration.

Useful checks:

```bash
mcp-ssh-tool --version
codex mcp list
codex mcp get ssh-mcp
```

## Authentication fails

Common causes:

- wrong username or password
- key file path does not exist
- the SSH agent is not running
- the target host rejects the offered auth method

Things to verify:

```bash
ssh user@host
echo $SSH_AUTH_SOCK
```

If password auth works manually but not through the tool, check that the MCP
client is actually passing the `password` field and that logs do not show a
schema validation error.

## Host key verification fails

If you enabled strict host key checking and see host verification errors:

1. Ensure `KNOWN_HOSTS_PATH` points to the correct file.
2. Confirm the host key exists in that file.
3. Retry with a manual SSH connection to capture the new fingerprint first.

```bash
ssh -o StrictHostKeyChecking=accept-new user@host
```

## SFTP is unavailable on the target host

Some embedded or BusyBox-style systems expose SSH command execution but not an
SFTP subsystem. In that case:

- `ssh_open_session` can still succeed
- the result may show `sftpAvailable: false`
- core `fs_*` tools automatically fall back to shell-based implementations

If file tools fail on such a host, verify that common shell utilities like
`cat`, `mv`, `rm`, `mkdir`, and `ls` are present.

## Package or service helpers fail on Windows targets

`ensure_package` and `ensure_service` are intentionally Unix-oriented helpers.
On Windows targets, prefer:

- `proc_exec`
- `proc_sudo` where appropriate
- `fs_*` tools for file operations

## E2E tests do not run

`npm run test:e2e` intentionally skips live SSH tests unless
`RUN_SSH_E2E=1` is set.

Example:

```bash
RUN_SSH_E2E=1 npm run test:e2e
```

If Docker-backed tests are involved, ensure the SSH fixture container is up:

```bash
npm run e2e:docker
```

## CI fails on `npm audit`

The Azure pipeline treats `npm audit --audit-level=moderate` as a blocking
check. If it fails:

1. run `npm audit --audit-level=moderate` locally
2. inspect whether the issue is direct or transitive
3. upgrade the affected dependency or pin a safe range
4. if the advisory is clearly non-exploitable, document the rationale before
   relaxing policy
