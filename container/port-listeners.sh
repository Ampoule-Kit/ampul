#!/usr/bin/env bash
# Reports the TCP sockets listening in the container, as hex address:port entries from
# /proc/net/tcp and /proc/net/tcp6, once at the start and again whenever they change.
# ampul on the host reads the reports to forward each port. It runs until its input closes,
# which happens when the ampul process that started it ends.
set -u

previous=
while :; do
  current=$(cat /proc/net/tcp /proc/net/tcp6 2>/dev/null | awk '$4 == "0A" { print $2 }' | sort -u | tr '\n' ' ')
  if [ "$current" != "$previous" ]; then
    echo "listening $current" || exit 0
    previous=$current
  fi
  read -r -t 1 _
  [ $? -gt 128 ] || exit 0
done
