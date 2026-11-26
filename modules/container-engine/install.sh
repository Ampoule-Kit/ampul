cat >/etc/containers/containers.conf <<'CONFIG'
[engine]
cgroup_manager = "cgroupfs"
events_logger = "file"

[network]
default_subnet = "10.213.0.0/24"
default_subnet_pools = [
  { "base" = "10.214.0.0/16", "size" = 24 },
]
CONFIG

mkdir -p /etc/containers/registries.conf.d
cat >/etc/containers/registries.conf.d/docker-hub.conf <<'CONFIG'
unqualified-search-registries = ["docker.io"]
CONFIG
