#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
/Users/sophie/.local/bin/hugo server -D --bind 127.0.0.1 --port 1313 --baseURL http://127.0.0.1:1313/
