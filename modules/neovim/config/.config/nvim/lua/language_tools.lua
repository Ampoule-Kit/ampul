local M = {}

local INSTALL_TIMEOUT_MS = 20 * 60 * 1000

M.treesitter_parsers = {
	"lua",
	"luadoc",
	"printf",
	"vim",
	"vimdoc",
	"javascript",
	"typescript",
	"tsx",
	"c_sharp",
}

local function mason_packages_of_configured_servers_and_formatters()
	require("lazy").load { plugins = { "nvim-lspconfig", "conform.nvim", "mason.nvim" } }

	local packages = {}
	for _, tool in ipairs(require("nvchad.mason").get_pkgs()) do
		local name, version = tool:match "^([^@]+)@?(.*)$"
		table.insert(packages, { name = name, version = version ~= "" and version or nil })
	end
	return packages
end

function M.install_missing_in_background()
	local packages = mason_packages_of_configured_servers_and_formatters()
	local registry = require "mason-registry"

	registry.refresh(function()
		for _, package in ipairs(packages) do
			local mason_package = registry.get_package(package.name)
			if not mason_package:is_installed() and not mason_package:is_installing() then
				vim.notify("Mason: installing " .. package.name)
				mason_package:install { version = package.version }
			end
		end
	end)
end

local function refresh_mason_registry_and_wait(registry)
	local refreshed = false
	registry.refresh(function()
		refreshed = true
	end)
	vim.wait(INSTALL_TIMEOUT_MS, function()
		return refreshed
	end, 200)
end

local function install_mason_packages_and_wait()
	local registry = require "mason-registry"
	local failed, pending = {}, {}

	refresh_mason_registry_and_wait(registry)

	registry:on("package:install:success", function(mason_package)
		pending[mason_package.name] = nil
	end)
	registry:on("package:install:failed", function(mason_package)
		pending[mason_package.name] = nil
		table.insert(failed, mason_package.name)
	end)

	for _, package in ipairs(mason_packages_of_configured_servers_and_formatters()) do
		local found, mason_package = pcall(registry.get_package, package.name)
		if not found then
			table.insert(failed, package.name .. " (not in the Mason registry)")
		elseif not mason_package:is_installed() then
			pending[package.name] = true
			mason_package:install { version = package.version }
		end
	end

	vim.wait(INSTALL_TIMEOUT_MS, function()
		return next(pending) == nil
	end, 500)
	for name in pairs(pending) do
		table.insert(failed, name .. " (timed out)")
	end
	return failed
end

local function install_treesitter_parsers_and_wait()
	local completed, all_installed = pcall(function()
		return require("nvim-treesitter").install(M.treesitter_parsers):wait(INSTALL_TIMEOUT_MS)
	end)
	if completed and all_installed then
		return {}
	end
	return { "treesitter parsers (run :TSInstall " .. table.concat(M.treesitter_parsers, " ") .. ")" }
end

function M.install_all_then_quit()
	local failed = vim.list_extend(install_mason_packages_and_wait(), install_treesitter_parsers_and_wait())
	for _, name in ipairs(failed) do
		io.stdout:write("Failed to install: " .. name .. "\n")
	end
	vim.cmd(#failed == 0 and "qall!" or "cquit! 1")
end

return M
