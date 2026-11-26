import { Box, Text } from 'ink'
import { createContainer, removeContainer } from '../../containers/containerCreation.js'
import { copyDotfilesIntoContainer, runContainerSetup } from '../../containers/containerSetup.js'
import { buildImage } from '../../containers/imageBuild.js'
import {
  cloneCommand,
  cloneRepositories,
  copyFolderIntoContainer,
} from '../../containers/projectCode.js'
import type { ContainerEngine } from '../../engine/ContainerEngine.js'
import { codeSourceFolderNames, repositoryFolderName } from '../../projects/codeSources.js'
import type { ProjectSettings } from '../../projects/ProjectSettings.js'
import { displayPath } from '../../system/platform.js'
import { LogFile } from '../../tasks/LogFile.js'
import type { Task, TaskRunResult } from '../../tasks/TaskRunner.js'
import { Bullet, Callout } from '../../ui/components/Callout.js'
import { ConfirmPrompt } from '../../ui/components/ConfirmPrompt.js'
import { Question } from '../../ui/components/Question.js'
import { pluralize } from '../../ui/formatting.js'
import { runTasks } from '../../ui/runTasks.js'
import { printElement, showInteractiveScreen } from '../../ui/terminal.js'
import { colors, symbols } from '../../ui/theme.js'
import { openShell } from './containerAccess.js'

export function setupTask(engine: ContainerEngine, project: ProjectSettings): Task {
  return {
    title: 'Set up dotfiles, Neovim, git and SSH',
    run: async (context) => {
      context.detail('Copying the dotfiles in')
      await copyDotfilesIntoContainer(engine, project.name, context)
      await runContainerSetup(engine, project.name, context)
    },
  }
}

function codeTask(engine: ContainerEngine, project: ProjectSettings, failedClones: string[]): Task {
  const source = project.codeSource
  if (source.kind === 'folder') {
    return {
      title: `Copy ${displayPath(source.folder)} into ~/Project`,
      run: (context) => copyFolderIntoContainer(engine, project, source, context),
    }
  }
  return {
    title: `Clone ${pluralize(source.repositories.length, 'repository', 'repositories')} into ~/Project`,
    run: async (context) => {
      const outcome = await cloneRepositories(engine, project, source.repositories, context)
      failedClones.push(...outcome.failedRepositories)
    },
  }
}

async function cloneInTerminal(
  engine: ContainerEngine,
  project: ProjectSettings,
  failedClones: string[],
) {
  const stillFailing: string[] = []
  for (const repository of failedClones) {
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

async function askToRetryClones(failedClones: string[]): Promise<boolean> {
  return showInteractiveScreen<boolean>(
    (finish) => (
      <Question
        title={`${pluralize(failedClones.length, 'repository', 'repositories')} could not be cloned without your input`}
        explanation="git probably needs a password, a token or an SSH key passphrase. Clone them here in the terminal, where git can ask you?"
      >
        <ConfirmPrompt yesLabel="Clone them now" noLabel="Skip" defaultAnswer onAnswer={finish} />
      </Question>
    ),
    () => null,
  )
}

function ReadySummary({
  project,
  unclonedRepositories,
  warnings,
}: {
  project: ProjectSettings
  unclonedRepositories: string[]
  warnings: string[]
}) {
  const folders = codeSourceFolderNames(project.codeSource).filter(
    (folder) => !unclonedRepositories.map(repositoryFolderName).includes(folder),
  )
  return (
    <Callout
      tone={warnings.length + unclonedRepositories.length > 0 ? 'warning' : 'success'}
      title={`${project.name} is ready`}
    >
      {folders.map((folder) => (
        <Bullet key={folder}>Code in ~/Project/{folder}</Bullet>
      ))}
      {project.ports.map((port) => (
        <Bullet key={port}>
          localhost:{port} on this machine reaches port {port} in the container
        </Bullet>
      ))}
      {unclonedRepositories.map((repository) => (
        <Bullet key={repository} color={colors.warning}>
          Not cloned: {repository}. Clone it yourself after connecting.
        </Bullet>
      ))}
      {warnings.length > 0 && (
        <Bullet color={colors.warning}>
          {pluralize(warnings.length, 'setup warning')}, listed above
        </Bullet>
      )}
      <Box marginTop={1}>
        <Text color={colors.muted}>
          Connect any time with <Text color={colors.accent}>dev start {project.name}</Text>
        </Text>
      </Box>
    </Callout>
  )
}

async function offerToConnect(engine: ContainerEngine, project: ProjectSettings): Promise<number> {
  const connect = await showInteractiveScreen<boolean>(
    (finish) => (
      <Question title={`Connect to ${project.name} now?`}>
        <ConfirmPrompt yesLabel="Connect" noLabel="Not now" defaultAnswer onAnswer={finish} />
      </Question>
    ),
    () => null,
  )
  return connect ? openShell(engine, project) : 0
}

export async function buildProject(
  engine: ContainerEngine,
  project: ProjectSettings,
  interactive: boolean,
): Promise<number> {
  const failedClones: string[] = []
  const result: TaskRunResult = await runTasks(
    [
      { title: 'Build the image', run: (context) => buildImage(engine, project, context) },
      {
        title: 'Create the container',
        run: async (context) => {
          await removeContainer(engine, project.name)
          await createContainer(engine, project, context)
        },
      },
      setupTask(engine, project),
      codeTask(engine, project, failedClones),
    ],
    new LogFile(project.name, 'build'),
  )
  if (!result.succeeded && result.problem) throw result.problem

  let unclonedRepositories = failedClones
  if (failedClones.length > 0 && interactive && (await askToRetryClones(failedClones))) {
    unclonedRepositories = await cloneInTerminal(engine, project, failedClones)
  }

  printElement(
    <ReadySummary
      project={project}
      unclonedRepositories={unclonedRepositories}
      warnings={result.warnings}
    />,
  )
  return interactive ? offerToConnect(engine, project) : 0
}
