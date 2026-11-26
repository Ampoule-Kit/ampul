import {
  type CapturedOutput,
  captureCommand,
  type ProcessOptions,
  runAttachedToTerminal,
  type StreamingOptions,
  streamCommand,
} from '../system/processes.ts'
import { type RuntimeName, type RuntimeSelection, runtimeDisplayNames } from './runtimeSelection.ts'

const reachabilityTimeoutMilliseconds = 20_000

const versionPattern = /version ([\w.+-]+)/i

export class ContainerEngine {
  readonly selection: RuntimeSelection
  private rootlessPodman: boolean | undefined

  constructor(selection: RuntimeSelection) {
    this.selection = selection
  }

  get runtime(): RuntimeName {
    return this.selection.name
  }

  get displayName(): string {
    return runtimeDisplayNames[this.runtime]
  }

  capture(args: string[], options?: ProcessOptions): Promise<CapturedOutput> {
    return captureCommand(this.selection.executable, args, options)
  }

  stream(args: string[], options?: StreamingOptions): Promise<number> {
    return streamCommand(this.selection.executable, args, options)
  }

  attach(args: string[]): Promise<number> {
    return runAttachedToTerminal(this.selection.executable, args)
  }

  async clientVersion(): Promise<string> {
    const { stdout } = await this.capture(['--version'])
    return versionPattern.exec(stdout)?.[1] ?? 'unknown version'
  }

  async reachability(): Promise<{ reachable: boolean; errorOutput: string }> {
    const fieldThatNeedsTheEngine =
      this.runtime === 'podman' ? '{{.Host.Arch}}' : '{{.ServerVersion}}'
    const { exitCode, stderr } = await this.capture(['info', '--format', fieldThatNeedsTheEngine], {
      timeoutMilliseconds: reachabilityTimeoutMilliseconds,
    })
    return { reachable: exitCode === 0, errorOutput: stderr.trim() }
  }

  async isRootlessPodman(): Promise<boolean> {
    if (this.runtime !== 'podman') return false
    if (this.rootlessPodman === undefined) {
      const { stdout } = await this.capture(['info', '--format', '{{.Host.Security.Rootless}}'])
      this.rootlessPodman = stdout.trim() === 'true'
    }
    return this.rootlessPodman
  }
}
