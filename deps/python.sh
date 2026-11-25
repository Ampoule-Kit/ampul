#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"

apt-get update
apt-get install -y --no-install-recommends python3 python3-dev python3-pip python3-venv
rm -rf /var/lib/apt/lists/*
