#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"

if [ $# -eq 0 ]; then
  echo "Usage: dotnet.sh <channel>... (offered: $DOTNET_CHANNELS)" >&2
  exit 1
fi

apt-get update
apt-get install -y --no-install-recommends libicu74
rm -rf /var/lib/apt/lists/*

rid="linux-$(for_arch arm64 x64)"
dir=/opt/dotnet
mkdir -p "$dir"

for channel in "$@"; do
  version_key="DOTNET_${channel}_VERSION"
  version="${!version_key:-}"
  if [ -z "$version" ]; then
    echo "Unknown .NET channel $channel (offered: $DOTNET_CHANNELS)" >&2
    exit 1
  fi
  archive=$(fetch "https://builds.dotnet.microsoft.com/dotnet/Sdk/$version/dotnet-sdk-$version-$rid.tar.gz" sha512 "$(pinned_hash "DOTNET_${channel}_SHA512")")
  tar -xzf "$archive" -C "$dir"
done

link_bin "$dir/dotnet"
