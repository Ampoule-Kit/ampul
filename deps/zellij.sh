#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"

asset="zellij-$(for_arch aarch64 x86_64)-unknown-linux-gnu.tar.gz"
archive=$(fetch "https://github.com/zellij-org/zellij/releases/download/v$ZELLIJ_VERSION/$asset" sha256 "$(pinned_hash ZELLIJ_SHA256)")

dir=$(install_dir /opt/zellij)
tar -xzf "$archive" -C "$dir" zellij
link_bin "$dir/zellij"
