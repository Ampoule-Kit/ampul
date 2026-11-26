#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=$(cd -P "$(dirname "$0")/.." && pwd)
MODULES_DIR=$REPO_DIR/modules
CATALOG_FILE=$MODULES_DIR/catalog.json

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

. "$REPO_DIR/repo-tools/shell-helpers.sh"
. "$REPO_DIR/repo-tools/pinning.sh"
. "$REPO_DIR/repo-tools/install-test.sh"

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT
STAGED_MODULE=$WORK_DIR/module.json
STAGED_CATALOG=$WORK_DIR/catalog.json
PINNING_FILE=$WORK_DIR/pinning.json

ask_required() {
  local answer
  while true; do
    read -r -p "$1: " answer
    [ -n "$answer" ] && break
    echo "  An answer is required." >&2
  done
  echo "$answer"
}

as_json_array() {
  if [ $# -eq 0 ]; then
    echo '[]'
  else
    printf '%s\n' "$@" | jq -R . | jq -s .
  fi
}

prompt_module_id() {
  while true; do
    MODULE_ID=$(ask_required "Module name, in lowercase (for example rust)")
    if [[ ! "$MODULE_ID" =~ ^[a-z][a-z0-9-]*$ ]]; then
      echo "  Use lowercase letters, digits and dashes, starting with a letter."
    elif [ -e "$MODULES_DIR/$MODULE_ID" ]; then
      echo "  modules/$MODULE_ID already exists."
    else
      break
    fi
  done
}

prompt_texts() {
  LABEL=$(ask_required "Label shown by dev new (for example Rust toolchain)")
  DESCRIPTION=$(ask_required "One sentence dev new shows to explain it (for example The Rust compiler, cargo and rustup)")
}

prompt_section() {
  local sections answer
  sections=$(jq -r '.sections[].title' "$CATALOG_FILE")
  echo "Which section of the list does it belong in?"
  echo "$sections" | awk '{ printf "  %d) %s\n", NR, $0 }'
  answer=$(ask_required "Choose a number, or type the name of a new section")
  if [[ "$answer" =~ ^[0-9]+$ ]] && [ "$answer" -ge 1 ] && [ "$answer" -le "$(echo "$sections" | wc -l)" ]; then
    SECTION=$(echo "$sections" | sed -n "${answer}p")
  else
    SECTION=$answer
  fi
}

prompt_selected_by_default() {
  case "$(ask "Select it for new projects by default? (y/n)" n)" in
    y | Y | yes) SELECTED_BY_DEFAULT=true ;;
    *) SELECTED_BY_DEFAULT=false ;;
  esac
}

prompt_requirements() {
  local id unknown
  while true; do
    read -r -p "Modules it needs, space-separated (enter for none): " REQUIRES
    unknown=
    for id in $REQUIRES; do
      [ -f "$(module_file "$id")" ] || unknown="$unknown $id"
    done
    [ -z "$unknown" ] && break
    echo "  No such modules:$unknown. They are the folder names in modules/."
  done
}

prompt_install_method() {
  echo "How is it installed?"
  echo "  1) Ubuntu packages (apt)"
  echo "  2) A release download (an archive or a single executable), pinned by version and checksum"
  while true; do
    case "$(ask "Choose 1 or 2" 2)" in
      1) INSTALL_METHOD=packages && return ;;
      2) INSTALL_METHOD=download && return ;;
    esac
    echo "  Answer 1 or 2."
  done
}

missing_ubuntu_packages() {
  "$RUNTIME" run --rm "$INSTALL_TEST_IMAGE" bash -c '
    apt-get update -qq >/dev/null
    for package in "$@"; do
      apt-cache show --no-all-versions "$package" >/dev/null 2>&1 || echo "$package"
    done' _ "$@"
}

prompt_packages() {
  local package invalid missing
  while true; do
    PACKAGES=$(ask_required "Ubuntu packages, space-separated")
    invalid=
    for package in $PACKAGES; do
      [[ "$package" =~ ^[a-z0-9][a-z0-9+.-]+$ ]] || invalid="$invalid $package"
    done
    if [ -n "$invalid" ]; then
      echo "  Not valid package names:$invalid"
      continue
    fi
    echo "==> Checking the packages exist in $(base_image | sed -E 's/@.*//')"
    missing=$(missing_ubuntu_packages $PACKAGES)
    [ -z "$missing" ] && break
    echo "  Not found in Ubuntu: $(echo "$missing" | tr '\n' ' ')"
  done
}

