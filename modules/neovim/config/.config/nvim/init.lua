vim.g.base46_cache = vim.fn.stdpath "data" .. "/base46/"
vim.g.mapleader = " "

local function install_lazy_if_missing(lazy_path)
	if not vim.uv.fs_stat(lazy_path) then
		local repository = "https://github.com/folke/lazy.nvim.git"
		vim.fn.system { "git", "clone", "--filter=blob:none", repository, "--branch=stable", lazy_path }
	end
end

local lazy_path = vim.fn.stdpath "data" .. "/lazy/lazy.nvim"
install_lazy_if_missing(lazy_path)
vim.opt.rtp:prepend(lazy_path)

require("lazy").setup({
	{
		"NvChad/NvChad",
		lazy = false,
		branch = "v2.5",
		import = "nvchad.plugins",
	},

	{ import = "plugins" },
}, require "configs.lazy")

dofile(vim.g.base46_cache .. "defaults")
dofile(vim.g.base46_cache .. "statusline")

require "options"
require "autocmds"

vim.schedule(function()
	require "mappings"
end)
