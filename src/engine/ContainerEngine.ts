import {
  captureCommand,
  runAttachedToTerminal,
  streamCommand,
  type CapturedOutput,
  type ProcessOptions,
  type StreamingOptions,
} from '../system/processes.js'
import { runtimeDisplayNames, type RuntimeName, type RuntimeSelection } from './runtimeSelection.js'

const reachabilityTimeoutMilliseconds = 20_000

export class ContainerEngine {
  private rootlessPodman: boolean | undefined

  constructor(readonly selection: RuntimeSelection) {}

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
    return stdout.match(/version ([\w.+-]+)/i)?.[1] ?? 'unknown version'
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
