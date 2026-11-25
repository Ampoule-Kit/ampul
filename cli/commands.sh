usage() {
  cat <<EOF
Usage: dev <command> [project]

  new [name]         Set up a new project container (asks for the code, dependencies and ports)
  enter <name>       Open a bash shell in the project's container
  start <name>       Start a stopped project container
  stop <name>        Stop a project container
  rebuild <name>     Rebuild the image and recreate the container (fresh code and dotfiles)
  setup <name>       Copy the dotfiles in again and rerun the setup (Neovim, git and SSH)
  config <name>      Change a project's code source, dependencies or ports
  rm <name>          Remove a project's container, image and settings
  ls                 List projects and their status
  purge [--yes]      Remove every devenv container, image, volume and project setting

Project settings: $PROJECTS_DIR
EOF
}

print_ready_message() {
  local port
  echo
  echo "Project '$PROJECT_NAME' is ready, with its code in ~/Project. Enter it with:"
  echo "  dev enter $PROJECT_NAME"
  for port in $PORTS; do
    echo "  localhost:$port on this machine reaches port $port in the container"
  done
}

create_and_set_up_container() {
  build_image
  remove_container "$PROJECT_NAME"
  create_container
  set_up_container
  fetch_project_code
  print_ready_message
}

command_new() {
  require_engine
  clear_project_settings
  prompt_code_source
  if [ -n "${1:-}" ]; then
    is_valid_project_name "$1" || die "Invalid project name '$1'. Use lowercase letters, digits and dashes."
    project_exists "$1" && die "A project named '$1' already exists. Change it with: dev config $1"
    PROJECT_NAME=$1
  else
    prompt_project_name
  fi
  if [ "$(container_status "$PROJECT_NAME")" != "not created" ]; then
    die "A container named $(container_name "$PROJECT_NAME") already exists without project settings. Remove it with: $RUNTIME rm -f $(container_name "$PROJECT_NAME")"
  fi
  prompt_dependencies
  prompt_ports
  save_project
  create_and_set_up_container
}

command_config() {
  load_project "${1:-}"
  require_engine
  prompt_code_source
  prompt_dependencies
  prompt_ports
  save_project
  echo
  echo "Saved. Apply the changes with:"
  echo "  dev rebuild $PROJECT_NAME"
}

command_rebuild() {
  load_project "${1:-}"
  require_engine
  if [ "$(container_status "$PROJECT_NAME")" != "not created" ]; then
    echo "This recreates $(container_name "$PROJECT_NAME") with fresh code: uncommitted or unpushed work in ~/Project is lost."
    echo "The shared package cache and the inner container engine's images and data are kept."
    confirm "Continue" n || exit 1
  fi
  create_and_set_up_container
}

command_setup() {
  load_project "${1:-}"
  require_engine
  require_running_container "$PROJECT_NAME"
  set_up_container
}

command_enter() {
  load_project "${1:-}"
  require_engine
  require_running_container "$PROJECT_NAME"
  exec_in_container \
    --workdir "$CONTAINER_PROJECT_DIR" \
    --env TERM=xterm-256color \
    --env COLORTERM=truecolor \
    "$(container_name "$PROJECT_NAME")" bash --login
}

command_start() {
  load_project "${1:-}"
  require_engine
  case "$(container_status "$PROJECT_NAME")" in
    running) echo "$(container_name "$PROJECT_NAME") is already running." ;;
    "not created") require_running_container "$PROJECT_NAME" ;;
    *) "$RUNTIME" start "$(container_name "$PROJECT_NAME")" >/dev/null && echo "Started. Enter it with: dev enter $PROJECT_NAME" ;;
  esac
}

command_stop() {
  load_project "${1:-}"
  require_engine
  case "$(container_status "$PROJECT_NAME")" in
    running) "$RUNTIME" stop "$(container_name "$PROJECT_NAME")" >/dev/null && echo "Stopped." ;;
    *) echo "$(container_name "$PROJECT_NAME") is not running." ;;
  esac
}

command_rm() {
  local engine_volume
  load_project "${1:-}"
  require_engine
  engine_volume=$(engine_volume_name "$PROJECT_NAME")
  echo "This removes the container (including the code in ~/Project), image, settings and the images and data of containers run inside it for '$PROJECT_NAME'."
  confirm "Remove '$PROJECT_NAME'" n || exit 1
  remove_container "$PROJECT_NAME"
  "$RUNTIME" rmi --force "$(image_name "$PROJECT_NAME")" >/dev/null 2>&1 || true
  if "$RUNTIME" volume inspect "$engine_volume" >/dev/null 2>&1; then
    "$RUNTIME" volume rm --force "$engine_volume" >/dev/null
  fi
  rm -f "$(project_settings_file "$PROJECT_NAME")"
  echo "Removed '$PROJECT_NAME'."
}

command_ls() {
  local settings_file status engine_running=yes
  detect_runtime
  if [ ! -d "$PROJECTS_DIR" ] || [ -z "$(ls -A "$PROJECTS_DIR" 2>/dev/null)" ]; then
    echo "No projects yet. Create one with: dev new"
    return
  fi
  engine_reachable || engine_running=no
  printf '%-20s %-12s %s\n' PROJECT STATUS CODE
  for settings_file in "$PROJECTS_DIR"/*.env; do
    clear_project_settings
    . "$settings_file"
    status=unknown
    [ "$engine_running" = yes ] && status=$(container_status "$PROJECT_NAME")
    printf '%-20s %-12s %s\n' "$PROJECT_NAME" "$status" "$(code_source_summary)"
  done
  [ "$engine_running" = yes ] || print_engine_start_hint
}

command_purge() {
  require_engine
  if [ "${1:-}" != --yes ]; then
    echo "This removes every devenv container, image and volume (including the shared cache),"
    echo "and all project settings in $PROJECTS_DIR. Folders on this machine are not touched."
    confirm "Remove everything" n || exit 1
  fi
  "$RUNTIME" ps --all --quiet --filter "label=$PROJECT_LABEL" | xargs -r "$RUNTIME" rm --force >/dev/null
  "$RUNTIME" images --quiet --filter "label=$PROJECT_LABEL" | sort -u | xargs -r "$RUNTIME" rmi --force >/dev/null
  "$RUNTIME" images --quiet --filter "label=$CACHE_LABEL" | sort -u | xargs -r "$RUNTIME" rmi --force >/dev/null
  "$RUNTIME" volume ls --quiet --filter "label=$PROJECT_LABEL" | xargs -r "$RUNTIME" volume rm --force >/dev/null
  "$RUNTIME" volume ls --quiet --filter "label=$CACHE_LABEL" | xargs -r "$RUNTIME" volume rm --force >/dev/null
  rm -rf "$PROJECTS_DIR"
  echo "Removed all devenv containers, images, volumes and project settings."
}
