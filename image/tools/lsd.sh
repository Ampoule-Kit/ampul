#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

asset="lsd-v$LSD_VERSION-$(pick_for_architecture aarch64 x86_64)-unknown-linux-gnu.tar.gz"
archive=$(download_verified "https://github.com/lsd-rs/lsd/releases/download/v$LSD_VERSION/$asset" sha256 "$(pinned_hash LSD_SHA256)")

dir=$(fresh_install_dir /opt/lsd)
tar -xzf "$archive" -C "$dir" --strip-components=1
link_into_path "$dir/lsd"
