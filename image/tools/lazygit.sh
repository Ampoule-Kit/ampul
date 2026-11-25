#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

asset="lazygit_${LAZYGIT_VERSION}_linux_$(pick_for_architecture arm64 x86_64).tar.gz"
archive=$(download_verified "https://github.com/jesseduffield/lazygit/releases/download/v$LAZYGIT_VERSION/$asset" sha256 "$(pinned_hash LAZYGIT_SHA256)")

dir=$(fresh_install_dir /opt/lazygit)
tar -xzf "$archive" -C "$dir" lazygit
link_into_path "$dir/lazygit"
