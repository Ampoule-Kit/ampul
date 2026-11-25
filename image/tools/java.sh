#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

archive=$(download_pinned JAVA)
dir=$(fresh_install_dir /opt/java)
extract_archive "$archive" "$dir"
