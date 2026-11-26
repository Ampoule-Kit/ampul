ARCHITECTURES="arm64 amd64"

. "$REPO_DIR/image/module-downloads.sh"

module_file() {
  echo "$REPO_DIR/modules/$1/module.json"
}

is_valid_version() {
  [[ "$1" =~ ^[0-9A-Za-z][0-9A-Za-z.+_-]*$ ]]
}

update_json() {
  local file=$1
  shift
  jq "$@" "$file" >"$file.edited" && mv "$file.edited" "$file"
}

modules_in_catalog_order() {
  jq -r '.sections[].modules[]' "$REPO_DIR/modules/catalog.json"
}

modules_with_requirements() {
  local id required
  for id in "$@"; do
    for required in $(jq -r '.requires // [] | .[]' "$(module_file "$id")"); do
      modules_with_requirements "$required"
    done
    echo "$id"
  done | awk '!seen[$0]++'
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
  local module_file=$1 index=$2 download_dir=$3 architecture url file hash
  mkdir -p "$download_dir"
  rm -f "$download_dir/$index.files"
  for architecture in $ARCHITECTURES; do
    url=$(download_url "$module_file" "$index" "$architecture") || return 1
    echo "  $architecture: $url"
    file=$(download_into "$download_dir" "$url") || return 1
    hash=$(sha256_of "$file") || return 1
    echo "    sha256 $hash"
    verify_against_published_hash "$url" "$hash" || return 1
    update_json "$module_file" --argjson index "$index" --arg arch "$architecture" --arg hash "$hash" \
      '.downloads[$index] |= (del(.sha512) | .sha256[$arch] = $hash)'
    echo "$architecture $file" >>"$download_dir/$index.files"
  done
}
