import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { downloadUrl, type VersionedModule } from '../../src/modules/downloadUrls.ts'
import {
  type Architecture,
  type ModuleDownload,
  supportedArchitectures,
} from '../../src/modules/moduleSchema.ts'

export type DownloadedFiles = Record<Architecture, string>

const githubReleaseAsset =
  /^https:\/\/github\.com\/([^/]+\/[^/]+)\/releases\/download\/([^/]+)\/([^/]+)$/
const githubReleaseSchema = z.object({
  assets: z.array(z.object({ name: z.string(), digest: z.string().nullish() })),
})
const sha256DigestPrefix = 'sha256:'
const cachePrefixLength = 12

function sha256Of(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

async function downloadToFile(url: string, downloadDirectory: string): Promise<string> {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`Could not download ${url}: HTTP ${response.status}`)
  const content = Buffer.from(await response.arrayBuffer())
  if (content.length === 0) throw new Error(`${url} downloaded as an empty file`)
  const urlFingerprint = sha256Of(Buffer.from(url)).slice(0, cachePrefixLength)
  const file = path.join(
    downloadDirectory,
    `${urlFingerprint}-${path.basename(new URL(url).pathname)}`,
  )
  fs.mkdirSync(downloadDirectory, { recursive: true })
  fs.writeFileSync(file, content)
  return file
}

async function githubPublishedSha256(url: string): Promise<string | undefined> {
  const [, repository, tag, assetName] = githubReleaseAsset.exec(url) ?? []
  if (!repository || !tag || !assetName) return undefined
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/tags/${tag}`)
  if (!response.ok) return undefined
  const release = githubReleaseSchema.safeParse(await response.json())
  if (!release.success) return undefined
  const digest = release.data.assets.find((asset) => asset.name === assetName)?.digest
  return digest?.startsWith(sha256DigestPrefix)
    ? digest.slice(sha256DigestPrefix.length)
    : undefined
}

async function verifyAgainstPublishedChecksum(url: string, sha256: string): Promise<void> {
  const published = await githubPublishedSha256(url)
  if (published === undefined) {
    console.log('    no published checksum to compare against')
  } else if (published === sha256) {
    console.log('    matches the checksum GitHub publishes')
  } else {
    throw new Error(`The checksum does not match: GitHub publishes ${published}`)
  }
}

export async function pinDownload(
  module: VersionedModule,
  download: ModuleDownload,
  downloadDirectory: string,
): Promise<{ pinned: ModuleDownload; files: DownloadedFiles }> {
  const checksums: Partial<Record<Architecture, string>> = {}
  const files: Partial<DownloadedFiles> = {}
  for (const architecture of supportedArchitectures) {
    const url = downloadUrl(module, download, architecture)
    console.log(`  ${architecture}: ${url}`)
    const file = await downloadToFile(url, downloadDirectory)
    const sha256 = sha256Of(fs.readFileSync(file))
    console.log(`    sha256 ${sha256}`)
    await verifyAgainstPublishedChecksum(url, sha256)
    checksums[architecture] = sha256
    files[architecture] = file
  }
  const { sha512: _replacedChecksum, ...downloadWithoutChecksums } = download
  return {
    pinned: {
      ...downloadWithoutChecksums,
      sha256: { arm64: checksums.arm64 ?? '', amd64: checksums.amd64 ?? '' },
    },
    files: { arm64: files.arm64 ?? '', amd64: files.amd64 ?? '' },
  }
}
