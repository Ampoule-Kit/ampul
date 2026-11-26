import { Box, Text } from 'ink'
import type { Invocation } from '../../cli/CommandDefinition.js'
import { Problem, UserCancelled } from '../../problems/Problem.js'
import { Bullet, Callout } from '../../ui/components/Callout.js'
import { ConfirmPrompt } from '../../ui/components/ConfirmPrompt.js'
import { showInteractiveScreen } from '../../ui/terminal.js'
import { colors } from '../../ui/theme.js'

interface ConfirmationRequest {
  invocation: Invocation
  commandLine: string
  title: string
  lost: string[]
  kept?: string[]
  yesLabel: string
}

export async function confirmDestructiveAction(request: ConfirmationRequest): Promise<void> {
  if (request.invocation.flags.has('yes')) return
  if (!request.invocation.interactive) {
    throw new Problem(`${request.commandLine} needs confirmation`, {
      explanation: `${request.title} No terminal is attached to ask you, so nothing was changed.`,
      fixes: [{ description: 'Confirm it up front', command: `${request.commandLine} --yes` }],
    })
  }
  const confirmed = await showInteractiveScreen<boolean>(
    (finish) => (
      <>
        <Callout tone="danger" title={request.title}>
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Deleted</Text>
            {request.lost.map((item) => (
              <Bullet key={item} color={colors.danger}>
                {item}
              </Bullet>
            ))}
          </Box>
          {request.kept && request.kept.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold>Kept</Text>
              {request.kept.map((item) => (
                <Bullet key={item} color={colors.success}>
                  {item}
                </Bullet>
              ))}
            </Box>
          )}
        </Callout>
        <Box marginTop={1} marginLeft={1}>
          <ConfirmPrompt yesLabel={request.yesLabel} noLabel="Cancel" dangerous onAnswer={finish} />
        </Box>
      </>
    ),
    () => null,
  )
  if (!confirmed) throw new UserCancelled()
}
