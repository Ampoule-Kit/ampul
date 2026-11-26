local function is_godot_metadata(name)
	return name:match "%.import$" ~= nil or name:match "%.uid$" ~= nil
end

local function is_dotnet_build_output(path, name)
	return (name == "bin" or name == "obj") and vim.fn.isdirectory(path) == 1
end

local function is_hidden_in_file_tree(path)
	local name = vim.fs.basename(path)
	return name == ".git" or name == ".DS_Store" or is_godot_metadata(name) or is_dotnet_build_output(path, name)
end

local function load_treesitter_theme()
	pcall(function()
		dofile(vim.g.base46_cache .. "syntax")
		dofile(vim.g.base46_cache .. "treesitter")
	end)
end

local function highlight_with_treesitter(filetypes)
	vim.api.nvim_create_autocmd("FileType", {
		pattern = filetypes,
		callback = function(args)
			pcall(vim.treesitter.start, args.buf)
		end,
	})
end

return {
	{
		"stevearc/conform.nvim",
		opts = require "configs.conform",
	},

	{
		"neovim/nvim-lspconfig",
		dependencies = { "Hoffs/omnisharp-extended-lsp.nvim" },
		config = function()
			require "configs.lspconfig"
		end,
	},

	{
		"nvim-tree/nvim-tree.lua",
		opts = {
			filters = {
				custom = is_hidden_in_file_tree,
			},
			view = {
				width = { min = 40 },
			},
		},
	},

	{
		"nvim-treesitter/nvim-treesitter",
		branch = "main",
		lazy = false,
		build = ":TSUpdate",
		config = function()
			load_treesitter_theme()
			require("nvim-treesitter").install(require("language_tools").treesitter_parsers)
			highlight_with_treesitter { "cs", "javascript", "typescript", "typescriptreact", "lua", "vim" }
		end,
	},
}
