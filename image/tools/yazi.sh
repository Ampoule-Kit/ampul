#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

archive=$(download_pinned YAZI)
dir=$(fresh_install_dir /opt/yazi)
extract_archive "$archive" "$dir"
link_into_path "$dir/yazi"
link_into_path "$dir/ya"
