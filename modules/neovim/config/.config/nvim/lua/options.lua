require "nvchad.options"

local osc52 = require "vim.ui.clipboard.osc52"

local function paste_from_unnamed_register()
	return { vim.fn.split(vim.fn.getreg "", "\n"), vim.fn.getregtype "" }
end

vim.g.clipboard = {
	name = "OSC 52",
	copy = { ["+"] = osc52.copy "+", ["*"] = osc52.copy "*" },
	paste = { ["+"] = paste_from_unnamed_register, ["*"] = paste_from_unnamed_register },
}

vim.o.expandtab = false
vim.o.shiftwidth = 4
vim.o.smartindent = true
vim.o.tabstop = 4
vim.o.softtabstop = 4
