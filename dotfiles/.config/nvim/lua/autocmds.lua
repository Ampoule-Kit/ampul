require "nvchad.autocmds"

vim.api.nvim_create_autocmd("User", {
	pattern = "VeryLazy",
	once = true,
	callback = require("language_tools").install_missing_in_background,
})
