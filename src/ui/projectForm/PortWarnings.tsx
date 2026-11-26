import { Box, Text } from 'ink'
import { useMemo } from 'react'
import { formatPortList, privilegedPorts } from '../../projects/ports.ts'
import { listProjects } from '../../projects/projectStore.ts'
import { colors, symbols } from '../theme.ts'

interface PortWarningsProps {
  ports: number[]
  projectName: string
}

function useOtherProjects(projectName: string) {
  return useMemo(
    () => listProjects().filter((project) => project.name !== projectName),
    [projectName],
  )
}

function Warning({ children }: { children: string }) {
  return (
    <Text color={colors.warning}>
      {symbols.warning} {children}
    </Text>
  )
}

export function PortWarnings({ ports, projectName }: PortWarningsProps) {
  const otherProjects = useOtherProjects(projectName)
  const belowPrivilegedLimit = privilegedPorts(ports)
  const sharedWith = otherProjects
    .map((project) => ({
      name: project.name,
      ports: project.ports.filter((port) => ports.includes(port)),
    }))
    .filter((project) => project.ports.length > 0)

  if (belowPrivilegedLimit.length === 0 && sharedWith.length === 0) return null
  return (
    <Box flexDirection="column" marginTop={1}>
      {belowPrivilegedLimit.length > 0 && (
        <Warning>
          {`Rootless Podman refuses ports below 1024 (${formatPortList(belowPrivilegedLimit)}) unless net.ipv4.ip_unprivileged_port_start is lowered on the host or Podman machine.`}
        </Warning>
      )}
      {sharedWith.map((project) => (
        <Warning key={project.name}>
          {`${project.name} also forwards ${formatPortList(project.ports)}. Only one of the two can run at a time.`}
        </Warning>
      ))}
    </Box>
  )
}
