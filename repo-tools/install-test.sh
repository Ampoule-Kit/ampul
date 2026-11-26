INSTALL_TEST_IMAGE=devenv-install-test-base
INSTALL_TEST_CACHE_VOLUME=devenv-install-test-cache

base_image() {
  jq -r .image "$REPO_DIR/image/base-image.json"
}

build_install_test_base() {
  local ubuntu_image=$1
  echo "==> Building the base image to test installs in"
  "$RUNTIME" build --quiet \
    --file "$REPO_DIR/image/base.Containerfile" \
    --target base \
    --tag "$INSTALL_TEST_IMAGE" \
    --label devenv.cache=true \
    --build-arg "UBUNTU_IMAGE=$ubuntu_image" \
    "$REPO_DIR" >/dev/null
}

stage_modules_for_test() {
  local staging_dir=$1 id
  shift
  rm -rf "$staging_dir"
  mkdir -p "$staging_dir/modules"
  cp "$REPO_DIR"/image/install-helpers.sh "$REPO_DIR"/image/module-downloads.sh "$REPO_DIR"/image/install-module.sh "$staging_dir/"
  for id in "$@"; do
    [ -d "$REPO_DIR/modules/$id" ] && cp -R "$REPO_DIR/modules/$id" "$staging_dir/modules/$id"
  done
}

module_environment() {
  jq -r '
    ((.environment // {}) | to_entries[] | "export \(.key)=\(.value | gsub("\\{home\\}"; "/root") | @sh)"),
    ((.path // []) | if length > 0 then "export PATH=\(map(gsub("\\{home\\}"; "/root")) | join(":") | @sh):$PATH" else empty end)
  ' "$1" | paste -sd ';' -
}

run_install_test() {
  local staging_dir=$1 check_command=$2 test_script="" id environment
  shift 2
  for id in "$@"; do
    test_script="$test_script/opt/devenv/install-module.sh $id && "
    environment=$(module_environment "$staging_dir/modules/$id/module.json")
    [ -n "$environment" ] && test_script="$test_script$environment; "
  done
  test_script="$test_script$check_command"
  echo "==> Testing: installing $*, then $check_command"
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
