import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'
import { inject } from 'postject'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDirectory = path.join(repositoryRoot, 'dist')
const workDirectory = path.join(distDirectory, 'build')
const isWindows = process.platform === 'win32'
const isMacOS = process.platform === 'darwin'

const binaryPath = path.join(distDirectory, isWindows ? 'dev.exe' : 'dev')

const embeddedFolders = ['image', 'container', 'dotfiles']
const embeddedFiles = ['.dockerignore']
const seaFuse = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'

async function bundleApplication() {
  const outfile = path.join(workDirectory, 'devenv.mjs')
  await esbuild.build({
    entryPoints: [path.join(repositoryRoot, 'src', 'main.tsx')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    jsx: 'automatic',
    minify: true,
    legalComments: 'none',
    logLevel: 'warning',
    alias: {
      'react-devtools-core': path.join(repositoryRoot, 'scripts', 'sea', 'react-devtools-core.js'),
    },
    define: { 'process.env.DEV': '"false"', 'process.env.NODE_ENV': '"production"' },
    banner: {
      js: "import { createRequire as createRequireForBundle } from 'node:module'; const require = createRequireForBundle(process.execPath);",
    },
  })
  return outfile
}

function filesUnder(folder) {
  return fs
    .readdirSync(path.join(repositoryRoot, folder), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(repositoryRoot, path.join(entry.parentPath, entry.name)))
}

function collectResources() {
  const relativePaths = [...embeddedFolders.flatMap(filesUnder), ...embeddedFiles].sort()
  const fingerprint = createHash('sha256')
  const files = relativePaths.map((relativePath) => {
    const absolutePath = path.join(repositoryRoot, relativePath)
    const content = fs.readFileSync(absolutePath)
    fingerprint.update(relativePath).update(content)
    return {
      path: relativePath.split(path.sep).join('/'),
      mode: fs.statSync(absolutePath).mode & 0o777,
      content: content.toString('base64'),
    }
  })
  const outfile = path.join(workDirectory, 'resources.json')
  fs.writeFileSync(
    outfile,
    JSON.stringify({ fingerprint: fingerprint.digest('hex').slice(0, 16), files }),
  )
  return outfile
}

function prepareSeaBlob(applicationBundle, resourcesFile) {
  const configFile = path.join(workDirectory, 'sea-config.json')
  const blobFile = path.join(workDirectory, 'sea.blob')
  fs.writeFileSync(
    configFile,
    JSON.stringify({
      main: path.join(repositoryRoot, 'scripts', 'sea', 'launcher.cjs'),
      output: blobFile,
      disableExperimentalSEAWarning: true,
      useCodeCache: false,
      assets: { application: applicationBundle, resources: resourcesFile },
    }),
  )
  execFileSync(process.execPath, ['--experimental-sea-config', configFile], { stdio: 'pipe' })
  return blobFile
}

async function writeBinary(blobFile) {
  fs.rmSync(binaryPath, { force: true })
  fs.copyFileSync(process.execPath, binaryPath)
  fs.chmodSync(binaryPath, 0o755)
  if (isMacOS) execFileSync('codesign', ['--remove-signature', binaryPath], { stdio: 'pipe' })
  await inject(binaryPath, 'NODE_SEA_BLOB', fs.readFileSync(blobFile), {
    sentinelFuse: seaFuse,
    machoSegmentName: isMacOS ? 'NODE_SEA' : undefined,
  })
  if (isMacOS) execFileSync('codesign', ['--sign', '-', binaryPath], { stdio: 'pipe' })
}

async function build() {
  fs.rmSync(workDirectory, { recursive: true, force: true })
  fs.mkdirSync(workDirectory, { recursive: true })
  const applicationBundle = await bundleApplication()
  const resourcesFile = collectResources()
  const blobFile = prepareSeaBlob(applicationBundle, resourcesFile)
  await writeBinary(blobFile)
  const megabytes = (fs.statSync(binaryPath).size / 1024 / 1024).toFixed(0)
  console.log(
    `Built ${path.relative(repositoryRoot, binaryPath)} for ${process.platform}-${process.arch} (${megabytes} MB)`,
  )
}

await build()
