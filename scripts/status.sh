#!/bin/sh
# usage: status.sh <bot> <state> "<line>"
[ -n "$OFFICE_URL" ] && [ -n "$OFFICE_WRITE_TOKEN" ] || exit 1
esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
body=$(printf '{"bot":"%s","state":"%s","line":"%s","ts":"%s"}' "$(esc "$1")" "$(esc "$2")" "$(esc "$3")" "$(date -u +%Y-%m-%dT%H:%M:%SZ)")
printf 'Authorization: Bearer %s\n' "$OFFICE_WRITE_TOKEN" |
  curl -fsS -o /dev/null -H @- -H 'Content-Type: application/json' --data-binary "$body" "$OFFICE_URL/api/status" 2>/dev/null
