#!/bin/sh
# Launcher for the Flatpak. zypak replaces Electron's setuid sandbox.
set -eu
export CHROME_WRAPPER=/app/bin/fantasywriter
export ZYPAK_SPAWN_LATEST_ON_REEXEC=1
if [ -n "${XDG_RUNTIME_DIR:-}" ]; then
  mkdir -p "${XDG_RUNTIME_DIR}/app/${FLATPAK_ID}"
  export TMPDIR="${XDG_RUNTIME_DIR}/app/${FLATPAK_ID}"
fi
exec zypak-wrapper /app/fantasywriter/fantasywriter --ozone-platform-hint=auto "$@"
