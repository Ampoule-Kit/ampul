#!/usr/bin/env bash
set -euo pipefail

DEVENV_DIR=$(cd -P "$(dirname "$0")" && pwd)
BIN_DIR=${DEVENV_BIN_DIR:-$HOME/.local/bin}
SOURCE=$DEVENV_DIR/dev
TARGET=$BIN_DIR/dev
PROJECTS_DIR=${XDG_CONFIG_HOME:-$HOME/.config}/devenv/projects

confirm() {
  local answer
  read -r -p "$1 [y/N]: " answer
  case "$(echo "$answer" | tr '[:upper:]' '[:lower:]')" in
    y | yes) return 0 ;;
    *) return 1 ;;
  esac
}

offer_purge() {
  echo "Containers, images and volumes made by devenv stay until you remove them."
  if confirm "Remove every devenv container, image, volume and project setting now? Project folders are not touched."; then
    if ! "$SOURCE" purge --yes; then
      echo "Purge did not finish (see above). The 'dev' command is kept so you can rerun this once it works."
      exit 1
    fi
  fi
}

remove_link() {
  if [ -L "$TARGET" ]; then
    if [ "$(readlink "$TARGET")" != "$SOURCE" ]; then
      echo "$TARGET points to $(readlink "$TARGET"), not to this copy of devenv, so it was left alone."
      return
    fi
    rm "$TARGET"
    echo "Removed $TARGET"
  elif [ -e "$TARGET" ]; then
    echo "$TARGET is not a devenv link, so it was left alone."
  else
    echo "devenv was not installed at $TARGET."
  fi
}

remove_empty_settings_dirs() {
  rmdir "$PROJECTS_DIR" "$(dirname "$PROJECTS_DIR")" 2>/dev/null || true
}

offer_purge
remove_link
remove_empty_settings_dirs
echo
echo "devenv is uninstalled. This folder ($DEVENV_DIR) was not deleted; remove it yourself if you no longer want it."
