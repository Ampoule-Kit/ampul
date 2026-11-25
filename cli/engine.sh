detect_runtime() {
  if [ -n "${RUNTIME:-}" ]; then
    command -v "$RUNTIME" >/dev/null || die "devenv.conf sets RUNTIME=$RUNTIME, but $RUNTIME is not installed."
  elif command -v podman >/dev/null; then
    RUNTIME=podman
  elif command -v docker >/dev/null; then
    RUNTIME=docker
  else
    die "Neither podman nor docker is installed."
  fi
}

engine_reachable() {
  "$RUNTIME" info >/dev/null 2>&1
}

print_engine_start_hint() {
  echo "The $RUNTIME engine is not running. Start it with:" >&2
  case "$RUNTIME/$(uname -s)" in
    podman/Darwin) echo "  podman machine start" >&2 ;;
    podman/*) echo "  podman info    (shows what is wrong)" >&2 ;;
    docker/Darwin) echo "  your Docker app or VM (for example Docker Desktop, or: colima start)" >&2 ;;
    docker/*) echo "  sudo systemctl start docker" >&2 ;;
  esac
}

require_engine() {
  detect_runtime
  if ! engine_reachable; then
    print_engine_start_hint
    exit 1
  fi
}

is_rootless_podman() {
  [ "$RUNTIME" = podman ] && [ "$("$RUNTIME" info --format '{{.Host.Security.Rootless}}')" = true ]
}
