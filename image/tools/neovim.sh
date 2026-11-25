#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

archive=$(download_pinned NEOVIM)
dir=$(fresh_install_dir /opt/neovim)
extract_archive "$archive" "$dir"
link_into_path "$dir/bin/nvim"
