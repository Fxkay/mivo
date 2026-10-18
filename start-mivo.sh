#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
 echo "Please install Node.js 20 or newer: https://nodejs.org"
 exit 1
fi
echo "Mivo starting at http://localhost:3000"
node server.mjs
