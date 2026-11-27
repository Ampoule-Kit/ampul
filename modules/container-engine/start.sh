ENGINE_SOCKET=/run/podman/podman.sock

delegate_cgroup_controllers() {
  [ -f /sys/fs/cgroup/cgroup.controllers ] || return 0
  sudo sh -c '
    mkdir -p /sys/fs/cgroup/init
    xargs -rn1 </sys/fs/cgroup/cgroup.procs >/sys/fs/cgroup/init/cgroup.procs 2>/dev/null
    sed -e "s/ / +/g" -e "s/^/+/" </sys/fs/cgroup/cgroup.controllers >/sys/fs/cgroup/cgroup.subtree_control
  ' || true
}

delegate_cgroup_controllers
sudo mkdir -p "$(dirname "$ENGINE_SOCKET")"
sudo podman system service --time=0 "unix://$ENGINE_SOCKET" >"$LOG_DIR/container-engine.log" 2>&1 &
for _ in $(seq 100); do
  [ -S "$ENGINE_SOCKET" ] && break
  sleep 0.1
done
sudo chgrp "$(id -g)" "$ENGINE_SOCKET"
sudo chmod 660 "$ENGINE_SOCKET"
