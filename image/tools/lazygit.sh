#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

archive=$(download_pinned LAZYGIT)
dir=$(fresh_install_dir /opt/lazygit)
extract_archive "$archive" "$dir"
link_into_path "$dir/lazygit"
