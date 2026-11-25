architecture_name() {
  case "$1" in
    arm64) echo "$2" ;;
    amd64) echo "$3" ;;
    *)
      echo "Unsupported architecture: $1" >&2
      return 1
      ;;
  esac
}

download_url_NEOVIM() {
  echo "https://github.com/neovim/neovim/releases/download/v$NEOVIM_VERSION/nvim-linux-$(architecture_name "$1" arm64 x86_64).tar.gz"
}

download_url_LAZYGIT() {
  echo "https://github.com/jesseduffield/lazygit/releases/download/v$LAZYGIT_VERSION/lazygit_${LAZYGIT_VERSION}_linux_$(architecture_name "$1" arm64 x86_64).tar.gz"
}

download_url_YAZI() {
  echo "https://github.com/sxyazi/yazi/releases/download/v$YAZI_VERSION/yazi-$(architecture_name "$1" aarch64 x86_64)-unknown-linux-gnu.zip"
}

download_url_ZELLIJ() {
  echo "https://github.com/zellij-org/zellij/releases/download/v$ZELLIJ_VERSION/zellij-$(architecture_name "$1" aarch64 x86_64)-unknown-linux-gnu.tar.gz"
}

download_url_LSD() {
  echo "https://github.com/lsd-rs/lsd/releases/download/v$LSD_VERSION/lsd-v$LSD_VERSION-$(architecture_name "$1" aarch64 x86_64)-unknown-linux-gnu.tar.gz"
}

download_url_TREE_SITTER() {
  echo "https://github.com/tree-sitter/tree-sitter/releases/download/v$TREE_SITTER_VERSION/tree-sitter-linux-$(architecture_name "$1" arm64 x64).gz"
}

download_url_NODE() {
  echo "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$(architecture_name "$1" arm64 x64).tar.xz"
}

download_url_CLAUDE_CODE() {
  echo "https://downloads.claude.ai/claude-code-releases/$CLAUDE_CODE_VERSION/linux-$(architecture_name "$1" arm64 x64)/claude"
}

download_url_JAVA() {
  local major=${JAVA_VERSION%%.*}
  local release_tag="jdk-${JAVA_VERSION/+/%2B}"
  local file_version=${JAVA_VERSION/+/_}
  echo "https://github.com/adoptium/temurin$major-binaries/releases/download/$release_tag/OpenJDK${major}U-jdk_$(architecture_name "$1" aarch64 x64)_linux_hotspot_$file_version.tar.gz"
}

download_url_GODOT() {
  echo "https://github.com/godotengine/godot/releases/download/$GODOT_VERSION/Godot_v${GODOT_VERSION}_linux.$(architecture_name "$1" arm64 x86_64).zip"
}

download_url_GODOT_DOTNET() {
  echo "https://github.com/godotengine/godot/releases/download/$GODOT_VERSION/Godot_v${GODOT_VERSION}_mono_linux_$(architecture_name "$1" arm64 x86_64).zip"
}

download_url_DOCKER_CLI() {
  echo "https://download.docker.com/linux/static/stable/$(architecture_name "$1" aarch64 x86_64)/docker-$DOCKER_CLI_VERSION.tgz"
}

download_url_DOCKER_COMPOSE() {
  echo "https://github.com/docker/compose/releases/download/v$DOCKER_COMPOSE_VERSION/docker-compose-linux-$(architecture_name "$1" aarch64 x86_64)"
}

dotnet_sdk_download_url() {
  local channel=$1 architecture=$2 version_variable="DOTNET_${1}_VERSION"
  local version=${!version_variable}
  echo "https://builds.dotnet.microsoft.com/dotnet/Sdk/$version/dotnet-sdk-$version-linux-$(architecture_name "$architecture" arm64 x64).tar.gz"
}

download_url() {
  local download=$1 architecture=$2
  case "$download" in
    DOTNET_*) dotnet_sdk_download_url "${download#DOTNET_}" "$architecture" ;;
    *)
      if ! declare -F "download_url_$download" >/dev/null; then
        echo "No download URL is defined for $download in image/download-urls.sh" >&2
        return 1
      fi
      "download_url_$download" "$architecture"
      ;;
  esac
}
