#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=$(cd -P "$(dirname "$0")/.." && pwd)
VERSIONS_FILE=$REPO_DIR/image/versions
DOWNLOAD_URLS_FILE=$REPO_DIR/image/download-urls.sh
OPTIONAL_DEPENDENCIES_FILE=$REPO_DIR/image/optional-dependencies
CONTAINERFILE=$REPO_DIR/image/Containerfile
TOOLS_DIR=$REPO_DIR/image/tools
RESERVED_SETTINGS="PROJECT_NAME CODE_SOURCE REPOSITORIES COPY_FOLDER COPY_GIT_FILES_ONLY DOTNET_SDKS PORTS UBUNTU_IMAGE CONTAINER_USER RUNTIME"

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

. "$REPO_DIR/devenv.conf"
. "$REPO_DIR/cli/engine.sh"
. "$REPO_DIR/cli/prompts.sh"
. "$REPO_DIR/repo-tools/pinning.sh"
. "$REPO_DIR/repo-tools/install-test.sh"

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT
STAGED_VERSIONS=$WORK_DIR/versions
STAGED_DOWNLOAD_URLS=$WORK_DIR/download-urls.sh
STAGED_OPTIONAL_DEPENDENCIES=$WORK_DIR/optional-dependencies
STAGED_CONTAINERFILE=$WORK_DIR/Containerfile
STAGED_SCRIPT=$WORK_DIR/install-script.sh

ask_required() {
  local answer
  while true; do
    read -r -p "$1: " answer
    [ -n "$answer" ] && break
    echo "  An answer is required." >&2
  done
  echo "$answer"
}

stage_repository_files() {
  cp "$VERSIONS_FILE" "$STAGED_VERSIONS"
  cp "$DOWNLOAD_URLS_FILE" "$STAGED_DOWNLOAD_URLS"
  cp "$OPTIONAL_DEPENDENCIES_FILE" "$STAGED_OPTIONAL_DEPENDENCIES"
  cp "$CONTAINERFILE" "$STAGED_CONTAINERFILE"
}

name_problem() {
  local name=$1 setting
  setting=$(name_to_variable_prefix "$name")
  [[ "$name" =~ ^[a-z][a-z0-9-]*$ ]] || { echo "Use lowercase letters, digits and dashes, starting with a letter."; return; }
  [ -e "$TOOLS_DIR/$name.sh" ] && { echo "image/tools/$name.sh already exists."; return; }
  grep -q "^$setting|" "$OPTIONAL_DEPENDENCIES_FILE" && { echo "$setting is already an optional dependency."; return; }
  has_variable "$VERSIONS_FILE" "${setting}_VERSION" && { echo "${setting}_VERSION is already pinned."; return; }
  list_contains "$RESERVED_SETTINGS" "$setting" && { echo "$setting is a name devenv already uses."; return; }
  [[ "$setting" =~ ^DOTNET ]] && { echo ".NET SDKs are added with: repo-tools/update-version.sh dotnet-<channel> <version>"; return; }
  return 0
}

prompt_dependency_name() {
  local problem
  while true; do
    NAME=$(ask_required "Name, in lowercase (for example rust)")
    problem=$(name_problem "$NAME")
    [ -z "$problem" ] && break
    echo "  $problem"
  done
  SETTING=$(name_to_variable_prefix "$NAME")
}

prompt_label() {
  while true; do
    LABEL=$(ask_required "Label shown by dev new (for example Rust toolchain)")
    [[ "$LABEL" != *"|"* ]] && break
    echo "  The label can't contain '|'."
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
  local package_list package invalid missing
  while true; do
    PACKAGES=$(ask_required "Ubuntu packages, space-separated")
    read -r -a package_list <<<"$PACKAGES"
    invalid=
    for package in "${package_list[@]}"; do
      [[ "$package" =~ ^[a-z0-9][a-z0-9+.-]+$ ]] || invalid="$invalid $package"
    done
    if [ -n "$invalid" ]; then
      echo "  Not valid package names:$invalid"
      continue
    fi
    echo "==> Checking the packages exist in $(variable_value "$VERSIONS_FILE" UBUNTU_IMAGE | sed -E 's/@.*//')"
    missing=$(missing_ubuntu_packages "${package_list[@]}")
    [ -z "$missing" ] && break
    echo "  Not found in Ubuntu: $(echo "$missing" | tr '\n' ' ')"
  done
}

