set -euo pipefail

. /opt/devenv/versions

ARCH=$(dpkg --print-architecture)
ARCH_KEY=$(echo "$ARCH" | tr '[:lower:]' '[:upper:]')
DOWNLOAD_CACHE=/var/cache/devenv

for_arch() {
  case "$ARCH" in
    arm64) echo "$1" ;;
    amd64) echo "$2" ;;
    *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
  esac
}

pinned_hash() {
  local key="$1_$ARCH_KEY"
  if [ -z "${!key:-}" ]; then
    echo "No hash pinned for $key in versions" >&2
    exit 1
  fi
  echo "${!key}"
}

hash_matches() {
  local file="$1" algorithm="$2" expected="$3"
  echo "$expected  $file" | "${algorithm}sum" --check --status
}

fetch() {
  local url="$1" algorithm="$2" expected="$3"
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

install_dir() {
  rm -rf "$1"
  mkdir -p "$1"
  echo "$1"
}

link_bin() {
  ln -sf "$1" "/usr/local/bin/${2:-${1##*/}}"
}
