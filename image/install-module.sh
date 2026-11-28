#!/usr/bin/env bash
. /opt/ampul/install-helpers.sh

MODULE_ID=$1
VERSION_ID=${2:-}
MODULE_DIR=/opt/ampul/modules/$MODULE_ID
MODULE_FILE=$MODULE_DIR/module.json

if [ -n "$VERSION_ID" ]; then
  MODULE_FILE=$(mktemp --suffix=.json)
  module_version_file "$MODULE_DIR/module.json" "$VERSION_ID" >"$MODULE_FILE"
fi

install_packages() {
  local packages
  packages=$(jq -r '.packages // [] | join(" ")' "$MODULE_FILE")
  [ -n "$packages" ] || return 0
  apt-get update
  apt-get install -y --no-install-recommends $packages
  rm -rf /var/lib/apt/lists/*
}

place_download() {
  local index=$1 file=$2 folder=$3 file_name
  if is_archive "$file"; then
    extract_archive "$file" "$folder"
    return
  fi
  file_name=$(download_field "$MODULE_FILE" "$index" .fileName)
  file_name=${file_name:-${file##*/}}
  case "$file" in
    *.gz) gunzip -c "$file" >"$folder/$file_name" && chmod 0755 "$folder/$file_name" ;;
    *) install -m 0755 "$file" "$folder/$file_name" ;;
  esac
}

link_commands() {
  local index=$1 folder=$2 command_path command_name
  while IFS=$'\t' read -r command_path command_name; do
    command_path=$(expand_download_text "$MODULE_FILE" "$index" "$ARCH" "$command_path")
    link_into_path "$folder/$command_path" "${command_name:-${command_path##*/}}"
  done < <(jq -r --argjson index "$index" '
    .downloads[$index].commands // [] | .[]
    | if type == "string" then [., ""] else [.path, .as] end
    | @tsv' "$MODULE_FILE")
}

install_download() {
  local index=$1 url file folder
  url=$(download_url "$MODULE_FILE" "$index" "$ARCH")
  file=$(download_verified "$url" "$(download_checksum_algorithm "$MODULE_FILE" "$index")" \
    "$(download_checksum "$MODULE_FILE" "$index" "$ARCH")")
  folder=$(download_field "$MODULE_FILE" "$index" .installTo)
  if [ "$(download_field "$MODULE_FILE" "$index" .sharedFolder)" = true ]; then
    mkdir -p "$folder"
  else
    fresh_install_dir "$folder"
  fi
  place_download "$index" "$file" "$folder"
  link_commands "$index" "$folder"
}

install_packages
for ((index = 0; index < $(download_count "$MODULE_FILE"); index++)); do
  install_download "$index"
done
if [ -f "$MODULE_DIR/install.sh" ]; then
  . "$MODULE_DIR/install.sh"
fi
