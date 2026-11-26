import { Text } from 'ink'
import { cloneCommand } from '../../../containers/projectCode.ts'
import type { ContainerEngine } from '../../../engine/ContainerEngine.ts'
import type { ProjectSettings } from '../../../projects/ProjectSettings.ts'
import { pluralize } from '../../../text/prose.ts'
import { askYesOrNo } from '../../../ui/askYesOrNo.tsx'
import { printElement } from '../../../ui/terminal.tsx'
import { colors, symbols } from '../../../ui/theme.ts'

function askToCloneInTerminal(failedClones: string[]): Promise<boolean> {
  return askYesOrNo({
    title: `${pluralize(failedClones.length, 'repository', 'repositories')} could not be cloned without your input`,
    explanation:
      'git probably needs a password, a token or an SSH key passphrase. Clone them here in the terminal, where git can ask you?',
    yesLabel: 'Clone them now',
    noLabel: 'Skip',
  })
}

async function cloneInTerminal(
  engine: ContainerEngine,
  project: ProjectSettings,
  repositories: string[],
): Promise<string[]> {
  const stillFailing: string[] = []
  for (const repository of repositories) {
    printElement(
      <Text>
        <Text color={colors.accent}>{symbols.arrow}</Text> Cloning <Text bold>{repository}</Text>
        <Text color={colors.muted}> (git may ask you to sign in)</Text>
      </Text>,
    )
    const exitCode = await engine.attach(cloneCommand(project.name, repository, true))
    if (exitCode !== 0) stillFailing.push(repository)
  }
  return stillFailing
}

export async function retryFailedClones(
  engine: ContainerEngine,
  project: ProjectSettings,
  failedClones: string[],
  interactive: boolean,
): Promise<string[]> {
  if (failedClones.length === 0 || !interactive) return failedClones
  if (!(await askToCloneInTerminal(failedClones))) return failedClones
  return cloneInTerminal(engine, project, failedClones)
}
