import { Box, Text } from 'ink'
import { codeSourceFolderNames, repositoryFolderName } from '../../../projects/codeSources.ts'
import type { ProjectSettings } from '../../../projects/ProjectSettings.ts'
import { homeDirectory } from '../../../system/platform.ts'
import { pluralize } from '../../../text/prose.ts'
import { Bullet, Callout } from '../../../ui/components/Callout.tsx'
import { colors } from '../../../ui/theme.ts'

interface ReadySummaryProps {
  project: ProjectSettings
  unclonedRepositories: string[]
  warnings: string[]
}

export function ReadySummary({ project, unclonedRepositories, warnings }: ReadySummaryProps) {
  const unclonedFolders = new Set(unclonedRepositories.map(repositoryFolderName))
  const codeFolders = codeSourceFolderNames(project.codeSource).filter(
    (folder) => !unclonedFolders.has(folder),
  )
  const needsAttention = warnings.length + unclonedRepositories.length > 0
  return (
    <Callout tone={needsAttention ? 'warning' : 'success'} title={`${project.name} is ready`}>
      {codeFolders.map((folder) => (
        <Bullet key={folder}>Code in ~/work/{folder}</Bullet>
      ))}
      {project.codeSource.kind === 'pass-through' && (
        <Bullet>~/work is your home folder on this machine, {homeDirectory}</Bullet>
      )}
      <Bullet>Every port an app listens on in the container is forwarded to localhost</Bullet>
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
          Connect any time with <Text color={colors.accent}>ampul start {project.name}</Text>
        </Text>
      </Box>
    </Callout>
  )
}
