#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"

asset="nvim-linux-$(for_arch arm64 x86_64).tar.gz"
archive=$(fetch "https://github.com/neovim/neovim/releases/download/v$NEOVIM_VERSION/$asset" sha256 "$(pinned_hash NEOVIM_SHA256)")

dir=$(install_dir /opt/neovim)
tar -xzf "$archive" -C "$dir" --strip-components=1
link_bin "$dir/bin/nvim"
