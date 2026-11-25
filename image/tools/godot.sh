#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

apt-get update
apt-get install -y --no-install-recommends libfontconfig1
rm -rf /var/lib/apt/lists/*

dir=$(fresh_install_dir /opt/godot)
case "${1:-}" in
  standard)
    archive=$(download_pinned GODOT)
    extract_archive "$archive" "$dir"
    link_into_path "$dir/Godot_v${GODOT_VERSION}_linux.$(pick_for_architecture arm64 x86_64)" godot
    ;;
  dotnet)
    archive=$(download_pinned GODOT_DOTNET)
    extract_archive "$archive" "$dir"
    link_into_path "$dir/Godot_v${GODOT_VERSION}_mono_linux.$(pick_for_architecture arm64 x86_64)" godot
    ;;
  *)
    echo "Usage: godot.sh standard|dotnet" >&2
    exit 1
    ;;
esac
