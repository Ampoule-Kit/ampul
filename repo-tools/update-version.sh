#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=$(cd -P "$(dirname "$0")/.." && pwd)
BASE_IMAGE_FILE=$REPO_DIR/image/base-image.json

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

. "$REPO_DIR/repo-tools/shell-helpers.sh"
. "$REPO_DIR/repo-tools/pinning.sh"
. "$REPO_DIR/repo-tools/install-test.sh"

usage() {
  cat <<EOF
Usage: repo-tools/update-version.sh                               List the modules and what they pin
       repo-tools/update-version.sh <module> <version>            Pin a module to <version>
       repo-tools/update-version.sh <module>:<download> <version> Pin one named download of a module
       repo-tools/update-version.sh ubuntu <tag>                  Pin the base image to ubuntu:<tag>

Options:
  --skip-install-test    Don't test the install in a container

Examples:
  repo-tools/update-version.sh neovim 0.12.7
  repo-tools/update-version.sh container-engine:docker 29.11.0

A new .NET SDK channel is a new module: copy modules/dotnet-10 to modules/dotnet-<channel>,
add it to modules/catalog.json, then pin it with this script.
EOF
}

module_pins() {
  jq -r '
    if .version then .version
    elif ((.downloads // []) | map(select(.name)) | length) > 0 then
      (.downloads | map(select(.name) | "\(.name) \(.version)") | join(", "))
    else "Ubuntu packages: \(.packages // [] | join(" "))" end
  ' "$1"
}

list_pins() {
  local id
  printf '%-18s %s\n' MODULE VERSION
  printf '%-18s %s\n' ubuntu "$(base_image | sed -E 's/^.*:([^@]+)@.*$/\1/')"
  for id in $(modules_in_catalog_order); do
    printf '%-18s %s\n' "$id" "$(module_pins "$(module_file "$id")")"
  done
}

registry_token() {
  curl -fsSL "https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/ubuntu:pull" |
    sed -n 's/.*"token":"\([^"]*\)".*/\1/p'
}

update_ubuntu() {
  local tag=$1 skip_install_test=$2 token manifest_url headers index digest current_tag image
  current_tag=$(base_image | sed -E 's/^.*:([^@]+)@.*$/\1/')
  manifest_url="https://registry-1.docker.io/v2/library/ubuntu/manifests/$tag"
  token=$(registry_token) || die "Could not reach Docker Hub."
  echo "==> Resolving ubuntu:$tag"
  headers=$(curl -fsSI -H "Authorization: Bearer $token" \
    -H "Accept: application/vnd.oci.image.index.v1+json" \
    -H "Accept: application/vnd.docker.distribution.manifest.list.v2+json" "$manifest_url") ||
    die "ubuntu:$tag does not exist on Docker Hub."
  index=$(curl -fsSL -H "Authorization: Bearer $token" \
    -H "Accept: application/vnd.oci.image.index.v1+json" \
    -H "Accept: application/vnd.docker.distribution.manifest.list.v2+json" "$manifest_url")
  digest=$(echo "$headers" | tr -d '\r' | grep -i '^docker-content-digest:' | sed 's/^[^:]*: *//')
  [ -n "$digest" ] || die "Docker Hub returned no digest for ubuntu:$tag."
  echo "$index" | grep -qE '"architecture": *"arm64"' || die "ubuntu:$tag has no arm64 image."
  echo "$index" | grep -qE '"architecture": *"amd64"' || die "ubuntu:$tag has no amd64 image."
  echo "    $digest, with arm64 and amd64 images"
  image="docker.io/library/ubuntu:$tag@$digest"

  if [ "${tag%%.*}" != "${current_tag%%.*}" ]; then
    echo "Note: this moves from Ubuntu $current_tag to $tag. Ubuntu package names in modules (such as libicu74 in the dotnet modules) may differ; build a project with them to check."
  fi
  if [ "$skip_install_test" = no ]; then
    require_engine
    build_install_test_base "$image" || die "The base image does not build on ubuntu:$tag."
    echo "    passed"
  fi
  update_json "$BASE_IMAGE_FILE" --arg image "$image" '.image = $image'
  echo "Pinned ubuntu to $tag."
}

download_index_named() {
  jq --arg name "$2" '(.downloads // []) | map(.name) | index($name) // empty' "$1"
}

downloads_following_module_version() {
  jq '(.downloads // []) | to_entries[] | select(.value.version == null) | .key' "$1"
}

first_download_name() {
  jq -r '[.downloads[]?.name // empty][0] // "name"' "$1"
}

update_module() {
  local target=$1 version=$2 skip_install_test=$3
  local module=${target%%:*} download_name= file staged indexes index modules
  [[ "$target" == *:* ]] && download_name=${target#*:}
  is_valid_version "$version" || die "'$version' is not a valid version."
  file=$(module_file "$module")
  [ -f "$file" ] || die "There is no module named '$module'. Run repo-tools/update-version.sh to list them."

  WORK_DIR=$(mktemp -d)
  trap 'rm -rf "$WORK_DIR"' EXIT
  staged=$WORK_DIR/module.json
  cp "$file" "$staged"

  if [ -n "$download_name" ]; then
    index=$(download_index_named "$staged" "$download_name")
    [ -n "$index" ] || die "$module has no download named '$download_name'."
    update_json "$staged" --argjson index "$index" --arg version "$version" '.downloads[$index].version = $version'
    indexes=$index
  else
    [ -n "$(jq -r '.version // empty' "$staged")" ] ||
      die "$module pins each download on its own. Pin one with $module:<download>, such as $module:$(first_download_name "$staged")."
    update_json "$staged" --arg version "$version" '.version = $version'
    indexes=$(downloads_following_module_version "$staged")
  fi
  [ -n "$indexes" ] || die "$module only installs Ubuntu packages, so there is no version to pin."

  echo "==> Downloading $target $version for $ARCHITECTURES"
  for index in $indexes; do
    pin_download "$staged" "$index" "$WORK_DIR/downloads" || die "$target $version could not be pinned. Nothing was changed."
  done

  if [ "$skip_install_test" = no ]; then
    require_engine
    build_install_test_base "$(base_image)"
    modules=$(modules_with_requirements "$module")
    stage_modules_for_test "$WORK_DIR/staging" $modules
    cp "$staged" "$WORK_DIR/staging/modules/$module/module.json"
    run_install_test "$WORK_DIR/staging" "$(jq -r .check "$staged")" $modules ||
      die "$target $version does not install. Nothing was changed."
  fi

  cp "$staged" "$file"
  echo "Pinned $target to $version in modules/$module/module.json. Apply it to a project with: dev rebuild <project>"
}

skip_install_test=no
arguments=()
for argument in "$@"; do
  case "$argument" in
    --skip-install-test) skip_install_test=yes ;;
    -h | --help) usage && exit 0 ;;
    *) arguments+=("$argument") ;;
  esac
done

case "${#arguments[@]}" in
  0) list_pins ;;
  2)
    if [ "${arguments[0]}" = ubuntu ]; then
      update_ubuntu "${arguments[1]}" "$skip_install_test"
    else
      update_module "${arguments[0]}" "${arguments[1]}" "$skip_install_test"
    fi
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
