step "Installing the Neovim plugins pinned in lazy-lock.json"
if ! nvim --headless "+Lazy! restore" "+Lazy! clean" "+Lazy! build base46" +qa >>"$LOG_FILE" 2>&1; then
  warn "Neovim plugins did not install cleanly. See $LOG_FILE, then run :Lazy restore in Neovim."
fi

step "Installing language servers, formatters and treesitter parsers"
if ! nvim --headless "+lua require('language_tools').install_all_then_quit()" 2>>"$LOG_FILE" | tee -a "$LOG_FILE"; then
  warn "Some Neovim tools did not install (listed above). See $LOG_FILE, then run :Mason in Neovim."
fi
