import { Problem, type ProblemFix } from '../problems/Problem.ts'
import { isLinux, isMacOS } from '../system/platform.ts'
import { ContainerEngine } from './ContainerEngine.ts'
import {
  listPodmanMachines,
  mebibytesAsGigabytes,
  type PodmanMachine,
  preferredMachine,
  recommendedMachineMemoryMebibytes,
  usesPodmanMachine,
} from './podmanMachine.ts'
import { selectRuntime } from './runtimeSelection.ts'

export interface EngineRepair {
  offer: string
  progressTitle: string
  command: string[]
}

export type EngineDiagnosis =
  | { ready: true; engine: ContainerEngine }
  | { ready: false; engine: ContainerEngine; problem: Problem; repair?: EngineRepair | undefined }

export function createEngine(): ContainerEngine {
  return new ContainerEngine(selectRuntime())
}

export async function diagnoseEngine(engine: ContainerEngine): Promise<EngineDiagnosis> {
  const { reachable, errorOutput } = await engine.reachability()
  if (reachable) return { ready: true, engine }
  if (usesPodmanMachine(engine)) return diagnosePodmanMachine(engine, errorOutput)
  if (engine.runtime === 'podman') return diagnoseLinuxPodman(engine, errorOutput)
  return diagnoseDocker(engine, errorOutput)
}

const podmanMachineExplanation =
  'On this system Podman runs containers inside a Linux virtual machine, called the Podman machine.'

async function diagnosePodmanMachine(
  engine: ContainerEngine,
  errorOutput: string,
): Promise<EngineDiagnosis> {
  const machine = preferredMachine(await listPodmanMachines(engine))
  if (!machine) return missingMachineDiagnosis(engine)
  if (!machine.isRunning) return stoppedMachineDiagnosis(engine, machine)
  return unreachableMachineDiagnosis(engine, machine, errorOutput)
}

function missingMachineDiagnosis(engine: ContainerEngine): EngineDiagnosis {
  const command = [
    'podman',
    'machine',
    'init',
    '--memory',
    String(recommendedMachineMemoryMebibytes),
    '--now',
  ]
  return {
    ready: false,
    engine,
    problem: new Problem('There is no Podman machine yet', {
      explanation: `${podmanMachineExplanation} None has been created on this machine.`,
      fixes: [
        {
          description: `Create one with ${mebibytesAsGigabytes(recommendedMachineMemoryMebibytes)} of memory and start it`,
          command: command.join(' '),
        },
      ],
    }),
    repair: {
      offer: 'Create and start a Podman machine now',
      progressTitle: 'Creating and starting the Podman machine',
      command,
    },
  }
}

function stoppedMachineDiagnosis(engine: ContainerEngine, machine: PodmanMachine): EngineDiagnosis {
  const command = ['podman', 'machine', 'start', machine.name]
  return {
    ready: false,
    engine,
    problem: new Problem('The Podman machine is not running', {
      explanation: `${podmanMachineExplanation} '${machine.name}' is ${machine.isStarting ? 'still starting' : 'stopped'}.`,
      fixes: [{ description: 'Start it', command: command.join(' ') }],
    }),
    repair: {
      offer: `Start '${machine.name}' now`,
      progressTitle: `Starting the Podman machine '${machine.name}'`,
      command,
    },
  }
}

function unreachableMachineDiagnosis(
  engine: ContainerEngine,
  machine: PodmanMachine,
  errorOutput: string,
): EngineDiagnosis {
  return {
    ready: false,
    engine,
    problem: new Problem('Podman cannot reach its machine', {
      explanation: `The Podman machine '${machine.name}' is running, but Podman cannot connect to it.`,
      outputTail: errorOutput.split('\n'),
      fixes: [
        {
          description: 'Check which connection Podman uses',
          command: 'podman system connection list',
        },
        {
          description: 'Restart the machine',
          command: `podman machine stop ${machine.name} && podman machine start ${machine.name}`,
        },
      ],
    }),
  }
}

function diagnoseLinuxPodman(engine: ContainerEngine, errorOutput: string): EngineDiagnosis {
  return {
    ready: false,
    engine,
    problem: new Problem('Podman is not working', {
      explanation: 'Podman is installed, but `podman info` fails.',
      outputTail: errorOutput.split('\n'),
      fixes: [{ description: 'Run it yourself to see the full error', command: 'podman info' }],
    }),
  }
}

function diagnoseDocker(engine: ContainerEngine, errorOutput: string): EngineDiagnosis {
  const permissionDenied = /permission denied/i.test(errorOutput)
  const fixes: ProblemFix[] = []
  if (isLinux && permissionDenied) {
    fixes.push({
      description: 'Let your user talk to Docker, then log out and back in',
      command: 'sudo usermod -aG docker $USER',
    })
  } else if (isLinux) {
    fixes.push({ description: 'Start the Docker service', command: 'sudo systemctl start docker' })
  } else if (isMacOS) {
    fixes.push(
      { description: 'Open Docker Desktop and wait until it says it is running' },
      { description: 'Or, if you use Colima', command: 'colima start' },
    )
  } else {
    fixes.push({ description: 'Open Docker Desktop and wait until it says it is running' })
  }
  return {
    ready: false,
    engine,
    problem: new Problem(
      permissionDenied ? 'Docker refused the connection' : 'The Docker engine is not running',
      {
        explanation: permissionDenied
          ? 'Docker is running, but your user is not allowed to use it.'
          : 'Docker is installed, but its engine is not reachable.',
        outputTail: errorOutput.split('\n'),
        fixes,
      },
    ),
  }
}
