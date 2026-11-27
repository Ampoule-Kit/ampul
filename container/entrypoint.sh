#!/usr/bin/env bash
set -u

LOG_DIR=/tmp/ampul
MODULES_DIR=/opt/ampul/modules
INSTALLED_MODULES=/opt/ampul/installed-modules

start_ssh_agent() {
  rm -f "$SSH_AUTH_SOCK"
  ssh-agent -a "$SSH_AUTH_SOCK" >/dev/null
}

run_module_start_scripts() {
  local module script
  [ -f "$INSTALLED_MODULES" ] || return 0
  while read -r module; do
    script=$MODULES_DIR/$module/start.sh
    [ -f "$script" ] || continue
    (. "$script") || echo "The start script of $module failed" >>"$LOG_DIR/modules.log"
  done <"$INSTALLED_MODULES"
}

start_port_tunnel() {
  [ -n "${AMPUL_TUNNEL_PORT:-}" ] || return 0
  socat "TCP-LISTEN:$AMPUL_TUNNEL_PORT,fork,reuseaddr" EXEC:/opt/ampul/port-tunnel.sh,nofork >>"$LOG_DIR/port-forwards.log" 2>&1 &
}

mkdir -p "$LOG_DIR"
start_ssh_agent
run_module_start_scripts
start_port_tunnel

exec sleep infinity
