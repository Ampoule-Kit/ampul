#!/usr/bin/env bash
set -euo pipefail

DEVENV_DIR=$(cd -P "$(dirname "$0")" && pwd)
BIN_DIR=${DEVENV_BIN_DIR:-$HOME/.local/bin}
SOURCE=$DEVENV_DIR/dev
TARGET=$BIN_DIR/dev
MINIMUM_MACHINE_MEMORY_MIB=4096

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

note() {
  printf 'Note: %s\n' "$*"
}

check_not_root() {
  [ "$(id -u)" -ne 0 ] || die "Run install.sh as your normal user, not root or sudo."
}

make_scripts_executable() {
  chmod +x "$SOURCE" "$DEVENV_DIR/setup.sh" "$DEVENV_DIR/entrypoint.sh" "$DEVENV_DIR/install.sh" "$DEVENV_DIR/uninstall.sh"
  find "$DEVENV_DIR/deps" -name '*.sh' ! -name lib.sh -exec chmod +x {} +
}

link_command() {
  local current
  mkdir -p "$BIN_DIR" || die "Could not create $BIN_DIR."
  if [ -L "$TARGET" ]; then
    current=$(readlink "$TARGET")
    if [ "$current" = "$SOURCE" ]; then
      echo "$TARGET already points to this copy of devenv."
      return
    fi
    if [ ! -e "$TARGET" ]; then
      echo "Replacing a broken link at $TARGET (it pointed to $current)."
      rm "$TARGET"
    else
      die "$TARGET already points to $current. Run uninstall.sh from that copy first, or remove the link yourself."
    fi
  elif [ -e "$TARGET" ]; then
    die "$TARGET already exists and is not a devenv link. Move it away first, or install elsewhere with DEVENV_BIN_DIR=/some/dir ./install.sh"
  fi
  ln -s "$SOURCE" "$TARGET"
  echo "Linked $TARGET -> $SOURCE"
}

check_path() {
  local resolved
  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *)
      note "$BIN_DIR is not on your PATH. Add this line to your shell profile (~/.bash_profile, ~/.bashrc or ~/.zshrc), then open a new terminal:"
      echo "  export PATH=\"$BIN_DIR:\$PATH\""
      return
      ;;
  esac
  resolved=$(type -P dev || true)
  if [ -n "$resolved" ] && [ "$resolved" != "$TARGET" ]; then
    note "Another 'dev' at $resolved comes earlier on your PATH and hides this one. Move $BIN_DIR earlier on your PATH, or remove the other command."
  fi
}

check_container_runtime() {
  local runtime=""
  if command -v podman >/dev/null; then
    runtime=podman
  elif command -v docker >/dev/null; then
    runtime=docker
  else
    note "Neither podman nor docker is installed. Install one of them before running 'dev new'."
    return
  fi

  if [ "$runtime/$(uname -s)" = podman/Darwin ]; then
    check_podman_machine
  elif ! "$runtime" info >/dev/null 2>&1; then
    note "$runtime is installed but its engine is not reachable right now. 'dev' will tell you how to start it."
  fi
}

check_podman_machine() {
  local memory
  if [ -z "$(podman machine list --quiet 2>/dev/null)" ]; then
    note "No Podman machine exists yet. Create one with:"
    echo "  podman machine init --memory $MINIMUM_MACHINE_MEMORY_MIB"
    return
  fi
  memory=$(podman machine inspect --format '{{.Resources.Memory}}' 2>/dev/null | head -1)
  if [ -n "$memory" ] && [ "$memory" -lt "$MINIMUM_MACHINE_MEMORY_MIB" ] 2>/dev/null; then
    note "The Podman machine has ${memory} MiB of memory. Building .NET and Node projects and running containers inside them needs more. Raise it with:"
    echo "  podman machine stop && podman machine set --memory $MINIMUM_MACHINE_MEMORY_MIB && podman machine start"
  fi
}

check_git() {
  command -v git >/dev/null || note "git is not installed on this machine, so containers get no git config from it."
}

check_not_root
make_scripts_executable
link_command
check_path
check_container_runtime
check_git
echo
echo "devenv is installed. Create your first project with: dev new"
