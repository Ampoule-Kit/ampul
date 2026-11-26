#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=$(cd -P "$(dirname "$0")/.." && pwd)
VERSIONS_FILE=$REPO_DIR/image/versions

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

. "$REPO_DIR/repo-tools/shell-helpers.sh"
. "$REPO_DIR/repo-tools/pinning.sh"
. "$REPO_DIR/repo-tools/install-test.sh"

usage() {
  cat <<EOF
Usage: repo-tools/update-version.sh                       List what is pinned
       repo-tools/update-version.sh <name> <version>      Pin <name> to <version>
       repo-tools/update-version.sh ubuntu <tag>          Pin the base image to ubuntu:<tag>

Options:
  --skip-install-test    Don't test the install in a container

A new .NET channel is added with: repo-tools/update-version.sh dotnet-<channel> <sdk-version>
EOF
}

list_pins() {
  local variable
  printf '%-18s %s\n' NAME VERSION
  printf '%-18s %s\n' ubuntu "$(variable_value "$VERSIONS_FILE" UBUNTU_IMAGE | sed -E 's/^.*:([^@]+)@.*$/\1/')"
  while read -r variable; do
    printf '%-18s %s\n' "$(variable_prefix_to_name "${variable%_VERSION}")" "$(variable_value "$VERSIONS_FILE" "$variable")"
  done < <(grep -oE '^[A-Z0-9_]+_VERSION=' "$VERSIONS_FILE" | sed 's/=$//')
}

install_test_command() {
  local download=$1 script
  case "$download" in
    DOTNET_*) echo "dotnet.sh ${download#DOTNET_}" ;;
    GODOT) echo "godot.sh standard" ;;
    GODOT_DOTNET) echo "godot.sh dotnet" ;;
    *)
      script=$(grep -lE "download_pinned $download\)" "$REPO_DIR"/image/tools/*.sh | head -1)
      [ -n "$script" ] || die "No script in image/tools installs $download."
      basename "$script"
      ;;
  esac
}

add_dotnet_channel() {
  local versions_file=$1 channel=$2 existing channels last_dotnet_line
  channels=$(
    for existing in $(variable_value "$versions_file" DOTNET_CHANNELS); do echo "$existing"; done
    echo "$channel"
  )
  channels=$(echo "$channels" | sort -n | tr '\n' ' ')
  set_variable "$versions_file" DOTNET_CHANNELS "\"${channels% }\""
  last_dotnet_line=$(grep -E '^DOTNET_[0-9]+_' "$versions_file" | tail -1 | cut -d= -f1)
  insert_line_after "$versions_file" "^$last_dotnet_line=" "DOTNET_${channel}_VERSION=placeholder"
  insert_line_after "$versions_file" "^$last_dotnet_line=" ""
}

registry_token() {
  curl -fsSL "https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/ubuntu:pull" |
    sed -n 's/.*"token":"\([^"]*\)".*/\1/p'
}

update_ubuntu() {
  local tag=$1 skip_install_test=$2 token manifest_url headers index digest current_tag image
  current_tag=$(variable_value "$VERSIONS_FILE" UBUNTU_IMAGE | sed -E 's/^.*:([^@]+)@.*$/\1/')
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
    echo "Note: this moves from Ubuntu $current_tag to $tag. Package names pinned in image/tools (such as libicu74 in dotnet.sh) may differ; build a project with .NET to check."
  fi
  if [ "$skip_install_test" = no ]; then
    require_engine
    build_install_test_base "$image" || die "The base image does not build on ubuntu:$tag."
    echo "    passed"
  fi
  set_variable "$VERSIONS_FILE" UBUNTU_IMAGE "$image"
  echo "Pinned ubuntu to $tag."
}

update_download() {
  local name=$1 version=$2 skip_install_test=$3
  local prefix versions_file downloads download new_dotnet_channel=no
  prefix=$(name_to_variable_prefix "$name")
  is_valid_version "$version" || die "'$version' is not a valid version."
  if ! has_variable "$VERSIONS_FILE" "${prefix}_VERSION"; then
    [[ "$prefix" =~ ^DOTNET_[0-9]+$ ]] || die "Nothing named '$name' is pinned. Run repo-tools/update-version.sh to list the names."
    new_dotnet_channel=yes
  fi

  WORK_DIR=$(mktemp -d)
  trap 'rm -rf "$WORK_DIR"' EXIT
  versions_file=$WORK_DIR/versions
  cp "$VERSIONS_FILE" "$versions_file"
  [ "$new_dotnet_channel" = yes ] && add_dotnet_channel "$versions_file" "${prefix#DOTNET_}"
  set_variable "$versions_file" "${prefix}_VERSION" "$version"

  downloads=$(downloads_pinned_by "$versions_file" "${prefix}_VERSION")
  [ -n "$downloads" ] || downloads=$prefix

  echo "==> Downloading $name $version for $ARCHITECTURES"
  for download in $downloads; do
    pin_download "$versions_file" "$download" "$WORK_DIR/downloads" || die "$name $version could not be pinned. image/versions is unchanged."
  done

  if [ "$skip_install_test" = no ]; then
    require_engine
    build_install_test_base "$(variable_value "$versions_file" UBUNTU_IMAGE)"
    stage_image_files "$WORK_DIR/staging" "$versions_file"
    for download in $downloads; do
      run_install_test "$WORK_DIR/staging" "$(install_test_command "$download")" ||
        die "$name $version does not install. image/versions is unchanged."
    done
  fi

  cp "$versions_file" "$VERSIONS_FILE"
  echo "Pinned $name to $version in image/versions. Apply it to a project with: dev rebuild <project>"
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
      update_download "${arguments[0]}" "${arguments[1]}" "$skip_install_test"
    fi
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
