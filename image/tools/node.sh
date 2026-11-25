#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

archive=$(download_pinned NODE)
dir=$(fresh_install_dir /opt/node)
extract_archive "$archive" "$dir"
