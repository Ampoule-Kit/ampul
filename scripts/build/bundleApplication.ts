import path from 'node:path'
import * as esbuild from 'esbuild'
import { repositoryRoot } from '../shared/repository.ts'

const developmentOnlyPackages = /^react-devtools-core$/
const emptyModuleNamespace = 'empty-module'

const leaveOutDevelopmentOnlyPackages: esbuild.Plugin = {
  name: 'leave-out-development-only-packages',
  setup(build) {
    build.onResolve({ filter: developmentOnlyPackages }, (resolved) => ({
      path: resolved.path,
      namespace: emptyModuleNamespace,
    }))
    build.onLoad({ filter: /.*/, namespace: emptyModuleNamespace }, () => ({
      contents: 'export default {}',
      loader: 'js',
    }))
  },
}

const requireForBundledCommonJs =
  "import { createRequire as createRequireForBundle } from 'node:module'; const require = createRequireForBundle(process.execPath);"

export async function bundleApplication(outputDirectory: string): Promise<string> {
  const bundleFile = path.join(outputDirectory, 'devenv.mjs')
  await esbuild.build({
    entryPoints: [path.join(repositoryRoot, 'src', 'main.tsx')],
    outfile: bundleFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node26',
    jsx: 'automatic',
    minify: true,
    legalComments: 'none',
    logLevel: 'warning',
    plugins: [leaveOutDevelopmentOnlyPackages],
    define: { 'process.env.DEV': '"false"', 'process.env.NODE_ENV': '"production"' },
    banner: { js: requireForBundledCommonJs },
  })
  return bundleFile
}
