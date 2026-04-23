# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-04-22

### Added

- Streamable HTTP transport with stdio as the default local transport and legacy SSE gated behind an explicit compatibility switch.
- Central policy engine for host, command, path, root-login, sudo, destructive command, and destructive filesystem controls.
- `hostKeyPolicy`, `expectedHostKeySha256`, and per-session `policyMode` support for safer session creation and explain-mode workflows.
- Stable tool metadata, annotations, output schemas, structured content, curated MCP prompts, and additional resources for policy, audit, and support matrix visibility.
- CI/CD topology for personal source repository plus organization-owned automated validation, security scanning, trusted npm publishing, and Doppler-backed runtime secrets.
- GitLab manual validation pipeline and manual source mirroring workflow for the GitHub organization CI/CD repository.

### Changed

- Raised the runtime floor to Node.js `>=22.14.0` and aligned validation around Node 22/24 with Node 26 canary coverage.
- Default security posture is now strict host-key verification, no root SSH login, raw sudo denied, destructive operations policy-gated, and remote HTTP bound to loopback.
- File operations now enforce size limits and use SFTP-first behavior with safer portability fallbacks.
- Tunnels now have real lifecycle accounting and close semantics.
- Azure Pipelines are manual-only validation/release-control backups; automatic CI/CD now runs in the `oaslananka-lab` GitHub organization mirror.
- README, security, architecture, migration, enterprise, troubleshooting, and CI/CD documentation were updated for v2 behavior.

### Security

- Added machine-readable policy denials and standardized error codes including `EPOLICY`, `EHOSTKEY`, `ELIMIT`, and `EUNSUPPORTED`.
- Improved auditability, metrics, redacted structured logging, and safer publish provenance flow.
- Moved personal-repository mirror and emergency publish secrets behind Doppler runtime fetches.

### Breaking

- v2 secure defaults can deny workflows that previously relied on insecure host-key behavior, root login, raw sudo, or unrestricted destructive operations.
- Remote HTTP usage should migrate to Streamable HTTP at `/mcp`; legacy SSE is compatibility-only.
- Node.js versions below `22.14.0` are no longer supported.

## [1.3.5] - 2026-04-08

### Added

- Optional OpenTelemetry tracing with OTLP HTTP export support
- MCP resources for active sessions, metrics snapshots, Prometheus output, and configured SSH hosts
- Integration test layer for live SSH runtime and MCP boundary behavior
- Changesets support for version intent tracking
- Package content verification and license compliance scripts

### Changed

- Azure DevOps CI now includes integration-test, license, and package-content quality gates
- README, configuration docs, contributor guidance, and agent guidance now document tracing, resources, and release flow
- Docker test fixture now supports integration tests alongside E2E runs

## [1.3.3] - 2026-04-08

### Added

- Codex integration documentation with `codex mcp add` setup, verification, and optional host key hardening examples
- Generic MCP client guidance for Claude Desktop, Antigravity, and other stdio-compatible MCP tools
- INSTALL guide examples for both `servers` and `mcpServers` style client configurations

### Changed

- Published npm package `mcp-ssh-tool@1.3.3`
- Expanded README and INSTALL documentation to cover a broader set of MCP clients

## [1.3.0] - 2026-04-01

### Fixed

- **CRITICAL**: `scripts/setup-chatgpt.js` ESM/CJS uyumsuzluğu düzeltildi
- **CRITICAL**: `detect.ts` RHEL sürüm tespiti regex düzeltildi
- **CRITICAL**: `patch_apply` tool alan adı uyumsuzluğu (`patch` → `diff`) düzeltildi
- **CRITICAL**: `ensure_package` ve `ensure_lines_in_file` araçlarına `absent` state eklendi
- `commander` v14 için Node.js engine gereksinimleri güncellendi (`>=20`)
- `STRICT_HOST_KEY_CHECKING` env değişkeni artık `session.ts` tarafından okunuyor
- E2E testlerdeki `FileStatInfo.isFile` ve `DirListResult` tip hataları düzeltildi
- `fs-tools.ts` SFTP stat tip tespiti güvenli hale getirildi

### Added

- `absent` state desteği: `ensure_package` artık paket kaldırabilir
- `absent` state desteği: `ensure_lines_in_file` artık satır silebilir
- `ensure_service` tool'una `restarted` state eklendi
- `get_metrics` tool'u ile sunucu performans metrikleri sorgulanabilir
- Rate limiter artık MCP handler'a entegre edildi
- Sürüm senkronizasyonu için `scripts/sync-version.mjs` eklendi
- SSH config cache 5 dakikalık TTL ile yenileme desteği eklendi

### Changed

- Çift SSH bağlantısı kaldırıldı; `NodeSSH` dahili SFTP kanalı kullanılıyor
- `ssh2-sftp-client` bağımlılığı kaldırıldı
- README API Reference güncellendi (underscore tool isimleri)
- CI/CD Azure DevOps'a taşındı

### Security

- Bağlantı açılışında host key doğrulama durumu log'a yazılıyor

## [1.2.5] - 2026-01-31

### Fixed

- **CRITICAL**: Tool names now use underscore format (`ssh_open_session`) instead of dot-notation (`ssh.openSession`) to comply with MCP protocol specification. Old names still work via aliases for backward compatibility.
- Session cleanup interval reduced from 60s to 10s for better resource management
- Added proper `destroy()` method to SessionManager for clean shutdown

### Security

- **DSA key support removed**: DSA keys are deprecated (disabled by default since OpenSSH 8.8) and should not be used
- **Command injection protection**: Added package name validation in `ensurePackage()` to prevent shell injection attacks

### Changed

- TOOL_ALIASES now maps old dot-notation names to new underscore names (backwards compatible)

## [1.1.0] - 2026-01-02

### Added

- SSH config file parsing (`~/.ssh/config` support)
- `ssh.listSessions` tool to list all active sessions
- `ssh.ping` tool to check connection health
- `ssh.listConfiguredHosts` tool to list configured hosts
- `ssh.resolveHost` tool to resolve host aliases
- Safety warning system for dangerous commands (non-blocking)
- Auto-reconnect capability for dropped connections
- Command timeout support (`timeoutMs` parameter)
- Streaming output for long-running commands (`streaming.ts`)
- Port forwarding support (local/remote tunnels via `tunnel.ts`)
- File transfer with progress tracking (`transfer.ts`)
- Docker-based test environment (`docker-compose.yml`)
- Jest coverage configuration
- TypeDoc API documentation support
- Comprehensive documentation (CONTRIBUTING.md, examples/)

### Changed

- Improved error messages with actionable hints
- Enhanced session management with heartbeat monitoring

### Security

- Added safety warnings for potentially dangerous commands
- Improved sensitive data redaction in logs

## [1.0.0] - 2025-01-01

### Added

- Initial release
- SSH session management (open/close)
- Command execution (`proc.exec`, `proc.sudo`)
- File system operations (read, write, stat, list, mkdir, rm, rename)
- Package management (`ensure.package`)
- Service management (`ensure.service`)
- Line-in-file management (`ensure.linesInFile`)
- Patch application (`patch.apply`)
- OS detection (`os.detect`)
- Multiple authentication methods (password, key, agent)
- SSH key auto-discovery
- LRU session cache with TTL
- Sensitive data redaction in logs

[1.3.5]: https://github.com/oaslananka/mcp-ssh-tool/releases/tag/v1.3.5
[1.3.3]: https://github.com/oaslananka/mcp-ssh-tool/releases/tag/v1.3.3
[1.0.0]: https://github.com/oaslananka/mcp-ssh-tool/releases/tag/v1.0.0
