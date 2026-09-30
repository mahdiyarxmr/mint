#!/usr/bin/env bash
# Mint launcher. No npm, no dependencies.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || {
  echo "  Node.js is not installed. Get it from https://nodejs.org (18 or newer)."; exit 1; }
echo "  Starting Mint on http://localhost:${PORT:-3000}"
exec node server.js
