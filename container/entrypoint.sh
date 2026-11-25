#!/usr/bin/env bash
set -u

ENGINE_SOCKET=/run/podman/podman.sock
LOG_DIR=/tmp/devenv

delegate_cgroup_controllers() {
  [ -f /sys/fs/cgroup/cgroup.controllers ] || return 0
  sudo sh -c '
    mkdir -p /sys/fs/cgroup/init
    xargs -rn1 </sys/fs/cgroup/cgroup.procs >/sys/fs/cgroup/init/cgroup.procs 2>/dev/null
    sed -e "s/ / +/g" -e "s/^/+/" </sys/fs/cgroup/cgroup.controllers >/sys/fs/cgroup/cgroup.subtree_control
  ' || true
}

start_container_engine() {
  delegate_cgroup_controllers
  sudo mkdir -p "$(dirname "$ENGINE_SOCKET")"
  sudo podman system service --time=0 "unix://$ENGINE_SOCKET" >"$LOG_DIR/container-engine.log" 2>&1 &
  for _ in $(seq 100); do
    [ -S "$ENGINE_SOCKET" ] && break
    sleep 0.1
  done
  sudo chgrp "$(id -g)" "$ENGINE_SOCKET"
  sudo chmod 660 "$ENGINE_SOCKET"
}

start_ssh_agent() {
  rm -f "$SSH_AUTH_SOCK"
  ssh-agent -a "$SSH_AUTH_SOCK" >/dev/null
}

forward_published_ports() {
  local forward
  for forward in ${DEVENV_PORT_FORWARDS:-}; do
    socat "TCP-LISTEN:${forward#*:},fork,reuseaddr" "TCP:127.0.0.1:${forward%%:*}" >>"$LOG_DIR/port-forwards.log" 2>&1 &
  done
}

mkdir -p "$LOG_DIR"
start_ssh_agent
if command -v podman >/dev/null; then
  start_container_engine
fi
forward_published_ports

exec sleep infinity
