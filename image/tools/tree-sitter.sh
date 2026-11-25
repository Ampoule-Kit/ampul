#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

archive=$(download_pinned TREE_SITTER)
dir=$(fresh_install_dir /opt/tree-sitter)
gunzip -c "$archive" >"$dir/tree-sitter"
chmod +x "$dir/tree-sitter"
link_into_path "$dir/tree-sitter"
