#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

platform="linux-$(pick_for_architecture arm64 x64)"
binary=$(download_verified "https://downloads.claude.ai/claude-code-releases/$CLAUDE_CODE_VERSION/$platform/claude" sha256 "$(pinned_hash CLAUDE_CODE_SHA256)")

dir=$(fresh_install_dir /opt/claude-code)
cp "$binary" "$dir/claude"
chmod +x "$dir/claude"
link_into_path "$dir/claude"
