#!/bin/sh
# Preserve normal Codex authentication, but don't inherit personal MCP servers/hooks.
exec "${COFOUNDER_CODEX_BIN:-$HOME/.local/bin/codex}" "$@" --ignore-user-config
