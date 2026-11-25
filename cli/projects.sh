container_name() {
  echo "devenv-$1"
}

image_name() {
  echo "devenv-$1"
}

engine_volume_name() {
  echo "devenv-$1-engine"
}

project_settings_file() {
  echo "$PROJECTS_DIR/$1.env"
}

project_exists() {
  [ -f "$(project_settings_file "$1")" ]
}

is_valid_project_name() {
  [[ "$1" =~ ^[a-z0-9][a-z0-9-]*$ ]]
}

to_project_name() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -e 's/[^a-z0-9-]/-/g' -e 's/--*/-/g' -e 's/^-//' -e 's/-$//'
}

require_project_name() {
  [ -n "${1:-}" ] || die "Missing project name. See: dev ls"
}

clear_project_settings() {
  PROJECT_NAME=
  CODE_SOURCE=
  REPOSITORIES=
  COPY_FOLDER=
  COPY_GIT_FILES_ONLY=
  DOTNET_SDKS=
  JAVA=
  GODOT=
  PYTHON=
  CONTAINER_ENGINE=
  PORTS=
}

load_project() {
  require_project_name "$1"
  project_exists "$1" || die "No project named '$1'. See: dev ls"
  clear_project_settings
  . "$(project_settings_file "$1")"
}

save_project() {
  mkdir -p "$PROJECTS_DIR"
  {
    printf 'PROJECT_NAME=%q\n' "$PROJECT_NAME"
    printf 'CODE_SOURCE=%q\n' "$CODE_SOURCE"
    printf 'REPOSITORIES=%q\n' "$REPOSITORIES"
    printf 'COPY_FOLDER=%q\n' "$COPY_FOLDER"
    printf 'COPY_GIT_FILES_ONLY=%q\n' "$COPY_GIT_FILES_ONLY"
    printf 'DOTNET_SDKS=%q\n' "$DOTNET_SDKS"
    printf 'JAVA=%q\n' "$JAVA"
    printf 'GODOT=%q\n' "$GODOT"
    printf 'PYTHON=%q\n' "$PYTHON"
    printf 'CONTAINER_ENGINE=%q\n' "$CONTAINER_ENGINE"
    printf 'PORTS=%q\n' "$PORTS"
  } >"$(project_settings_file "$PROJECT_NAME")"
}

repository_folder_name() {
  local name=${1%/}
  name=${name##*/}
  name=${name##*:}
  echo "${name%.git}"
}

code_source_summary() {
  local repository names=""
  case "$CODE_SOURCE" in
    repositories)
      for repository in $REPOSITORIES; do
        names="$names $(repository_folder_name "$repository")"
      done
      echo "repositories:$names"
      ;;
    copy) echo "copy of $COPY_FOLDER" ;;
  esac
}