url_template_problem() {
  case "$1" in
    https://*) ;;
    *) echo "The URL must start with https://." && return ;;
  esac
  [[ "$1" == *"{arch}"* ]] || { echo "The URL must contain {arch}."; return; }
  [[ "$1" =~ [[:space:]\"\`\$\\] ]] && { echo "The URL can't contain spaces, quotes, backticks, \$ or backslashes."; return; }
  return 0
}

prompt_download() {
  local problem
  while true; do
    VERSION=$(ask_required "Version to pin (for example 1.2.3)")
    is_valid_version "$VERSION" && break
    echo "  '$VERSION' is not a valid version."
  done
  echo "Download URL, with {version} and {arch} where they go, for example:"
  echo "  https://github.com/owner/tool/releases/download/v{version}/tool-{version}-linux-{arch}.tar.gz"
  echo "  {version:major}, {version:url} and {version:underscored} are there for versions such as 25.0.5+2."
  while true; do
    URL_TEMPLATE=$(ask_required "Download URL")
    problem=$(url_template_problem "$URL_TEMPLATE")
    [ -z "$problem" ] && break
    echo "  $problem"
  done
  while true; do
    ARM64_NAME=$(ask "What {arch} is for 64-bit ARM" aarch64)
    AMD64_NAME=$(ask "What {arch} is for 64-bit Intel/AMD" x86_64)
    [[ "$ARM64_NAME$AMD64_NAME" =~ ^[A-Za-z0-9_.-]+$ ]] && break
    echo "  Use letters, digits, dots, dashes and underscores."
  done
}

pin_staged_download() {
  jq -n --arg version "$VERSION" --arg url "$URL_TEMPLATE" --arg arm64 "$ARM64_NAME" \
    --arg amd64 "$AMD64_NAME" --arg installTo "/opt/$MODULE_ID" '{
      version: $version,
      downloads: [{ url: $url, architectures: { arm64: $arm64, amd64: $amd64 }, installTo: $installTo }]
    }' >"$PINNING_FILE"
  echo "==> Downloading $MODULE_ID $VERSION for $ARCHITECTURES"
  pin_download "$PINNING_FILE" 0 "$WORK_DIR/downloads" ||
    die "$MODULE_ID could not be downloaded and pinned. Nothing was changed."
}

downloaded_file() {
  awk -v architecture="$1" '$1 == architecture { print $2 }' "$WORK_DIR/downloads/0.files"
}

archive_entries() {
  case "$1" in
    *.zip) unzip -Z "$1" | awk '$1 ~ /^[-dl]/ { print $1 "\t" $NF }' ;;
    *) tar -tvf "$1" | awk '{ print $1 "\t" $NF }' ;;
  esac | awk -F'\t' '{
    path = $2
    sub(/^\.\//, "", path)
    sub(/\/$/, "", path)
    if (path != "" && path != ".") print $1 "\t" path
  }'
}

entries_as_installed() {
  local entries top_level_names
  entries=$(archive_entries "$1")
  top_level_names=$(echo "$entries" | cut -f2 | cut -d/ -f1 | sort -u)
  if [ "$(echo "$top_level_names" | wc -l | tr -d ' ')" = 1 ] && echo "$entries" | cut -f2 | grep -q /; then
    echo "$entries" | awk -F'\t' -v top="$top_level_names" '{
      path = $2
      if (path == top) next
      if (substr(path, 1, length(top) + 1) == top "/") path = substr(path, length(top) + 2)
      print $1 "\t" path
    }'
  else
    echo "$entries"
  fi
}

executable_paths() {
  echo "$1" | awk -F'\t' '$1 ~ /^-..x/ { print $2 }'
}

prompt_archive_commands() {
  local arm64_entries amd64_entries candidates path missing
  arm64_entries=$(entries_as_installed "$(downloaded_file arm64)")
  amd64_entries=$(entries_as_installed "$(downloaded_file amd64)")
  candidates=$(executable_paths "$arm64_entries")
  if [ -n "$candidates" ]; then
    echo "Executables in the archive:"
    echo "$candidates" | head -20 | sed 's/^/  /'
  fi
  while true; do
    COMMANDS=$(ask "Executables to put on the PATH, space-separated" "$(echo "$candidates" | head -1)")
    missing=
    for path in $COMMANDS; do
      echo "$arm64_entries" | cut -f2 | grep -qxF "$path" || missing="$missing $path (arm64)"
      echo "$amd64_entries" | cut -f2 | grep -qxF "$path" || missing="$missing $path (amd64)"
    done
    [ -n "$COMMANDS" ] && [ -z "$missing" ] && break
    echo "  Not in the archive:${missing:- nothing chosen}"
  done
  FILE_NAME=
}

