#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

asset="nvim-linux-$(pick_for_architecture arm64 x86_64).tar.gz"
archive=$(download_verified "https://github.com/neovim/neovim/releases/download/v$NEOVIM_VERSION/$asset" sha256 "$(pinned_hash NEOVIM_SHA256)")

dir=$(fresh_install_dir /opt/neovim)
tar -xzf "$archive" -C "$dir" --strip-components=1
link_into_path "$dir/bin/nvim"
