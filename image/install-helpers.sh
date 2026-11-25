set -euo pipefail

. /opt/devenv/versions
. /opt/devenv/download-urls.sh

ARCH=$(dpkg --print-architecture)
ARCH_SUFFIX=$(echo "$ARCH" | tr '[:lower:]' '[:upper:]')
DOWNLOAD_CACHE=/var/cache/devenv

pick_for_architecture() {
  architecture_name "$ARCH" "$1" "$2"
}

pinned_hash_variable() {
  local algorithm variable
  for algorithm in SHA256 SHA512; do
    variable="${1}_${algorithm}_$ARCH_SUFFIX"
    if [ -n "${!variable:-}" ]; then
      echo "$variable"
      return
    fi
  done
  echo "No hash is pinned for $1 on $ARCH in versions" >&2
  exit 1
}

hash_algorithm_of() {
  echo "$1" | sed -E 's/.*_(SHA[0-9]+)_[A-Z0-9]+$/\1/' | tr '[:upper:]' '[:lower:]'
}

hash_matches() {
  local file=$1 algorithm=$2 expected=$3
  echo "$expected  $file" | "${algorithm}sum" --check --status
}

download_verified() {
  local url=$1 algorithm=$2 expected=$3
  local file="$DOWNLOAD_CACHE/${expected:0:16}-${url##*/}"
  mkdir -p "$DOWNLOAD_CACHE"
  if [ -f "$file" ] && hash_matches "$file" "$algorithm" "$expected"; then
    echo "$file"
    return
  fi
  curl -fsSL --retry 3 -o "$file.part" "$url"
  if ! hash_matches "$file.part" "$algorithm" "$expected"; then
    rm -f "$file.part"
    echo "Checksum mismatch for $url" >&2
    exit 1
  fi
  mv "$file.part" "$file"
  echo "$file"
}

download_pinned() {
  local hash_variable
  hash_variable=$(pinned_hash_variable "$1")
  download_verified "$(download_url "$1" "$ARCH")" "$(hash_algorithm_of "$hash_variable")" "${!hash_variable}"
}

fresh_install_dir() {
  rm -rf "$1"
  mkdir -p "$1"
  echo "$1"
}

move_single_top_level_folder_up() {
  local dir=$1 entries
  entries=$(find "$dir" -mindepth 1 -maxdepth 1)
  if [ "$(echo "$entries" | wc -l)" -eq 1 ] && [ -d "$entries" ]; then
    mv "$entries" "$dir/.extracted"
    find "$dir/.extracted" -mindepth 1 -maxdepth 1 -exec mv {} "$dir/" \;
    rmdir "$dir/.extracted"
  fi
}

extract_archive() {
  local archive=$1 dir=$2
  case "$archive" in
    *.tar.gz | *.tgz) tar -xzf "$archive" -C "$dir" ;;
    *.tar.xz) tar -xJf "$archive" -C "$dir" ;;
    *.zip) unzip -q "$archive" -d "$dir" ;;
    *)
      echo "Unsupported archive type: $archive" >&2
      exit 1
      ;;
  esac
  move_single_top_level_folder_up "$dir"
}

list_contains() {
  case " $1 " in *" $2 "*) return 0 ;; *) return 1 ;; esac
}

install_executable() {
  install -m 0755 "$1" "$2"
}

link_into_path() {
  if [ ! -f "$1" ] || [ ! -x "$1" ]; then
    echo "Cannot link $1: it is not an executable file" >&2
    exit 1
  fi
  ln -sf "$1" "/usr/local/bin/${2:-${1##*/}}"
}
