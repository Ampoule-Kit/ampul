import type { ModuleDefinition } from '../modules/ModuleDefinition.ts'

export interface BuildStep {
  number: number
  total: number
  instruction: string
}

const podmanStepPattern = /STEP (\d+)\/(\d+): (.*)$/
const dockerStepPattern = /^#\d+ \[[\w-]*\s+(\d+)\/(\d+)\] (.*)$/
const moduleInstallPattern = /install-module\.sh ([\w-]+)/
const outOfMemoryPattern = /out of memory|signal: killed|exit code: 137/i

export function parseBuildStep(line: string): BuildStep | undefined {
  const match = podmanStepPattern.exec(line) ?? dockerStepPattern.exec(line)
  const [, stepNumber, stepTotal, instruction] = match ?? []
  if (stepNumber === undefined || stepTotal === undefined) return undefined
  return { number: Number(stepNumber), total: Number(stepTotal), instruction: instruction ?? '' }
}

export function isOutOfMemoryMessage(line: string): boolean {
  return outOfMemoryPattern.test(line)
}

export function describeBuildInstruction(
  instruction: string,
  modules: readonly Pick<ModuleDefinition, 'id' | 'label'>[],
): string {
  const installedModuleId = moduleInstallPattern.exec(instruction)?.[1]
  const installedModule = modules.find((module) => module.id === installedModuleId)
  if (installedModule) return `Installing ${installedModule.label}`
  const keyword = instruction.split(' ')[0]?.toUpperCase()
  if (keyword === 'FROM') return 'Preparing the Ubuntu base image'
  if (keyword === 'COPY') return 'Copying the install scripts'
  if (instruction.includes('apt-get install')) return 'Installing the Ubuntu basics'
  if (instruction.includes('create-user.sh')) return 'Creating your user'
  return 'Configuring the image'
}
