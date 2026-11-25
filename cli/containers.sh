container_status() {
  "$RUNTIME" container inspect --format '{{.State.Status}}' "$(container_name "$1")" 2>/dev/null || echo "not created"
}

require_running_container() {
  local status
  status=$(container_status "$1")
  case "$status" in
    running) return 0 ;;
    "not created")
      echo "The container for '$1' does not exist. Create it with:" >&2
      echo "  dev rebuild $1" >&2
      ;;
    *)
      echo "The container for '$1' is $status. Start it with:" >&2
      echo "  dev start $1" >&2
      ;;
  esac
  exit 1
}

create_volume_if_missing() {
  local volume=$1 label=$2
  "$RUNTIME" volume inspect "$volume" >/dev/null 2>&1 || "$RUNTIME" volume create --label "$label" "$volume" >/dev/null
}

build_image() {
  [ "$(id -u)" -ne 0 ] || die "Run dev as your normal user, not root."
  echo "==> Building image $(image_name "$PROJECT_NAME")"
  "$RUNTIME" build \
    --file "$DEVENV_DIR/image/Containerfile" \
    --tag "$(image_name "$PROJECT_NAME")" \
    --label "$PROJECT_LABEL=$PROJECT_NAME" \
    --build-arg UBUNTU_IMAGE="$UBUNTU_IMAGE" \
    --build-arg WITH_DOTNET="$DOTNET_SDKS" \
    --build-arg WITH_JAVA="$JAVA" \
    --build-arg WITH_GODOT="$GODOT" \
    --build-arg WITH_PYTHON="$PYTHON" \
    --build-arg WITH_CONTAINER_ENGINE="$CONTAINER_ENGINE" \
    --build-arg USER_NAME="$CONTAINER_USER" \
    --build-arg USER_UID="$(id -u)" \
    --build-arg USER_GID="$(id -g)" \
    "$DEVENV_DIR"
}

host_config_mounts() {
  local xdg_git_config=${XDG_CONFIG_HOME:-$HOME/.config}/git/config excludes_file
  [ -f "$HOME/.gitconfig" ] && echo "$HOME/.gitconfig:$CONTAINER_HOME/.host/gitconfig:ro"
  [ -f "$xdg_git_config" ] && echo "$xdg_git_config:$CONTAINER_HOME/.host/gitconfig-xdg:ro"
  [ -f "$HOME/.git-credentials" ] && echo "$HOME/.git-credentials:$CONTAINER_HOME/.git-credentials"
  excludes_file=$(git config --global --path --get core.excludesfile 2>/dev/null || true)
  [ -n "$excludes_file" ] && [ -f "$excludes_file" ] && echo "$excludes_file:$CONTAINER_HOME/.host/gitignore_global:ro"
  [ -d "$HOME/.ssh" ] && echo "$HOME/.ssh:$CONTAINER_HOME/.host/ssh:ro"
  return 0
}

create_container() {
  local mount port index=0 forwards=""
  local args=(
    run --detach --init
    --name "$(container_name "$PROJECT_NAME")"
    --hostname "$PROJECT_NAME"
    --label "$PROJECT_LABEL=$PROJECT_NAME"
    --security-opt label=disable
    --volume "$CACHE_VOLUME:$CONTAINER_HOME/.cache"
  )

  create_volume_if_missing "$CACHE_VOLUME" "$CACHE_LABEL=true"
  if is_rootless_podman; then
    args+=(--userns=keep-id)
  fi

  while read -r mount; do
    args+=(--volume "$mount")
  done < <(host_config_mounts)

  if [ -n "$CONTAINER_ENGINE" ]; then
    create_volume_if_missing "$(engine_volume_name "$PROJECT_NAME")" "$PROJECT_LABEL=$PROJECT_NAME"
    args+=(
      --privileged
      --volume "$(engine_volume_name "$PROJECT_NAME"):/var/lib/containers"
      --env "DOCKER_HOST=unix://$ENGINE_SOCKET"
      --env "CONTAINER_HOST=unix://$ENGINE_SOCKET"
      --env "TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=$ENGINE_SOCKET"
    )
  fi

  for port in $PORTS; do
    args+=(--publish "127.0.0.1:$port:$((FORWARDED_PORTS_START + index))")
    forwards="$forwards $port:$((FORWARDED_PORTS_START + index))"
    index=$((index + 1))
  done
  args+=(--env "DEVENV_PORT_FORWARDS=${forwards# }")

  echo "==> Creating container $(container_name "$PROJECT_NAME")"
  "$RUNTIME" "${args[@]}" "$(image_name "$PROJECT_NAME")" >/dev/null
}

remove_container() {
  "$RUNTIME" rm --force "$(container_name "$1")" >/dev/null 2>&1 || true
}

exec_in_container() {
  local flags=(--interactive)
  [ -t 0 ] && [ -t 1 ] && flags+=(--tty)
  "$RUNTIME" exec "${flags[@]}" --user "$CONTAINER_USER" "$@"
}

host_tar() {
  if [ "$(uname -s)" = Darwin ]; then
    COPYFILE_DISABLE=1 tar --no-mac-metadata --no-xattrs "$@"
  else
    tar "$@"
  fi
}

replace_container_folder_with_archive() {
  "$RUNTIME" exec --interactive --user "$CONTAINER_USER" "$(container_name "$PROJECT_NAME")" \
    bash -c 'rm -rf "$1" && mkdir -p "$1" && tar --warning=no-unknown-keyword -xf - -C "$1"' _ "$1"
}

copy_dotfiles_into_container() {
  (cd "$DEVENV_DIR/dotfiles" && host_tar -cf - .) | replace_container_folder_with_archive "$CONTAINER_HOME/dotfiles"
}

set_up_container() {
  echo "==> Copying dotfiles into the container"
  copy_dotfiles_into_container || echo "WARNING: The dotfiles could not be copied into the container." >&2
  "$RUNTIME" exec --interactive --user "$CONTAINER_USER" "$(container_name "$PROJECT_NAME")" \
    bash -s -- "$HOME" <"$DEVENV_DIR/container/setup.sh"
}
