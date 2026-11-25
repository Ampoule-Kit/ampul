#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"

asset="tree-sitter-linux-$(for_arch arm64 x64).gz"
archive=$(fetch "https://github.com/tree-sitter/tree-sitter/releases/download/v$TREE_SITTER_VERSION/$asset" sha256 "$(pinned_hash TREE_SITTER_SHA256)")

dir=$(install_dir /opt/tree-sitter)
gunzip -c "$archive" > "$dir/tree-sitter"
chmod +x "$dir/tree-sitter"
link_bin "$dir/tree-sitter"
