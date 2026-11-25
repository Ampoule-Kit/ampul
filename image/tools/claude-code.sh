#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

binary=$(download_pinned CLAUDE_CODE)
dir=$(fresh_install_dir /opt/claude-code)
install_executable "$binary" "$dir/claude"
link_into_path "$dir/claude"
