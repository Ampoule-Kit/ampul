#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

archive=$(download_pinned LSD)
dir=$(fresh_install_dir /opt/lsd)
extract_archive "$archive" "$dir"
link_into_path "$dir/lsd"
