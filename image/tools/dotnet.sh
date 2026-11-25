#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

if [ $# -eq 0 ]; then
  echo "Usage: dotnet.sh <channel>... (offered: $DOTNET_CHANNELS)" >&2
  exit 1
fi

apt-get update
apt-get install -y --no-install-recommends libicu74
rm -rf /var/lib/apt/lists/*

dir=/opt/dotnet
mkdir -p "$dir"

for channel in "$@"; do
  if ! list_contains "$DOTNET_CHANNELS" "$channel"; then
    echo "Unknown .NET channel $channel (offered: $DOTNET_CHANNELS)" >&2
    exit 1
  fi
  archive=$(download_pinned "DOTNET_$channel")
  tar -xzf "$archive" -C "$dir"
done

link_into_path "$dir/dotnet"
