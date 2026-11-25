#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

asset="node-v$NODE_VERSION-linux-$(pick_for_architecture arm64 x64).tar.xz"
archive=$(download_verified "https://nodejs.org/dist/v$NODE_VERSION/$asset" sha256 "$(pinned_hash NODE_SHA256)")

dir=$(fresh_install_dir /opt/node)
tar -xJf "$archive" -C "$dir" --strip-components=1