prompt_single_executable() {
  while true; do
    FILE_NAME=$(ask "Command name to install it as" "$MODULE_ID")
    [[ "$FILE_NAME" =~ ^[A-Za-z0-9_.-]+$ ]] && break
    echo "  Use letters, digits, dots, dashes and underscores."
  done
  COMMANDS=$FILE_NAME
}

prompt_check_command() {
  local first_command suggestion=""
  for first_command in ${COMMANDS:-}; do
    suggestion="${first_command##*/} --version"
    break
  done
  if [ -n "$suggestion" ]; then
    CHECK_COMMAND=$(ask "Command that proves it works after installing" "$suggestion")
  else
    CHECK_COMMAND=$(ask_required "Command that proves it works after installing (for example rustc --version)")
  fi
}

staged_downloads() {
  if [ "$INSTALL_METHOD" != download ]; then
    echo '[]'
    return
  fi
  jq --arg fileName "$FILE_NAME" --argjson commands "$(as_json_array $COMMANDS)" '
    .downloads | map(. + (if $fileName != "" then { fileName: $fileName } else {} end) + { commands: $commands })
  ' "$PINNING_FILE"
}

stage_module() {
  jq -n \
    --arg label "$LABEL" \
    --arg description "$DESCRIPTION" \
    --arg version "${VERSION:-}" \
    --argjson selectedByDefault "$SELECTED_BY_DEFAULT" \
    --argjson requires "$(as_json_array $REQUIRES)" \
    --argjson packages "$(as_json_array ${PACKAGES:-})" \
    --argjson downloads "$(staged_downloads)" \
    --arg check "$CHECK_COMMAND" '
      { label: $label, description: $description }
      + (if $version != "" then { version: $version } else {} end)
      + { selectedByDefault: $selectedByDefault }
      + (if ($requires | length) > 0 then { requires: $requires } else {} end)
      + (if ($packages | length) > 0 then { packages: $packages } else {} end)
      + (if ($downloads | length) > 0 then { downloads: $downloads } else {} end)
      + { check: $check }
    ' >"$STAGED_MODULE"
}

stage_catalog() {
  jq --arg section "$SECTION" --arg id "$MODULE_ID" '
    if any(.sections[]; .title == $section)
    then .sections |= map(if .title == $section then .modules += [$id] else . end)
    else .sections += [{ title: $section, modules: [$id] }]
    end
  ' "$CATALOG_FILE" >"$STAGED_CATALOG"
}

test_install() {
  local staging_dir=$WORK_DIR/staging modules
  modules=$(modules_with_requirements $REQUIRES)
  stage_modules_for_test "$staging_dir" $modules
  mkdir -p "$staging_dir/modules/$MODULE_ID"
  cp "$STAGED_MODULE" "$staging_dir/modules/$MODULE_ID/module.json"
  run_install_test "$staging_dir" "$CHECK_COMMAND" $modules "$MODULE_ID" ||
    die "$MODULE_ID did not install. Nothing was changed."
}

apply_staged_files() {
  mkdir -p "$MODULES_DIR/$MODULE_ID"
  cp "$STAGED_MODULE" "$MODULES_DIR/$MODULE_ID/module.json"
  cp "$STAGED_CATALOG" "$CATALOG_FILE"
}

print_result() {
  echo
  echo "Added the $MODULE_ID module:"
  echo "  modules/$MODULE_ID/module.json (new)"
  echo "  modules/catalog.json, in the $SECTION section"
  echo
  echo "To go further, add to modules/$MODULE_ID/:"
  echo "  config/     files linked into the container's home, such as config/.config/$MODULE_ID/ or config/.bashrc.d/$MODULE_ID.sh"
  echo "  setup.sh    runs in the container after the config is linked, with step and warn available"
  echo "  install.sh  runs at image build after the packages and downloads, for anything else"
  echo
  echo "Then run ./install.sh so dev offers it. Add it to a project with: dev config <project>, then dev rebuild <project>"
}

require_engine
build_install_test_base "$(base_image)"
prompt_module_id
prompt_texts
prompt_section
prompt_selected_by_default
prompt_requirements
prompt_install_method
PACKAGES=
VERSION=
COMMANDS=
FILE_NAME=
if [ "$INSTALL_METHOD" = packages ]; then
  prompt_packages
else
  prompt_download
  pin_staged_download
  if is_archive "$(downloaded_file arm64)"; then
    prompt_archive_commands
  else
    prompt_single_executable
  fi
fi
prompt_check_command
stage_module
stage_catalog
test_install
apply_staged_files
print_result
