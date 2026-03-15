#!/usr/bin/env bash
# Run the Publish Rust SDK workflow locally with act (https://github.com/nektos/act).
# Requires: act installed, and .github/scripts/secrets.json with CARGO_REGISTRY_TOKEN.
#
# Usage:
#   ./act-publish-rust-sdk.sh              # simulate workflow_dispatch (manual trigger)
#   ./act-publish-rust-sdk.sh release       # simulate release published

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SECRETS_FILE="$SCRIPT_DIR/secrets.json"
WORKFLOW=".github/workflows/publish-rust-sdk.yml"

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "Missing $SECRETS_FILE (see secrets.json.example or add CARGO_REGISTRY_TOKEN)." >&2
  exit 1
fi

cd "$REPO_ROOT"

EVENT="${1:-workflow_dispatch}"
if [[ "$EVENT" == "release" ]]; then
  act release \
    -W "$WORKFLOW" \
    --secret-file "$SECRETS_FILE" \
    -e "$SCRIPT_DIR/release-event.json"
else
  act workflow_dispatch \
    -W "$WORKFLOW" \
    --secret-file "$SECRETS_FILE"
fi
