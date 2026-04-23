# Contributing to mcp-ssh-tool

Thank you for your interest in contributing to mcp-ssh-tool! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- Node.js 24.14.1 LTS for local development (`.nvmrc` and `.node-version` are included)
- npm 11.12.1
- Git

### Getting Started

1. Fork the repository
2. Clone your fork:

   ```bash
   git clone https://github.com/YOUR_USERNAME/mcp-ssh-tool.git
   cd mcp-ssh-tool
   ```

3. Install dependencies:

   ```bash
   npm ci
   ```

4. Build the project:

   ```bash
   npm run build
   ```

5. Run tests:

   ```bash
   npm test
   ```

## Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Examples:

```
feat(session): add auto-reconnect capability
fix(auth): handle SSH agent timeout
docs(readme): update installation instructions
```

### Code Style

- Use TypeScript
- Follow ESLint rules
- Format with Prettier
- Add JSDoc comments for public APIs

### Testing

- Write tests for new features
- Maintain test coverage
- Run `npm run check` before opening a PR
- Run `npm run test:integration` when the change affects SSH runtime behavior or MCP server wiring

### Local Quality Gates

- `pre-commit` runs fast staged-file checks: Prettier plus staged TypeScript linting
- `pre-push` runs `npm run check:push`
- `npm run check` is the local equivalent of the primary CI quality/package verification path

### Pull Request Process

1. Create a feature branch
2. Make your changes
3. Add/update tests
4. Update documentation
5. Run linter and tests
6. Submit PR with clear description

## Continuous Integration (CI)

Primary automated CI/CD runs in the GitHub org mirror `oaslananka-lab/mcp-ssh-tool`, with Azure DevOps kept as a manual validation/release-control backup.

- `.github/workflows/ci.yml` is the source-of-truth parity workflow for quality, tests, integration, and package verification
- `.github/workflows/security.yml` handles CodeQL and dependency review in the org mirror
- `/.azure/pipelines/ci.yml` and `/.azure/pipelines/publish.yml` remain manual-only backup validation paths
- Personal GitHub workflows are manual-only fallback paths

## Releasing

Primary release automation runs from the GitHub org mirror after validation.

1. Create a changeset for user-visible work: `npm run changeset`
2. When preparing a release, apply pending changesets: `npm run changeset:version`
3. Review the generated version bump, then run `npm run sync-version`
4. Run quality gates locally: `npm run check`
5. If SSH/runtime behavior changed, run `npm run test:integration`
6. Commit and push the versioned changes.
7. Create and push a tag: `git tag v2.0.0 && git push origin v2.0.0`

Azure publish validation checks:

- `package.json`, `mcp.json`, `server.json`, registry metadata, and `src/mcp.ts` version consistency
- test and build health before publish

GitHub Actions `publish.yml` should be used only if the org trusted-publish path is unavailable and a manual hotfix publish is required.

## Project Structure

```
mcp-ssh-tool/
├── src/
│   ├── index.ts        # Entry point
│   ├── container.ts    # Dependency injection wiring
│   ├── mcp.ts          # MCP server shell and registry wiring
│   ├── tools/          # Tool providers and registry
│   ├── session.ts      # SSH session management
│   ├── process.ts      # Command execution
│   ├── fs-tools.ts     # File operations
│   ├── ensure.ts       # Package/service management
│   ├── detect.ts       # OS detection
│   ├── ssh-config.ts   # SSH config parsing
│   ├── safety.ts       # Safety warnings
│   ├── types.ts        # TypeScript types
│   ├── errors.ts       # Error handling
│   └── logging.ts      # Logging utilities
├── test/
│   ├── unit/           # Unit tests
│   └── e2e/            # E2E tests
└── dist/               # Compiled output
```

## Adding New Features

### Adding a New MCP Tool

1. Define or reuse the schema in `src/types.ts`
2. Create or update a provider in `src/tools/`
3. Register the provider in `src/tools/index.ts`
4. Add tests in `test/unit/tools/`
5. Update documentation

### Adding a New MCP Resource

1. Add the resource definition in `src/resources.ts`
2. Extend `readResource()` to return the new payload
3. Add unit coverage in `test/unit/resources.test.ts`
4. Add an integration assertion in `test/integration/mcp.integration.test.ts` if the resource depends on live runtime state

### Adding New Dependencies

- Evaluate necessity carefully
- Prefer lightweight packages
- Check for security vulnerabilities
- Update `package.json` appropriately

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
