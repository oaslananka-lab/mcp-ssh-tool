# CI/CD Topology

`mcp-ssh-tool` uses a split ownership model so the public source of truth stays under the personal account while automated release controls run from the organization mirror.

## Repository Roles

| Repository | Role | Automation |
|------------|------|------------|
| `https://github.com/oaslananka/mcp-ssh-tool` | Main source repository | Manual-only GitHub workflows. |
| `https://github.com/oaslananka-lab/mcp-ssh-tool` | CI/CD and trusted publish mirror | Automatic GitHub CI/security plus manual trusted npm publish. |
| GitLab mirror | Optional source mirror | Manual-only pipeline from GitLab web UI. |
| Azure DevOps project | Manual validation and release-control backup | Manual-only YAML pipelines. |

The same source code is pushed to both GitHub repositories. The personal repository remains the canonical development home; the org repository is the automated validation and provenance boundary.

## GitHub Workflows

### Organization mirror: `oaslananka-lab`

Automatic jobs run only when `github.repository_owner == "oaslananka-lab"`:

- `.github/workflows/ci.yml`: `npm run check:quality`, Node 22/24 unit coverage, integration fixture, `npm run check:package`, SBOM, package hash.
- `.github/workflows/security.yml`: CodeQL, dependency review, scheduled security scan.
- `.github/workflows/trusted-publish.yml`: manual npm trusted publishing with provenance after Azure validation.

### Personal source: `oaslananka`

The personal repository is intentionally manual-only:

- `.github/workflows/mirror-source.yml`: manually mirrors the current ref to `oaslananka-lab/mcp-ssh-tool` and optionally to GitLab.
- `.github/workflows/publish.yml`: emergency manual npm fallback for the personal repository only.

The shared CI/security workflows still contain push and pull-request events because the same workflow files are mirrored to the org repository. In the personal repository, their jobs are owner-gated and skip unless started manually.

## Required Secrets

GitHub should store only the Doppler bootstrap secrets needed to fetch runtime secrets:

| Location | Secret | Purpose |
|----------|--------|---------|
| Personal GitHub repo | `DOPPLER_TOKEN` | Doppler token with read access to the configured project/config. |
| Personal GitHub repo | `DOPPLER_PROJECT` | Doppler project name, defaulting to `all` when omitted. |
| Personal GitHub repo | `DOPPLER_CONFIG` | Doppler config name, defaulting to `main` when omitted. |
| Org GitHub repo | `DOPPLER_TOKEN` | Optional for future org workflows that need runtime secrets. |
| Org GitHub repo | `DOPPLER_PROJECT` | Optional Doppler project name. |
| Org GitHub repo | `DOPPLER_CONFIG` | Optional Doppler config name. |
| Org GitHub repo | npm trusted publisher | Configure npm trusted publishing for `oaslananka-lab/mcp-ssh-tool`. |
| Org GitHub repo | `npm-production` environment | Required approval boundary for trusted publish. |

Doppler should contain the operational secrets:

| Doppler Secret | Used By | Purpose |
|----------------|---------|---------|
| `ORG_MIRROR_TOKEN` or `DOPPLER_GITHUB_SERVICE_TOKEN` | Personal `Mirror Source` workflow | Fine-scoped token that can push to `oaslananka-lab/mcp-ssh-tool`. |
| `GITLAB_MIRROR_URL` | Personal `Mirror Source` workflow | Optional full authenticated GitLab push URL for manual mirroring. |
| `NPM_TOKEN` | Personal emergency publish workflow | Emergency manual publish fallback only. The org trusted-publish path should remain tokenless/OIDC-based. |

Prefer fine-scoped GitHub tokens over broad PATs. The org mirror token only needs contents write access to `oaslananka-lab/mcp-ssh-tool`.

## Recommended Remotes

```bash
git remote add origin git@github.com:oaslananka/mcp-ssh-tool.git
git remote add org git@github.com:oaslananka-lab/mcp-ssh-tool.git
```

For a release candidate, push source to personal first, then mirror to the org CI/CD repository:

```bash
git push origin main --tags
git push org main --tags
```

The manual `Mirror Source` GitHub workflow can perform the second push when local credentials should not be used.

## Azure DevOps

Azure pipelines are manual-only by design:

- `.azure/pipelines/ci.yml`: manual validation parity with the org GitHub CI.
- `.azure/pipelines/publish.yml`: manual pre-publish validation and artifact handoff.
- `.azure/pipelines/mirror.yml`: manual release record creation.

Azure should not be configured with branch or PR triggers for this project. If Azure is used before publishing, paste the Azure validation run URL into the org `Publish with npm Provenance` workflow.

## GitLab

`.gitlab-ci.yml` is web-trigger only. It is intended for manual portability checks or backup validation, not automatic CI/CD ownership.

## Release Flow

1. Develop and review in `https://github.com/oaslananka/mcp-ssh-tool`.
2. Mirror source to `https://github.com/oaslananka-lab/mcp-ssh-tool`.
3. Let org CI/security checks pass.
4. Optionally run Azure manual validation for an additional release-control record.
5. Publish from the org `Publish with npm Provenance` workflow.
6. Use the personal emergency publish workflow only if the org trusted-publish path is unavailable and the risk is accepted.
