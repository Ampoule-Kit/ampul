#!/usr/bin/env bash
set -euo pipefail

user_name=$1
user_id=$2
group_id=$3

userdel --remove ubuntu 2>/dev/null || true
existing_group=$(getent group "$group_id" | cut -d: -f1)
if [ -n "$existing_group" ]; then
  groupmod --new-name "$user_name" "$existing_group"
else
  groupadd --gid "$group_id" "$user_name"
fi
useradd --create-home --uid "$user_id" --gid "$group_id" --shell /bin/bash "$user_name"
echo "$user_name ALL=(ALL) NOPASSWD:ALL" >"/etc/sudoers.d/$user_name"
chmod 0440 "/etc/sudoers.d/$user_name"
mkdir -p "/home/$user_name/Project" "/home/$user_name/.cache" "/home/$user_name/.host"
chown -R "$user_id:$group_id" "/home/$user_name"
