#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"

asset="yazi-$(for_arch aarch64 x86_64)-unknown-linux-gnu.zip"
archive=$(fetch "https://github.com/sxyazi/yazi/releases/download/v$YAZI_VERSION/$asset" sha256 "$(pinned_hash YAZI_SHA256)")

dir=$(install_dir /opt/yazi)
unzip -q -j "$archive" '*/yazi' '*/ya' -d "$dir"
link_bin "$dir/yazi"
link_bin "$dir/ya"
