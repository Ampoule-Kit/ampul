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

forward_published_ports() {
  local forward
  for forward in ${AMPUL_PORT_FORWARDS:-}; do
    socat "TCP-LISTEN:${forward#*:},fork,reuseaddr" "TCP:127.0.0.1:${forward%%:*}" >>"$LOG_DIR/port-forwards.log" 2>&1 &
  done
}

mkdir -p "$LOG_DIR"
start_ssh_agent
run_module_start_scripts
forward_published_ports

exec sleep infinity
