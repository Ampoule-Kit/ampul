#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

asset="zellij-$(pick_for_architecture aarch64 x86_64)-unknown-linux-gnu.tar.gz"
archive=$(download_verified "https://github.com/zellij-org/zellij/releases/download/v$ZELLIJ_VERSION/$asset" sha256 "$(pinned_hash ZELLIJ_SHA256)")

dir=$(fresh_install_dir /opt/zellij)
tar -xzf "$archive" -C "$dir" zellij
link_into_path "$dir/zellij"
