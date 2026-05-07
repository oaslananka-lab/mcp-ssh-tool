# Repository Operations

## Canonical Model

- Canonical repository: `https://github.com/oaslananka-lab/mcp-ssh-tool`
- Personal showcase mirror: `https://github.com/oaslananka/mcp-ssh-tool`
- npm package: `mcp-ssh-tool`
- MCP server name: `io.github.oaslananka/mcp-ssh-tool`

The org repository owns source, PRs, CI, security scanning, releases, package publication, registry publication, attestations, SBOMs, and Docker validation. The personal repository is a mirror/showcase only.

## Routine Maintainer Commands

```bash
git remote -v
npm ci
npm run check
npm audit --audit-level=moderate
npm pack --dry-run
node scripts/validate-mcp-metadata.mjs
node scripts/validate-chatgpt-app.mjs
node scripts/check-workflow-guards.mjs
bash scripts/run-workflow-lints.sh
```

## PR Verification

Use GitHub as the source of truth:

```bash
gh pr view <PR_NUMBER> --repo oaslananka-lab/mcp-ssh-tool --json number,state,mergeable,isDraft,headRefName,baseRefName,statusCheckRollup
gh run list --repo oaslananka-lab/mcp-ssh-tool --branch <BRANCH_NAME> --limit 30
gh run view <RUN_ID> --repo oaslananka-lab/mcp-ssh-tool --log-failed
```

Do not treat local checks as a substitute for inspecting org GitHub Actions on PR work.

## Security Feature Setup

Enable GitHub Dependency Graph for the org repository when repository settings allow it. The `Dependency Review` job checks the dependency-graph compare endpoint first and skips with an explicit message until GitHub exposes that API for this repository.
