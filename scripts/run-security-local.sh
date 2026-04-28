#!/usr/bin/env bash
set -u

status=0
missing=()

run_optional() {
  local tool="$1"
  shift
  local executable="$tool"

  if command -v "$tool" >/dev/null 2>&1; then
    executable="$(command -v "$tool")"
  elif command -v "$tool.exe" >/dev/null 2>&1; then
    executable="$(command -v "$tool.exe")"
  fi

  if [[ "$executable" != "$tool" || -x "$executable" ]]; then
    echo "Running $tool..."
    "$executable" "${@:2}"
    local command_status=$?
    if [[ "$command_status" -ne 0 ]]; then
      status="$command_status"
    fi
  else
    missing+=("$tool")
  fi
}

run_optional actionlint actionlint
run_optional zizmor zizmor .github/workflows
run_optional gitleaks gitleaks detect --source . --no-git
run_optional trivy trivy fs --exit-code 1 --severity HIGH,CRITICAL .
run_optional hadolint hadolint Dockerfile Dockerfile.test
run_optional osv-scanner osv-scanner scan --recursive .

if { command -v doppler >/dev/null 2>&1 || command -v doppler.exe >/dev/null 2>&1; } &&
  { command -v safety >/dev/null 2>&1 || command -v safety.exe >/dev/null 2>&1; }; then
  echo "Running safety through Doppler..."
  if ! DOPPLER_PROJECT="${DOPPLER_PROJECT:-all}" DOPPLER_CONFIG="${DOPPLER_CONFIG:-main}" doppler run -- safety scan; then
    echo "Safety scan could not run with local Doppler config; strict Safety token validation runs in CI."
  fi
else
  if ! command -v safety >/dev/null 2>&1 && ! command -v safety.exe >/dev/null 2>&1; then
    missing+=("safety")
  fi
  if ! command -v doppler >/dev/null 2>&1 && ! command -v doppler.exe >/dev/null 2>&1; then
    missing+=("doppler")
  fi
fi

if [[ "${#missing[@]}" -gt 0 ]]; then
  echo "Missing optional local security tools: ${missing[*]}"
fi

exit "$status"
