#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

asset="yazi-$(pick_for_architecture aarch64 x86_64)-unknown-linux-gnu.zip"
archive=$(download_verified "https://github.com/sxyazi/yazi/releases/download/v$YAZI_VERSION/$asset" sha256 "$(pinned_hash YAZI_SHA256)")

dir=$(fresh_install_dir /opt/yazi)
unzip -q -j "$archive" '*/yazi' '*/ya' -d "$dir"
link_into_path "$dir/yazi"
link_into_path "$dir/ya"
