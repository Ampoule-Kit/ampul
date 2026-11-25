ask() {
  local answer
  read -r -p "$1 [$2]: " answer
  echo "${answer:-$2}"
}

confirm() {
  local default=$2 answer hint
  if [ "$default" = y ]; then hint="Y/n"; else hint="y/N"; fi
  while true; do
    read -r -p "$1 [$hint]: " answer
    case "$(echo "${answer:-$default}" | tr '[:upper:]' '[:lower:]')" in
      y | yes) return 0 ;;
      n | no) return 1 ;;
    esac
    echo "Answer y or n."
  done
}

yes_if_set() {
  if [ -n "$1" ]; then echo y; else echo n; fi
}

list_contains() {
  case " $1 " in *" $2 "*) return 0 ;; *) return 1 ;; esac
}

resolve_folder() {
  local folder=$1
  case "$folder" in "~") folder=$HOME ;; "~/"*) folder=$HOME/${folder#"~/"} ;; esac
  [ -d "$folder" ] || return 1
  (cd "$folder" && pwd -P)
}

is_git_repository_root() {
  [ -d "$1/.git" ] && [ "$(git -C "$1" rev-parse --show-toplevel 2>/dev/null)" = "$1" ]
}

validate_ports() {
  local port seen=" " count=0
  for port in $1; do
    [[ "$port" =~ ^[0-9]+$ ]] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || {
      echo "'$port' is not a port number (1-65535)." >&2
      return 1
    }
    if list_contains "$seen" "$port"; then
      echo "Port $port is listed twice." >&2
      return 1
    fi
    seen="$seen$port "
    count=$((count + 1))
  done
  [ $((FORWARDED_PORTS_START + count - 1)) -le 65535 ] || {
    echo "Too many ports." >&2
    return 1
  }
}

prompt_code_source() {
  local choice default=1
  [ "$CODE_SOURCE" = copy ] && default=2
  echo "Where does the code in ~/Project come from? It is fetched fresh on every new and rebuild."
  echo "  1) Clone one or more git repositories, side by side"
  echo "  2) Copy a folder from this machine (a copy, not linked)"
  while true; do
    choice=$(ask "Choose 1 or 2" "$default")
    case "$choice" in
      1) CODE_SOURCE=repositories && prompt_repositories && return ;;
      2) CODE_SOURCE=copy && prompt_copy_folder && return ;;
    esac
    echo "Answer 1 or 2."
  done
}

prompt_repositories() {
  local url folder_name folder_names="" previous=$REPOSITORIES
  REPOSITORIES=
  COPY_FOLDER=
  COPY_GIT_FILES_ONLY=
  if [ -n "$previous" ]; then
    echo "Current repositories: $previous"
    if confirm "Keep them" y; then
      REPOSITORIES=$previous
      return
    fi
  fi
  echo "Enter repository URLs (HTTPS or SSH), one per line. Leave empty to finish."
  while true; do
    read -r -p "  Repository URL: " url
    if [ -z "$url" ]; then
      [ -n "$REPOSITORIES" ] && return
      echo "  Enter at least one repository."
      continue
    fi
    folder_name=$(repository_folder_name "$url")
    if [[ "$url" =~ [[:space:]] ]] || [ -z "$folder_name" ]; then
      echo "  '$url' does not look like a repository URL."
    elif list_contains "$folder_names" "$folder_name"; then
      echo "  Another repository already uses ~/Project/$folder_name."
    else
      REPOSITORIES="${REPOSITORIES:+$REPOSITORIES }$url"
      folder_names="$folder_names $folder_name"
    fi
  done
}

prompt_copy_folder() {
  local answer folder
  REPOSITORIES=
  while true; do
    answer=$(ask "Folder to copy" "${COPY_FOLDER:-$PWD}")
    folder=$(resolve_folder "$answer") && break
    echo "'$answer' is not a folder."
  done
  COPY_FOLDER=$folder
  COPY_GIT_FILES_ONLY=
  if is_git_repository_root "$COPY_FOLDER"; then
    echo "$COPY_FOLDER is a git repository."
    if confirm "Copy only .git and the files git tracks or doesn't ignore (leaves out node_modules, bin, obj, .env and anything else ignored)" y; then
      COPY_GIT_FILES_ONLY=yes
    fi
  fi
}

suggested_project_name() {
  local first_repository
  case "$CODE_SOURCE" in
    repositories)
      for first_repository in $REPOSITORIES; do break; done
      repository_folder_name "$first_repository"
      ;;
    copy) basename "$COPY_FOLDER" ;;
  esac
}

prompt_project_name() {
  local answer
  while true; do
    answer=$(ask "Project name" "$(to_project_name "$(suggested_project_name)")")
    if ! is_valid_project_name "$answer"; then
      echo "Use lowercase letters, digits and dashes, starting with a letter or digit."
    elif project_exists "$answer"; then
      echo "A project named '$answer' already exists. Pick another name, or change it with: dev config $answer"
    else
      PROJECT_NAME=$answer
      return
    fi
  done
}

prompt_dotnet_sdks() {
  local channel version_variable selected=""
  for channel in $DOTNET_CHANNELS; do
    version_variable="DOTNET_${channel}_VERSION"
    if confirm "  .NET SDK $channel (${!version_variable})" "$(list_contains "$DOTNET_SDKS" "$channel" && echo y || echo n)"; then
      selected="$selected $channel"
    fi
  done
  DOTNET_SDKS=${selected# }
}

label_with_pinned_version() {
  local version_variable="${1}_VERSION"
  if [ -n "${!version_variable:-}" ]; then
    echo "$2 ${!version_variable}"
  else
    echo "$2"
  fi
}

prompt_yes_no_dependency() {
  local setting=$1 label=$2
  if confirm "  $label" "$(yes_if_set "${!setting}")"; then
    printf -v "$setting" '%s' yes
  else
    printf -v "$setting" '%s' ""
  fi
}

prompt_choice_dependency() {
  local setting=$1 choices=$2 label=$3 options answer
  options="none $(echo "$choices" | tr ',' ' ')"
  while true; do
    answer=$(ask "  $label: ${options// /, }" "${!setting:-none}")
    if [ "$answer" = none ]; then
      printf -v "$setting" '%s' ""
      return
    fi
    if list_contains "$options" "$answer"; then
      printf -v "$setting" '%s' "$answer"
      return
    fi
    echo "  Answer one of: $options."
  done
}

prompt_optional_dependencies() {
  local setting choices label
  while IFS='|' read -r -u 3 setting choices label; do
    label=$(label_with_pinned_version "$setting" "$label")
    if [ "$choices" = yes-no ]; then
      prompt_yes_no_dependency "$setting" "$label"
    else
      prompt_choice_dependency "$setting" "$choices" "$label"
    fi
  done 3< <(optional_dependencies)
}

prompt_dependencies() {
  echo
  echo "Dependencies (Neovim, Node, git, Claude Code and the CLI tools are always included):"
  prompt_dotnet_sdks
  prompt_optional_dependencies
  if [ "${GODOT:-}" = dotnet ] && [ -z "$DOTNET_SDKS" ]; then
    echo "  Note: Godot .NET needs a .NET SDK to build C# scripts, and none is selected."
  fi
}

prompt_ports() {
  local answer port
  echo
  echo "Ports your apps listen on that this machine should reach at localhost (for example 4200 5000)."
  while true; do
    answer=$(ask "Ports, space-separated" "${PORTS:-none}")
    [ "$answer" = none ] && answer=
    validate_ports "$answer" && break
  done
  PORTS=
  for port in $answer; do
    PORTS="${PORTS:+$PORTS }$port"
  done
}
