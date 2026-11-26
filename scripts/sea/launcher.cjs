const sea = require('node:sea')
const vm = require('node:vm')

const applicationAssetName = 'application'
const loaderWarningMarker = 'USE_MAIN_CONTEXT_DEFAULT_LOADER'

function silenceLoaderWarning() {
  const emitWarning = process.emitWarning
  process.emitWarning = (warning, ...details) => {
    if (String(warning).includes(loaderWarningMarker)) return
    return emitWarning.call(process, warning, ...details)
  }
}

function applicationModuleUrl() {
  const source = sea.getAsset(applicationAssetName, 'utf8')
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
}

function importApplication() {
  const importCall = `import(${JSON.stringify(applicationModuleUrl())})`
  const script = new vm.Script(importCall, {
    importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
  })
  return script.runInThisContext()
}

silenceLoaderWarning()
importApplication().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
