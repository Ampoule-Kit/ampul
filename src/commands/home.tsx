import type { CommandDefinition, Invocation } from '../cli/CommandDefinition.ts'
import { allContainerStates } from '../containers/containerState.ts'
import { listProjects } from '../projects/projectStore.ts'
import { type HomeAction, type HomeChoice, HomeScreen } from '../ui/screens/HomeScreen.tsx'
import { showInteractiveScreen } from '../ui/terminal.tsx'
import { configCommand } from './config.tsx'
import { newProjectCommand } from './newProject.tsx'
import { rebuildCommand } from './rebuild.tsx'
import { removeCommand } from './remove.tsx'
import { connectToEngine } from './shared/engineConnection.tsx'
import { describeRuntime } from './shared/runtimeDescription.ts'
import { startCommand } from './start.tsx'
import { stopCommand } from './stop.tsx'

const commandsByAction: Record<Exclude<HomeAction, 'quit'>, CommandDefinition> = {
  start: startCommand,
  stop: stopCommand,
  rebuild: rebuildCommand,
  config: configCommand,
  rm: removeCommand,
  new: newProjectCommand,
}

const actionsThatReturnHome = new Set<HomeAction>(['stop'])

export async function runHome(): Promise<number> {
  const engine = await connectToEngine(true)
  const runtimeDescription = await describeRuntime(engine)

  while (true) {
    const projects = listProjects()
    const states = await allContainerStates(engine)
    const choice = await showInteractiveScreen<HomeChoice>(
      (finish) => (
        <HomeScreen
          projects={projects}
          states={states}
          runtimeDescription={runtimeDescription}
          finish={finish}
        />
      ),
      () => null,
    )
    if (choice.action === 'quit') return 0

    const invocation: Invocation = {
      positionals: choice.projectName ? [choice.projectName] : [],
      flags: new Set(),
      interactive: true,
    }
    const exitCode = (await commandsByAction[choice.action].run(invocation)) ?? 0
    if (!actionsThatReturnHome.has(choice.action)) return exitCode
  }
}
