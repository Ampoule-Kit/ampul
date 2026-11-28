// Modules that ampul 1.x had on their own, which are now versions of one module.
const legacyModuleVersions: Record<string, { moduleId: string; versionId: string }> = {
  'dotnet-11': { moduleId: 'dotnet', versionId: '11' },
  'dotnet-10': { moduleId: 'dotnet', versionId: '10' },
  'dotnet-8': { moduleId: 'dotnet', versionId: '8' },
  'dotnet-6': { moduleId: 'dotnet', versionId: '6' },
  'godot-dotnet': { moduleId: 'godot', versionId: '4.7-dotnet' },
}

export interface StoredModuleSelection {
  modules: string[]
  moduleVersions: Record<string, string[]>
}

export function withoutLegacyModules<Selection extends StoredModuleSelection>(
  selection: Selection,
): Selection {
  if (!selection.modules.some((id) => id in legacyModuleVersions)) return selection
  const modules: string[] = []
  const moduleVersions = { ...selection.moduleVersions }
  for (const id of selection.modules) {
    const replacement = legacyModuleVersions[id]
    const moduleId = replacement?.moduleId ?? id
    if (!modules.includes(moduleId)) modules.push(moduleId)
    if (replacement) {
      const versions = moduleVersions[moduleId] ?? []
      if (!versions.includes(replacement.versionId)) {
        moduleVersions[moduleId] = [...versions, replacement.versionId]
      }
    }
  }
  return { ...selection, modules, moduleVersions }
}
