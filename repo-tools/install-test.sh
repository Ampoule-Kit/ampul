INSTALL_TEST_IMAGE=devenv-install-test-base
INSTALL_TEST_CACHE_VOLUME=devenv-install-test-cache

build_install_test_base() {
  local ubuntu_image=$1
  echo "==> Building the base image to test installs in"
  "$RUNTIME" build --quiet \
    --file "$REPO_DIR/image/Containerfile" \
    --target base \
    --tag "$INSTALL_TEST_IMAGE" \
    --label devenv.cache=true \
    --build-arg "UBUNTU_IMAGE=$ubuntu_image" \
    "$REPO_DIR" >/dev/null
}

stage_image_files() {
  local staging_dir=$1 versions_file=$2
  rm -rf "$staging_dir"
  mkdir -p "$staging_dir"
  cp -R "$REPO_DIR/image/tools" "$REPO_DIR/image/install-helpers.sh" "$REPO_DIR/image/download-urls.sh" "$staging_dir/"
  cp "$versions_file" "$staging_dir/versions"
}

run_install_test() {
  local staging_dir=$1 install_command=$2 check_command=${3:-}
  local test_script="/opt/devenv/tools/$install_command"
  [ -n "$check_command" ] && test_script="$test_script && $check_command"
  echo "==> Testing: $install_command${check_command:+, then $check_command}"
  "$RUNTIME" volume inspect "$INSTALL_TEST_CACHE_VOLUME" >/dev/null 2>&1 ||
    "$RUNTIME" volume create --label devenv.cache=true "$INSTALL_TEST_CACHE_VOLUME" >/dev/null
  if ! "$RUNTIME" run --rm \
    --security-opt label=disable \
    --volume "$staging_dir:/opt/devenv:ro" \
    --volume "$INSTALL_TEST_CACHE_VOLUME:/var/cache/devenv" \
    "$INSTALL_TEST_IMAGE" bash -c "$test_script" >"$staging_dir.log" 2>&1; then
    echo "The install test failed. Its output:" >&2
    tail -25 "$staging_dir.log" >&2
    return 1
  fi
  echo "    passed"
}
