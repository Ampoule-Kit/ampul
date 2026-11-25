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

docker_dir=$(fresh_install_dir /opt/docker-cli)
docker_archive=$(download_pinned DOCKER_CLI)
extract_archive "$docker_archive" "$docker_dir"
link_into_path "$docker_dir/docker"

mkdir -p /usr/local/lib/docker/cli-plugins
compose_binary=$(download_pinned DOCKER_COMPOSE)
install_executable "$compose_binary" /usr/local/lib/docker/cli-plugins/docker-compose
