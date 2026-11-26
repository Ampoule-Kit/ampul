RUNTIME=${DEVENV_RUNTIME:-}

detect_runtime() {
  if [ -n "$RUNTIME" ]; then
    command -v "$RUNTIME" >/dev/null || die "DEVENV_RUNTIME is $RUNTIME, but $RUNTIME is not installed."
  elif command -v podman >/dev/null; then
    RUNTIME=podman
  elif command -v docker >/dev/null; then
    RUNTIME=docker
  else
    die "Neither podman nor docker is installed."
  fi
}

require_engine() {
  detect_runtime
  "$RUNTIME" info >/dev/null 2>&1 || die "The $RUNTIME engine is not running. Run 'dev doctor' to see how to start it."
}

ask() {
  local answer
  read -r -p "$1 [$2]: " answer
  echo "${answer:-$2}"
}
