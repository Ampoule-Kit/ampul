set -euo pipefail

. /opt/ampul/module-downloads.sh

ARCH=$(dpkg --print-architecture)
DOWNLOAD_CACHE=/var/cache/ampul

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

fresh_install_dir() {
  rm -rf "$1"
  mkdir -p "$1"
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
  esac
  move_single_top_level_folder_up "$dir"
}

link_into_path() {
  if [ ! -f "$1" ] || [ ! -x "$1" ]; then
    echo "Cannot link $1: it is not an executable file" >&2
    exit 1
  fi
  ln -sf "$1" "/usr/local/bin/${2:-${1##*/}}"
}
