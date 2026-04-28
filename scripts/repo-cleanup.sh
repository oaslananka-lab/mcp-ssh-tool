#!/usr/bin/env bash
set -euo pipefail

APPLY=0
if [[ "${1:-}" == "--apply" ]]; then
  APPLY=1
fi

TARGETS=(
  "artifacts"
  "coverage"
  "dist"
  "test-results"
  ".cache"
  "*.tgz"
  "*.tmp"
  "*.temp"
)

echo "Repository cleanup is running in $([[ "$APPLY" == "1" ]] && echo "apply" || echo "dry-run") mode."

for target in "${TARGETS[@]}"; do
  if [[ "$APPLY" == "1" ]]; then
    rm -rf $target
    echo "Removed: $target"
  else
    echo "Would remove: $target"
  fi
done

if [[ "$APPLY" != "1" ]]; then
  echo "Pass --apply to remove the listed generated files."
fi
