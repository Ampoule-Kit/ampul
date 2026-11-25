#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"

asset="lazygit_${LAZYGIT_VERSION}_linux_$(for_arch arm64 x86_64).tar.gz"
archive=$(fetch "https://github.com/jesseduffield/lazygit/releases/download/v$LAZYGIT_VERSION/$asset" sha256 "$(pinned_hash LAZYGIT_SHA256)")

dir=$(install_dir /opt/lazygit)
tar -xzf "$archive" -C "$dir" lazygit
link_bin "$dir/lazygit"
