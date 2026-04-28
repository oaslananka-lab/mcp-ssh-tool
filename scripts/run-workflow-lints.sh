#!/usr/bin/env bash
set -u

status=0

if command -v actionlint >/dev/null 2>&1; then
  actionlint
  status=$((status || $?))
else
  echo "actionlint is not installed; skipping local workflow syntax lint."
fi

if command -v zizmor >/dev/null 2>&1; then
  zizmor .github/workflows
  status=$((status || $?))
else
  echo "zizmor is not installed; skipping local workflow security lint."
fi

exit "$status"
