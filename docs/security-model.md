# Security Model

`mcp-ssh-tool` is a remote automation server. It can open SSH sessions, run
commands, modify files, and manage services on target hosts. The security model
therefore focuses on reducing accidental exposure and unsafe defaults without
pretending the tool can fully sandbox a trusted SSH operator.

## What The Server Protects

### Sensitive Log Redaction

The logger automatically redacts common secret-shaped fields and message
patterns, including:

- passwords
- private keys and PEM blobs
- passphrases
- tokens and bearer credentials
- API keys and generic auth fields

Use `LOG_FORMAT=json` if logs are shipped to Azure Monitor, Datadog, or another
aggregator. Redaction is applied before log serialization.

### Host Key Verification

Host key checking is relaxed by default for ease of first-time setup. For
production use, set:

```dotenv
STRICT_HOST_KEY_CHECKING=true
KNOWN_HOSTS_PATH=/path/to/known_hosts
```

Per-request parameters can further tighten host key behavior for individual
connections.

### Session Lifecycle Controls

- sessions expire automatically based on TTL
- inactive sessions are cleaned up on an interval
- the session manager evicts older entries when the max-session limit is reached
- credentials are used in memory for connection setup and are not stored
  persistently by the server

### Rate Limiting

The server applies a sliding-window rate limiter around tool execution. This
helps reduce brute-force or flood-style abuse against the MCP entry point.

## Safety Warnings

`src/safety.ts` classifies risky shell commands into risk levels such as
critical, high, medium, and low. These checks are intentionally advisory:

- they help the caller understand dangerous inputs
- they do not replace SSH permissions, sudo policy, or remote system hardening
- they do not turn the tool into a sandbox

The practical trust boundary is still the target host and the credentials used
to access it.

## Recommended Deployment Posture

- enable strict host key checking
- prefer SSH keys or agent auth over passwords
- scope credentials to the minimum required host/user combination
- run the MCP server in a controlled workstation or CI environment
- ship stderr logs to a secure destination if centralized observability is used
- treat MCP clients as privileged operators because they can invoke powerful
  remote actions