url_template_problem() {
  case "$1" in
    https://*) ;;
    *) echo "The URL must start with https://." && return ;;
  esac
  [[ "$1" == *"{version}"* ]] || { echo "The URL must contain {version}."; return; }
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

download_url_function() {
  local version_expression="\${${SETTING}_VERSION}"
  local architecture_expression="\$(architecture_name \"\$1\" $ARM64_NAME $AMD64_NAME)"
  local url=${URL_TEMPLATE//"{version}"/$version_expression}
  url=${url//"{arch}"/$architecture_expression}
  printf '\ndownload_url_%s() {\n  echo "%s"\n}\n' "$SETTING" "$url"
}

stage_download_pin() {
  download_url_function >>"$STAGED_DOWNLOAD_URLS"
  printf '\n%s_VERSION=%s\n' "$SETTING" "$VERSION" >>"$STAGED_VERSIONS"
  echo "==> Downloading $NAME $VERSION for $ARCHITECTURES"
  pin_download "$STAGED_VERSIONS" "$SETTING" "$WORK_DIR/downloads" "$STAGED_DOWNLOAD_URLS" ||
    die "$NAME could not be downloaded and pinned. Nothing was changed."
}

downloaded_file() {
  awk -v architecture="$1" '$1 == architecture { print $3 }' "$WORK_DIR/downloads/$SETTING.pins"
}

is_archive() {
  case "$1" in *.tar.gz | *.tgz | *.tar.xz | *.zip) return 0 ;; *) return 1 ;; esac
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

prompt_archive_executables() {
  local arm64_entries amd64_entries candidates path missing
  arm64_entries=$(entries_as_installed "$(downloaded_file arm64)")
  amd64_entries=$(entries_as_installed "$(downloaded_file amd64)")
  candidates=$(executable_paths "$arm64_entries")
  if [ -n "$candidates" ]; then
    echo "Executables in the archive:"
    echo "$candidates" | head -20 | sed 's/^/  /'
  fi
  while true; do
    EXECUTABLES=$(ask "Executables to put on the PATH, space-separated" "$(echo "$candidates" | head -1)")
    missing=
    for path in $EXECUTABLES; do
      echo "$arm64_entries" | cut -f2 | grep -qxF "$path" || missing="$missing $path (arm64)"
      echo "$amd64_entries" | cut -f2 | grep -qxF "$path" || missing="$missing $path (amd64)"
    done
    [ -n "$EXECUTABLES" ] && [ -z "$missing" ] && break
    echo "  Not in the archive:${missing:- nothing chosen}"
  done
}

prompt_single_executable() {
  while true; do
    EXECUTABLES=$(ask "Command name to install it as" "$NAME")
    [[ "$EXECUTABLES" =~ ^[A-Za-z0-9_.-]+$ ]] && break
    echo "  Use letters, digits, dots, dashes and underscores."
  done
}

write_packages_script() {
  cat >"$STAGED_SCRIPT" <<EOF
#!/usr/bin/env bash
. "\$(dirname "\$0")/../install-helpers.sh"

apt-get update
apt-get install -y --no-install-recommends $PACKAGES
rm -rf /var/lib/apt/lists/*
EOF
}

write_archive_script() {
  local path
  {
    echo '#!/usr/bin/env bash'
    echo '. "$(dirname "$0")/../install-helpers.sh"'
    echo
    echo "archive=\$(download_pinned $SETTING)"
    echo "dir=\$(fresh_install_dir /opt/$NAME)"
    echo 'extract_archive "$archive" "$dir"'
    for path in $EXECUTABLES; do
      echo "link_into_path \"\$dir/$path\""
    done
  } >"$STAGED_SCRIPT"
}

write_single_executable_script() {
  {
    echo '#!/usr/bin/env bash'
    echo '. "$(dirname "$0")/../install-helpers.sh"'
    echo
    echo "binary=\$(download_pinned $SETTING)"
    echo "dir=\$(fresh_install_dir /opt/$NAME)"
    echo "install_executable \"\$binary\" \"\$dir/$EXECUTABLES\""
    echo "link_into_path \"\$dir/$EXECUTABLES\""
  } >"$STAGED_SCRIPT"
}

stage_optional_dependency() {
  echo "$SETTING|yes-no|$LABEL" >>"$STAGED_OPTIONAL_DEPENDENCIES"
  awk -v setting="$SETTING" -v script="$NAME.sh" '
    /^ARG USER_NAME=/ && !done {
      print "ARG WITH_" setting "="
      print "RUN --mount=type=cache,target=/var/cache/devenv \\"
      print "    if [ -n \"$WITH_" setting "\" ]; then /opt/devenv/tools/" script " \"$WITH_" setting "\"; fi"
      print ""
      done = 1
    }
    { print }
  ' "$CONTAINERFILE" >"$STAGED_CONTAINERFILE"
  grep -q "^ARG WITH_$SETTING=" "$STAGED_CONTAINERFILE" || die "Could not find where to add $NAME in image/Containerfile."
}

prompt_check_command() {
  local first_executable suggestion=""
  for first_executable in ${EXECUTABLES:-}; do
    suggestion="${first_executable##*/} --version"
    break
  done
  if [ -n "$suggestion" ]; then
    CHECK_COMMAND=$(ask "Command that proves it works after installing" "$suggestion")
  else
    CHECK_COMMAND=$(ask_required "Command that proves it works after installing (for example rustc --version)")
  fi
}

