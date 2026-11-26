import { Box, Text } from 'ink'
import type { CommandDefinition } from '../../cli/CommandDefinition.ts'
import { Header } from '../../ui/components/Header.tsx'
import { printElement } from '../../ui/terminal.tsx'
import { colorOrTerminalDefault, colors, symbols } from '../../ui/theme.ts'
import { withSpinner } from '../../ui/withSpinner.tsx'
import { type HealthCheck, type HealthStatus, runHealthChecks } from './healthChecks.ts'

const statusStyles: Record<HealthStatus, { symbol: string; color: string }> = {
  pass: { symbol: symbols.success, color: colors.success },
  warn: { symbol: symbols.warning, color: colors.warning },
  fail: { symbol: symbols.failure, color: colors.danger },
}

function HealthCheckRow({ check, titleWidth }: { check: HealthCheck; titleWidth: number }) {
  const { symbol, color } = statusStyles[check.status]
  return (
    <Box flexDirection="column" marginBottom={(check.fixes ?? []).length > 0 ? 1 : 0}>
      <Box>
        <Box width={2} flexShrink={0}>
          <Text color={color}>{symbol}</Text>
        </Box>
        <Box width={titleWidth} flexShrink={0}>
          <Text bold>{check.title}</Text>
        </Box>
        <Text {...colorOrTerminalDefault(check.status === 'pass' ? colors.muted : undefined)}>
          {check.detail}
        </Text>
      </Box>
      {check.fixes?.map((fix) => (
        <Box key={fix.description} marginLeft={2 + titleWidth} flexDirection="column">
          <Text>
            <Text color={colors.accent}>{symbols.arrow}</Text> {fix.description}
          </Text>
          {fix.command && (
            <Box marginLeft={2}>
              <Text color={colors.accent}>$ {fix.command}</Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}

function Verdict({ checks }: { checks: HealthCheck[] }) {
  const failures = checks.filter((check) => check.status === 'fail').length
  const warnings = checks.filter((check) => check.status === 'warn').length
  if (failures > 0) {
    return (
      <Text color={colors.danger}>
        Fix the problems marked {symbols.failure} before creating projects.
      </Text>
    )
  }
  if (warnings > 0) {
    return <Text color={colors.warning}>Ready, with some things worth fixing.</Text>
  }
  return (
    <Text color={colors.success}>
      Everything is ready. Create a project with <Text color={colors.accent}>dev new</Text>
    </Text>
  )
}

async function run(): Promise<number> {
  const checks = await withSpinner('Checking this machine', runHealthChecks())
  const titleWidth = Math.max(...checks.map((check) => check.title.length)) + 3
  printElement(
    <Box flexDirection="column">
      <Header title="Doctor" />
      {checks.map((check) => (
        <HealthCheckRow key={check.title} check={check} titleWidth={titleWidth} />
      ))}
      <Box marginTop={1}>
        <Verdict checks={checks} />
      </Box>
    </Box>,
  )
  return checks.some((check) => check.status === 'fail') ? 1 : 0
}

export const doctorCommand: CommandDefinition = {
  name: 'doctor',
  summary: 'Check that this machine is ready for devenv, and say how to fix what is not',
  arguments: [],
  flags: [],
  description: [
    'Checks the container runtime and whether its engine is running, the Podman machine’s memory on macOS and Windows, git and your git identity, SSH keys, and that this dev command is the one on your PATH.',
    'Every problem comes with the command that fixes it. The installer runs it at the end, and it exits with status 1 when something must be fixed.',
  ],
  examples: [{ command: 'dev doctor', explanation: 'Check everything.' }],
  seeAlso: ['new'],
  run,
}
