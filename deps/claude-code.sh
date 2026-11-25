#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"

platform="linux-$(for_arch arm64 x64)"
binary=$(fetch "https://downloads.claude.ai/claude-code-releases/$CLAUDE_CODE_VERSION/$platform/claude" sha256 "$(pinned_hash CLAUDE_CODE_SHA256)")

dir=$(install_dir /opt/claude-code)
cp "$binary" "$dir/claude"
chmod +x "$dir/claude"
link_bin "$dir/claude"