test_install() {
  local staging_dir=$WORK_DIR/staging
  stage_image_files "$staging_dir" "$STAGED_VERSIONS"
  cp "$STAGED_DOWNLOAD_URLS" "$staging_dir/download-urls.sh"
  cp "$STAGED_SCRIPT" "$staging_dir/tools/$NAME.sh"
  chmod +x "$staging_dir/tools/$NAME.sh"
  run_install_test "$staging_dir" "$NAME.sh yes" "$CHECK_COMMAND" || die "$NAME did not install. Nothing was changed."
}

apply_staged_files() {
  cp "$STAGED_VERSIONS" "$VERSIONS_FILE"
  cp "$STAGED_DOWNLOAD_URLS" "$DOWNLOAD_URLS_FILE"
  cp "$STAGED_OPTIONAL_DEPENDENCIES" "$OPTIONAL_DEPENDENCIES_FILE"
  cp "$STAGED_CONTAINERFILE" "$CONTAINERFILE"
  cp "$STAGED_SCRIPT" "$TOOLS_DIR/$NAME.sh"
  chmod +x "$TOOLS_DIR/$NAME.sh"
}

print_result() {
  echo
  echo "Added $NAME. Changed:"
  echo "  image/tools/$NAME.sh (new)"
  echo "  image/optional-dependencies"
  echo "  image/Containerfile"
  if [ "$INSTALL_METHOD" = download ]; then
    echo "  image/versions"
    echo "  image/download-urls.sh"
  fi
  echo "dev new now offers it. Add it to an existing project with: dev config <project>, then dev rebuild <project>"
}

require_engine
build_install_test_base "$(variable_value "$VERSIONS_FILE" UBUNTU_IMAGE)"
stage_repository_files
prompt_dependency_name
prompt_label
prompt_install_method
EXECUTABLES=
if [ "$INSTALL_METHOD" = packages ]; then
  prompt_packages
  write_packages_script
else
  prompt_download
  stage_download_pin
  if is_archive "$(downloaded_file arm64)"; then
    prompt_archive_executables
    write_archive_script
  else
    prompt_single_executable
    write_single_executable_script
  fi
fi
prompt_check_command
stage_optional_dependency
test_install
apply_staged_files
print_result
