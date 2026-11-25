#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

archive=$(download_pinned ZELLIJ)
dir=$(fresh_install_dir /opt/zellij)
extract_archive "$archive" "$dir"
link_into_path "$dir/zellij"
