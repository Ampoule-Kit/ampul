import { PassThrough } from 'node:stream'
import { containerName } from '../containers/naming.ts'
import { ContainerEngine } from '../engine/ContainerEngine.ts'
import { runtimeNames } from '../engine/runtimeNames.ts'
import { ampulSettings } from '../settings/settingsStore.ts'
import { stopRunningProcesses } from '../system/processes.ts'
import { LogFile } from '../tasks/LogFile.ts'
import { claimLock, releaseLock, writeReport } from './forwarderFiles.ts'
import { forwardablePorts, parseListenerReport } from './listeningSockets.ts'
import { PortForwarder, type TunnelEndpoint } from './PortForwarder.ts'
import {
  listenerWatchScript,
  parsePublishedPort,
  tokenFromEnvironment,
  tunnelContainerPort,
} from './tunnel.ts'

export const forwarderCommandName = '__forward-ports'

const retryIntervalMilliseconds = 5000
const exitGraceMilliseconds = 1000
const usageExitCode = 2
const failureExitCode = 1

export async function containerIdOf(
  engine: ContainerEngine,
  projectName: string,
): Promise<string | undefined> {
  const { exitCode, stdout } = await engine.capture([
    'container',
    'inspect',
    '--format',
    '{{.Id}}',
    containerName(projectName),
  ])
  return exitCode === 0 ? stdout.trim() || undefined : undefined
}

async function tunnelEndpoint(engine: ContainerEngine, container: string): Promise<TunnelEndpoint> {
  const published = await engine.capture(['port', container, `${tunnelContainerPort}/tcp`])
  const port = parsePublishedPort(published.stdout)
  if (port === undefined) {
    throw new Error(`The container publishes no tunnel port: ${published.stderr.trim()}`)
  }
  const environment = await engine.capture([
    'container',
    'inspect',
    '--format',
    '{{range .Config.Env}}{{println .}}{{end}}',
    container,
  ])
  const token = tokenFromEnvironment(environment.stdout)
  if (!token) throw new Error('The container has no tunnel token. Rebuild the project.')
  return { host: '127.0.0.1', port, token }
}

function ignoredPorts(): number[] {
  try {
    return ampulSettings().ignoredPorts
  } catch {
    return []
  }
}

function engineFromArguments(runtime: string, executable: string): ContainerEngine | undefined {
  const name = runtimeNames.find((candidate) => candidate === runtime)
  if (!name || !executable) return undefined
  return new ContainerEngine({ name, executable, reason: 'Chosen by the ampul command.' })
}

async function forward(
  engine: ContainerEngine,
  projectName: string,
  log: (message: string) => void,
): Promise<void> {
  const container = containerName(projectName)
  const tunnel = await tunnelEndpoint(engine, container)
  log(`Tunnel on 127.0.0.1:${tunnel.port}`)
  const forwarder = new PortForwarder({
    tunnel,
    onChange: (report) => writeReport(projectName, report),
    log,
  })
  writeReport(projectName, { forwarded: [], unavailable: [] })
  const excluded = new Set([tunnelContainerPort, ...ignoredPorts()])
  const retry = setInterval(() => void forwarder.retryUnavailable(), retryIntervalMilliseconds)
  const watcherInput = new PassThrough()
  const stop = () => {
    watcherInput.end()
    stopRunningProcesses()
  }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  process.on('SIGHUP', () => {})

  const exitCode = await engine.stream(['exec', '--interactive', container, listenerWatchScript], {
    input: watcherInput,
    onLine: (line) => {
      const sockets = parseListenerReport(line)
      if (sockets) void forwarder.update(forwardablePorts(sockets, excluded))
      else if (line.trim()) log(`Watcher: ${line}`)
    },
  })
  log(`The container stopped reporting its ports (exit code ${exitCode})`)
  clearInterval(retry)
  await forwarder.close()
}

export async function runPortForwarder(args: string[]): Promise<number> {
  const [projectName = '', runtime = '', executable = ''] = args
  const engine = engineFromArguments(runtime, executable)
  if (!projectName || !engine) return usageExitCode

  const containerId = await containerIdOf(engine, projectName)
  if (!containerId) return failureExitCode
  if (!claimLock(projectName, containerId)) return 0

  const logFile = new LogFile(projectName, 'ports')
  const log = (message: string) => logFile.write(`${new Date().toISOString()} ${message}\n`)
  try {
    await forward(engine, projectName, log)
    return 0
  } catch (error) {
    log(error instanceof Error ? error.message : String(error))
    return failureExitCode
  } finally {
    releaseLock(projectName)
    setTimeout(() => process.exit(), exitGraceMilliseconds).unref()
  }
}
