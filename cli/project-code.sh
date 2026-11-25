keep_existing_paths() {
  local path
  while IFS= read -r -d '' path; do
    if [ -e "$path" ] || [ -L "$path" ]; then
      printf '%s\0' "$path"
    fi
  done
}

git_files_to_copy() {
  printf '.git\0'
  git ls-files -z --cached --others --exclude-standard | keep_existing_paths
}

clone_repositories() {
  local url folder_name failed=""
  for url in $REPOSITORIES; do
    folder_name=$(repository_folder_name "$url")
    echo "==> Cloning $url into ~/Project/$folder_name"
    exec_in_container --workdir "$CONTAINER_PROJECT_DIR" "$(container_name "$PROJECT_NAME")" \
      git clone "$url" "$folder_name" || failed="$failed $url"
  done
  if [ -n "$failed" ]; then
    echo "WARNING: Could not clone:$failed" >&2
    echo "Clone them yourself after: dev enter $PROJECT_NAME" >&2
  fi
}

copy_folder() {
  local folder_name
  folder_name=$(basename "$COPY_FOLDER")
  echo "==> Copying $COPY_FOLDER into ~/Project/$folder_name"
  (
    cd "$COPY_FOLDER" || exit 1
    if [ -n "$COPY_GIT_FILES_ONLY" ]; then
      git_files_to_copy | host_tar --null -T - -cf -
    else
      host_tar -cf - .
    fi
  ) | replace_container_folder_with_archive "$CONTAINER_PROJECT_DIR/$folder_name"
}

fetch_project_code() {
  case "$CODE_SOURCE" in
    repositories) clone_repositories ;;
    copy) copy_folder || echo "WARNING: Copying $COPY_FOLDER did not finish. Rerun with: dev rebuild $PROJECT_NAME" >&2 ;;
  esac
}
