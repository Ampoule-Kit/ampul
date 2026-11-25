#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"

major=${JAVA_VERSION%%.*}
tag="jdk-$JAVA_VERSION"
asset="OpenJDK${major}U-jdk_$(for_arch aarch64 x64)_linux_hotspot_$(echo "$JAVA_VERSION" | tr + _).tar.gz"
archive=$(fetch "https://github.com/adoptium/temurin$major-binaries/releases/download/${tag/+/%2B}/$asset" sha256 "$(pinned_hash JAVA_SHA256)")

dir=$(install_dir /opt/java)
tar -xzf "$archive" -C "$dir" --strip-components=1
