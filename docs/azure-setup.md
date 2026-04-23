# Azure DevOps Setup Guide

Azure DevOps is a manual validation and release-control backup for `mcp-ssh-tool`. Automatic CI/CD ownership lives in the GitHub organization mirror at `https://github.com/oaslananka-lab/mcp-ssh-tool`.

## Pipeline Policy

- Do not enable branch triggers.
- Do not enable pull-request triggers.
- Use Azure manually for extra validation, artifact generation, and release approval evidence.
- Use the org GitHub `Publish with npm Provenance` workflow for npm trusted publishing after Azure validation when needed.

## Pipelines

Create these pipelines from existing YAML:

| Pipeline | YAML | Trigger |
|----------|------|---------|
| Manual CI validation | `.azure/pipelines/ci.yml` | Manual |
| Manual publish validation | `.azure/pipelines/publish.yml` | Manual |
| Manual release record | `.azure/pipelines/mirror.yml` | Manual |

## Environment

Create an Azure environment named `npm-production` for `.azure/pipelines/publish.yml`.

Recommended controls:

- Require approval from the release owner.
- Restrict who can manually run the publish validation pipeline.
- Retain validation artifacts for release review.

## Service Connections

Only create service connections that are required for the manual pipeline you are using.

### GitHub Release Connection

Used by `.azure/pipelines/mirror.yml` when manually creating release records.

1. Open Project Settings -> Service connections -> New service connection.
2. Choose GitHub.
3. Use a fine-scoped token with repository access only for the intended repository.
4. Name the connection `GitHub` to match the pipeline YAML.

## Release Handoff

1. Run `.azure/pipelines/publish.yml` manually.
2. Confirm lint, tests, build, version sync, package contents, SBOM, and package hash complete successfully.
3. Copy the Azure run URL.
4. Start the org GitHub workflow `Publish with npm Provenance`.
5. Paste the Azure run URL and type `PUBLISH`.

The org GitHub trusted-publish workflow is intentionally owner-gated and will only publish from `oaslananka-lab`.
