#!/usr/bin/env bash
# Joins one connection from ampul on the host to a port inside the container. socat starts
# it for each connection to the tunnel port, with the connection as stdin and stdout. The
# first line names the target as "<token> <port> <address>"; the rest is passed through.
# bash reads a socket one byte at a time, so nothing after that line is lost.
set -u

IFS=' ' read -r -t 10 token port address || exit 0
[ -n "${AMPUL_TUNNEL_TOKEN:-}" ] && [ "$token" = "$AMPUL_TUNNEL_TOKEN" ] || exit 0
case $port in '' | *[!0-9]*) exit 0 ;; esac

case $address in
  127.0.0.1) exec socat STDIO "TCP4:127.0.0.1:$port" ;;
  ::1) exec socat STDIO "TCP6:[::1]:$port" ;;
esac
