wheels=/opt/ansible-wheels
ansible_wheel=$wheels/ansible-$(jq -r .version "$MODULE_FILE")-py3-none-any.whl
core_wheel=$wheels/ansible_core-$(jq -r '.downloads[] | select(.name == "core") | .version' "$MODULE_FILE")-py3-none-any.whl
mv "$wheels/ansible.whl" "$ansible_wheel"
mv "$wheels/ansible-core.whl" "$core_wheel"
UV_PYTHON_INSTALL_DIR=/opt/ansible/python UV_TOOL_DIR=/opt/ansible/tools UV_TOOL_BIN_DIR=/usr/local/bin \
  UV_CACHE_DIR=/var/cache/ampul/uv \
  uv tool install --managed-python --python 3.14 --with "$ansible_wheel" "$core_wheel"
rm -rf "$wheels"
