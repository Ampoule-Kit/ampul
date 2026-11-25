#!/usr/bin/env bash
. "$(dirname "$0")/../install-helpers.sh"

apt-get update
apt-get install -y --no-install-recommends podman netavark aardvark-dns iptables fuse-overlayfs
rm -rf /var/lib/apt/lists/*

cat > /etc/containers/containers.conf <<'EOF'
[engine]
cgroup_manager = "cgroupfs"
events_logger = "file"

[network]
default_subnet = "10.213.0.0/24"
default_subnet_pools = [
  { "base" = "10.214.0.0/16", "size" = 24 },
]
EOF

mkdir -p /etc/containers/registries.conf.d
cat > /etc/containers/registries.conf.d/docker-hub.conf <<'EOF'
unqualified-search-registries = ["docker.io"]
EOF

docker_asset="docker-$DOCKER_CLI_VERSION.tgz"
docker_archive=$(download_verified "https://download.docker.com/linux/static/stable/$(pick_for_architecture aarch64 x86_64)/$docker_asset" sha256 "$(pinned_hash DOCKER_CLI_SHA256)")
docker_dir=$(fresh_install_dir /opt/docker-cli)
tar -xzf "$docker_archive" -C "$docker_dir" --strip-components=1 docker/docker
link_into_path "$docker_dir/docker"

compose_asset="docker-compose-linux-$(pick_for_architecture aarch64 x86_64)"
compose_binary=$(download_verified "https://github.com/docker/compose/releases/download/v$DOCKER_COMPOSE_VERSION/$compose_asset" sha256 "$(pinned_hash DOCKER_COMPOSE_SHA256)")
mkdir -p /usr/local/lib/docker/cli-plugins
cp "$compose_binary" /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
