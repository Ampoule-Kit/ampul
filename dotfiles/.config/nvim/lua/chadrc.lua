local M = {}

M.base46 = {
	theme = "catppuccin",
}

-- mason-registry's omnisharp v2.0.0 entry points at -net6.0 assets that release no longer ships
M.mason = {
	pkgs = { "omnisharp@v1.39.15" },
	skip = { "omnisharp" },
}

return M
