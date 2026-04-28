#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INVENTORY_FILE="${1:-"$ROOT_DIR/.doppler/secrets.txt"}"
DOPPLER_PROJECT="${DOPPLER_PROJECT:-all}"
DOPPLER_CONFIG="${DOPPLER_CONFIG:-main}"
ALLOW_OFFLINE="${ALLOW_DOPPLER_OFFLINE:-0}"
LIVE_CHECK="${DOPPLER_LIVE_CHECK:-1}"

if [[ ! -f "$INVENTORY_FILE" ]]; then
  echo "Missing Doppler inventory: $INVENTORY_FILE" >&2
  exit 1
fi

mapfile -t REQUIRED_SECRETS < <(grep -Ev '^\s*(#|$)' "$INVENTORY_FILE")

if [[ "${#REQUIRED_SECRETS[@]}" -eq 0 ]]; then
  echo "Doppler inventory has no required secrets." >&2
  exit 1
fi

if [[ "$ALLOW_OFFLINE" == "1" && "$LIVE_CHECK" != "1" ]]; then
  echo "Doppler live verification disabled; validated inventory only."
  printf '  - %s\n' "${REQUIRED_SECRETS[@]}"
  exit 0
fi

if ! command -v doppler >/dev/null 2>&1; then
  if [[ "$ALLOW_OFFLINE" == "1" ]]; then
    echo "Doppler CLI is not installed; validated inventory only."
    printf '  - %s\n' "${REQUIRED_SECRETS[@]}"
    exit 0
  fi

  echo "Doppler CLI is required for live secret verification." >&2
  exit 1
fi

missing=0
for secret_name in "${REQUIRED_SECRETS[@]}"; do
  if doppler secrets get "$secret_name" \
    --plain \
    --project "$DOPPLER_PROJECT" \
    --config "$DOPPLER_CONFIG" >/dev/null 2>&1; then
    echo "Verified Doppler secret: $secret_name"
  else
    echo "Missing Doppler secret: $secret_name" >&2
    missing=1
  fi
done

exit "$missing"
