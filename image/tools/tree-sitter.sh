#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

asset="tree-sitter-linux-$(pick_for_architecture arm64 x64).gz"
archive=$(download_verified "https://github.com/tree-sitter/tree-sitter/releases/download/v$TREE_SITTER_VERSION/$asset" sha256 "$(pinned_hash TREE_SITTER_SHA256)")

dir=$(fresh_install_dir /opt/tree-sitter)
gunzip -c "$archive" > "$dir/tree-sitter"
chmod +x "$dir/tree-sitter"
link_into_path "$dir/tree-sitter"
