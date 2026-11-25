require("nvchad.configs.lspconfig").defaults()

local servers = { "ts_ls", "eslint", "omnisharp" }

local function fix_eslint_problems_on_save()
	local default_on_attach = vim.lsp.config.eslint.on_attach
	vim.lsp.config("eslint", {
		on_attach = function(client, buffer)
			if default_on_attach then
				default_on_attach(client, buffer)
			end
			vim.api.nvim_create_autocmd("BufWritePre", {
				buffer = buffer,
				command = "LspEslintFixAll",
			})
		end,
	})
end

local function configure_omnisharp()
	vim.lsp.config("omnisharp", {
		settings = {
			FormattingOptions = {
				EnableEditorConfigSupport = true,
				OrganizeImports = false,
			},
			MsBuild = {
				LoadProjectsOnDemand = false,
			},
			RoslynExtensionsOptions = {
				EnableAnalyzersSupport = true,
				EnableImportCompletion = false,
				AnalyzeOpenDocumentsOnly = false,
			},
			Sdk = {
				IncludePrereleases = true,
			},
		},
	})
end

local function navigate_into_decompiled_sources_with_omnisharp()
	vim.api.nvim_create_autocmd("LspAttach", {
		callback = function(args)
			local client = vim.lsp.get_client_by_id(args.data.client_id)
			if not client or client.name ~= "omnisharp" then
				return
			end

			local omnisharp_extended = require "omnisharp_extended"
			local function map(keys, action, description)
				vim.keymap.set("n", keys, action, { buffer = args.buf, desc = "LSP " .. description })
			end

			map("gd", omnisharp_extended.lsp_definition, "Go to definition")
			map("<leader>D", omnisharp_extended.lsp_type_definition, "Go to type definition")
			map("gr", omnisharp_extended.lsp_references, "Go to references")
			map("gi", omnisharp_extended.lsp_implementation, "Go to implementation")
		end,
	})
end

fix_eslint_problems_on_save()
configure_omnisharp()
navigate_into_decompiled_sources_with_omnisharp()
vim.lsp.enable(servers)
