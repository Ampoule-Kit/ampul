#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"

asset="lsd-v$LSD_VERSION-$(for_arch aarch64 x86_64)-unknown-linux-gnu.tar.gz"
archive=$(fetch "https://github.com/lsd-rs/lsd/releases/download/v$LSD_VERSION/$asset" sha256 "$(pinned_hash LSD_SHA256)")

dir=$(install_dir /opt/lsd)
tar -xzf "$archive" -C "$dir" --strip-components=1
link_bin "$dir/lsd"
