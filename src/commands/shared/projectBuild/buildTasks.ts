import { createContainer, removeContainer } from '../../../containers/containerCreation.ts'
import { copyConfigIntoContainer, runContainerSetup } from '../../../containers/containerSetup.ts'
import { buildImage } from '../../../containers/imageBuild.ts'
import { cloneRepositories, copyFolderIntoContainer } from '../../../containers/projectCode.ts'
import type { ContainerEngine } from '../../../engine/ContainerEngine.ts'
import type { ProjectSettings } from '../../../projects/ProjectSettings.ts'
import { displayPath } from '../../../system/platform.ts'
import type { Task } from '../../../tasks/TaskRunner.ts'
import { pluralize } from '../../../text/prose.ts'

export function imageTask(engine: ContainerEngine, project: ProjectSettings): Task {
  return { title: 'Build the image', run: (context) => buildImage(engine, project, context) }
}

export function containerTask(engine: ContainerEngine, project: ProjectSettings): Task {
  return {
    title: 'Create the container',
    run: async (context) => {
      await removeContainer(engine, project.name)
      await createContainer(engine, project, context)
    },
  }
}

export function setupTask(engine: ContainerEngine, project: ProjectSettings): Task {
  return {
    title: 'Set up your dotfiles, tools, git and SSH',
    run: async (context) => {
      context.detail('Copying the dotfiles and tool config in')
      await copyConfigIntoContainer(engine, project, context)
      await runContainerSetup(engine, project, context)
    },
  }
}

export function codeTask(
  engine: ContainerEngine,
  project: ProjectSettings,
  onCloneFailures: (repositories: string[]) => void,
): Task {
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
      onCloneFailures(outcome.failedRepositories)
    },
  }
}
