#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"

asset="node-v$NODE_VERSION-linux-$(for_arch arm64 x64).tar.xz"
archive=$(fetch "https://nodejs.org/dist/v$NODE_VERSION/$asset" sha256 "$(pinned_hash NODE_SHA256)")

dir=$(install_dir /opt/node)
tar -xJf "$archive" -C "$dir" --strip-components=1
