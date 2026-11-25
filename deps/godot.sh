#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"

apt-get update
apt-get install -y --no-install-recommends libfontconfig1
rm -rf /var/lib/apt/lists/*

release_url="https://github.com/godotengine/godot/releases/download/$GODOT_VERSION"
dir=$(install_dir /opt/godot)

case "${1:-}" in
  standard)
    binary_name="Godot_v${GODOT_VERSION}_linux.$(for_arch arm64 x86_64)"
    archive=$(fetch "$release_url/$binary_name.zip" sha256 "$(pinned_hash GODOT_SHA256)")
    unzip -q "$archive" -d "$dir"
    link_bin "$dir/$binary_name" godot
    ;;
  dotnet)
    arch=$(for_arch arm64 x86_64)
    archive=$(fetch "$release_url/Godot_v${GODOT_VERSION}_mono_linux_$arch.zip" sha256 "$(pinned_hash GODOT_DOTNET_SHA256)")
    unzip -q "$archive" -d "$dir"
    link_bin "$dir/Godot_v${GODOT_VERSION}_mono_linux_$arch/Godot_v${GODOT_VERSION}_mono_linux.$arch" godot
    ;;
  *)
    echo "Usage: godot.sh standard|dotnet" >&2
    exit 1
    ;;
esac
