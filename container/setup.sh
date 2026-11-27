#!/usr/bin/env bash
set -uo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: setup.sh <host-home> [module]..." >&2
  exit 1
fi

HOST_HOME=$1
shift
MODULES=("$@")
AMPUL_DIR=$HOME/.ampul
DOTFILES_DIR=$AMPUL_DIR/dotfiles
HOST_DIR=$HOME/.host
GIT_CONFIG_FILE=$HOME/.config/git/config
LOG_FILE=/tmp/ampul/setup.log
FALLBACK_CREDENTIAL_HELPER="cache --timeout=28800"
warnings=()

step() {
  printf '\n==> %s\n' "$1"
}

warn() {
  warnings+=("$1")
  printf 'WARNING: %s\n' "$1" >&2
}

remove_links_to_deleted_config() {
  local link
  find "$HOME" \( -path "$AMPUL_DIR" -o -path "$HOST_DIR" -o -path "$HOME/home" -o -path "$HOME/.cache" -o -path "$HOME/.local" \) -prune \
    -o -xtype l -lname '*.ampul/*' -print0 |
    while IFS= read -r -d '' link; do
      rm "$link"
      rmdir --parents --ignore-fail-on-non-empty "$(dirname "$link")" 2>/dev/null
    done
}

remove_files_in_the_way_of_dotfiles() {
  local relative_path
  while IFS= read -r -d '' relative_path; do
    [ -L "$HOME/$relative_path" ] || rm -f "$HOME/$relative_path"
  done < <(find "$DOTFILES_DIR" ! -type d -printf '%P\0')
}

link_dotfiles() {
  [ -d "$DOTFILES_DIR" ] || return 1
  step "Linking your dotfiles into $HOME"
  remove_links_to_deleted_config
  remove_files_in_the_way_of_dotfiles
  stow --no-folding --dir "$AMPUL_DIR" --target "$HOME" dotfiles >>"$LOG_FILE" 2>&1
}

run_module_setups() {
  local module script
  for module in "${MODULES[@]}"; do
    script=$AMPUL_DIR/modules/$module/setup.sh
    [ -f "$script" ] && . "$script"
  done
}

credential_helper_available() {
  local command=${1%% *}
  case "$command" in
    '' | '!'*) return 0 ;;
    /*) [ -x "$command" ] ;;
    *) [ -x "$(git --exec-path)/git-credential-$command" ] || command -v "git-credential-$command" >/dev/null ;;
  esac
}

credential_section_header() {
  local section=${1%.helper}
  if [ "$section" = credential ]; then
    echo '[credential]'
  else
    echo "[credential \"${section#credential.}\"]"
  fi
}

host_git_configs() {
  local file
  for file in "$HOST_DIR/gitconfig-xdg" "$HOST_DIR/gitconfig"; do
    [ -f "$file" ] && echo "$file"
  done
}

host_credential_helpers() {
  local file
  host_git_configs | while read -r file; do
    git config --file "$file" --get-regexp '^credential\..*helper$'
  done
}

write_credential_helper_overrides() {
  local key value replaced_keys=" "
  while read -r key value; do
    credential_helper_available "$value" && continue
    case "$replaced_keys" in *" $key "*) continue ;; esac
    replaced_keys="$replaced_keys$key "
    credential_section_header "$key"
    printf '\thelper =\n\thelper = %s\n' "$FALLBACK_CREDENTIAL_HELPER"
    warn "The host's git credential helper '$value' does not exist on Linux, so HTTPS credentials are cached in memory for 8 hours instead."
  done < <(host_credential_helpers)
}

link_host_git_config() {
  local file
  [ -n "$(host_git_configs)" ] || return 0
  step "Using the host's git config"
  mkdir -p "$(dirname "$GIT_CONFIG_FILE")"
  {
    host_git_configs | while read -r file; do
      printf '[include]\n\tpath = %s\n' "$file"
    done
    if [ -f "$HOST_DIR/gitignore_global" ]; then
      printf '[core]\n\texcludesfile = %s\n' "$HOST_DIR/gitignore_global"
    fi
    write_credential_helper_overrides
  } >"$GIT_CONFIG_FILE"
}

link_host_ssh() {
  local host_ssh=$HOST_DIR/ssh entry name
  [ -d "$host_ssh" ] || return 0
  step "Using the host's SSH keys and config"
  mkdir -p "$HOME/.ssh"
  chmod 700 "$HOME/.ssh"

  for entry in "$host_ssh"/* "$host_ssh"/.[!.]*; do
    [ -e "$entry" ] || continue
    name=${entry##*/}
    case "$name" in
      config | known_hosts | known_hosts.old | authorized_keys | agent) continue ;;
    esac
    ln -sfn "$entry" "$HOME/.ssh/$name"
  done

  if [ -f "$host_ssh/known_hosts" ]; then
    cat "$host_ssh/known_hosts" "$HOME/.ssh/known_hosts" 2>/dev/null | sort -u >"$HOME/.ssh/known_hosts.merged"
    mv "$HOME/.ssh/known_hosts.merged" "$HOME/.ssh/known_hosts"
    chmod 600 "$HOME/.ssh/known_hosts"
  fi

  if [ -f "$host_ssh/config" ]; then
    {
      echo "IgnoreUnknown UseKeychain"
      sed "s#$HOST_HOME/#$HOME/#g" "$host_ssh/config"
    } >"$HOME/.ssh/config"
    chmod 600 "$HOME/.ssh/config"
  fi
}

mkdir -p "$(dirname "$LOG_FILE")"
: >"$LOG_FILE"

if link_dotfiles; then
  run_module_setups
else
  warn "Your dotfiles could not be linked, so the tools were not set up. See $LOG_FILE."
fi

link_host_git_config || warn "The host's git config could not be linked."
link_host_ssh || warn "The host's SSH keys and config could not be linked."

printf '\n'
if [ ${#warnings[@]} -eq 0 ]; then
  echo "Setup finished."
else
  echo "Setup finished with ${#warnings[@]} warning(s):"
  printf '  - %s\n' "${warnings[@]}"
fi
