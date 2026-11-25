ARCHITECTURES="arm64 amd64"

architecture_suffix() {
  echo "$1" | tr '[:lower:]' '[:upper:]'
}

name_to_variable_prefix() {
  echo "$1" | tr '[:lower:]-' '[:upper:]_'
}

variable_prefix_to_name() {
  echo "$1" | tr '[:upper:]_' '[:lower:]-'
}

is_valid_version() {
  [[ "$1" =~ ^[0-9A-Za-z][0-9A-Za-z.+_-]*$ ]]
}

variable_value() {
  sed -n "s/^$2=//p" "$1" | head -1 | sed -e 's/^"//' -e 's/"$//'
}

has_variable() {
  grep -q "^$2=" "$1"
}

replace_line() {
  awk -v pattern="$2" -v line="$3" '$0 ~ pattern && !done { print line; done = 1; next } { print }' "$1" >"$1.edited" &&
    mv "$1.edited" "$1"
}

insert_line_after() {
  awk -v pattern="$2" -v line="$3" '{ print } $0 ~ pattern && !done { print line; done = 1 } END { if (!done) print line }' "$1" >"$1.edited" &&
    mv "$1.edited" "$1"
}

replace_or_insert_line() {
  local file=$1 existing_pattern=$2 new_line=$3 insert_after_pattern=$4
  if grep -qE "$existing_pattern" "$file"; then
    replace_line "$file" "$existing_pattern" "$new_line"
  elif [ -n "$insert_after_pattern" ]; then
    insert_line_after "$file" "$insert_after_pattern" "$new_line"
  else
    echo "$new_line" >>"$file"
  fi
}

set_variable() {
  local file=$1 name=$2 value=$3 insert_after_pattern=${4:-}
  replace_or_insert_line "$file" "^$name=" "$name=$value" "$insert_after_pattern"
}

pinned_downloads() {
  grep -oE '^[A-Z0-9_]+_SHA(256|512)_ARM64=' "$1" | sed -E 's/_SHA(256|512)_ARM64=$//'
}

version_variable_of() {
  local file=$1 prefix=$2
  while [ -n "$prefix" ]; do
    if has_variable "$file" "${prefix}_VERSION"; then
      echo "${prefix}_VERSION"
      return
    fi
    case "$prefix" in *_*) prefix=${prefix%_*} ;; *) prefix= ;; esac
  done
  return 1
}

downloads_pinned_by() {
  local file=$1 version_variable=$2 download
  for download in $(pinned_downloads "$file"); do
    if [ "$(version_variable_of "$file" "$download")" = "$version_variable" ]; then
      echo "$download"
    fi
  done
}

sha256_of() {
  if command -v sha256sum >/dev/null; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

download_into() {
  local dir=$1 url=$2 file
  file="$dir/$(echo "$url" | sha256_of /dev/stdin | cut -c1-12)-${url##*/}"
  mkdir -p "$dir"
  if ! curl -fsSL --retry 3 -o "$file" "$url"; then
    echo "Could not download $url" >&2
    return 1
  fi
  if [ ! -s "$file" ]; then
    echo "$url downloaded as an empty file" >&2
    return 1
  fi
  echo "$file"
}

github_published_sha256() {
  local url=$1 repository tag asset
  [[ "$url" =~ ^https://github\.com/([^/]+/[^/]+)/releases/download/([^/]+)/([^/]+)$ ]] || return 1
  repository=${BASH_REMATCH[1]}
  tag=${BASH_REMATCH[2]}
  asset=${BASH_REMATCH[3]}
  command -v jq >/dev/null || return 1
  curl -fsSL "https://api.github.com/repos/$repository/releases/tags/$tag" 2>/dev/null |
    jq -r --arg asset "$asset" '.assets[] | select(.name == $asset) | .digest // empty' |
    sed -n 's/^sha256://p'
}

verify_against_published_hash() {
  local url=$1 hash=$2 published
  published=$(github_published_sha256 "$url") || published=
  if [ -z "$published" ]; then
    echo "    no published checksum to compare against"
    return 0
  fi
  if [ "$published" != "$hash" ]; then
    echo "    MISMATCH: GitHub publishes $published" >&2
    return 1
  fi
  echo "    matches the checksum GitHub publishes"
}

pin_download() {
  local versions_file=$1 download=$2 download_dir=$3 download_urls_file=${4:-$REPO_DIR/image/download-urls.sh}
  local version_variable architecture url file hash anchor
  version_variable=$(version_variable_of "$versions_file" "$download")
  anchor="^$version_variable="
  rm -f "$download_dir/$download.pins"
  (
    . "$versions_file"
    . "$download_urls_file"
    for architecture in $ARCHITECTURES; do
      url=$(download_url "$download" "$architecture") || exit 1
      echo "  $download ($architecture): $url"
      file=$(download_into "$download_dir" "$url") || exit 1
      hash=$(sha256_of "$file") || exit 1
      echo "    sha256 $hash"
      verify_against_published_hash "$url" "$hash" || exit 1
      echo "$architecture $hash $file" >>"$download_dir/$download.pins"
    done
  ) || return 1

  while read -r architecture hash file; do
    replace_or_insert_line "$versions_file" "^${download}_SHA(256|512)_$(architecture_suffix "$architecture")=" \
      "${download}_SHA256_$(architecture_suffix "$architecture")=$hash" "$anchor"
    anchor="^${download}_SHA256_$(architecture_suffix "$architecture")="
  done <"$download_dir/$download.pins"
}
