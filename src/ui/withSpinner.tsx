import { render, Text } from 'ink'
import { Spinner } from './components/Spinner.js'
import { isInteractiveTerminal } from './terminal.js'
import { colors } from './theme.js'

function WorkInProgress({ message, isWorking }: { message: string; isWorking: boolean }) {
  if (!isWorking) return null
  return (
    <Text>
      <Spinner /> <Text color={colors.muted}>{message}</Text>
    </Text>
  )
}

export async function withSpinner<Result>(message: string, work: Promise<Result>): Promise<Result> {
  if (!isInteractiveTerminal()) return work
  const instance = render(<WorkInProgress message={message} isWorking />)
  try {
    return await work
  } finally {
    instance.rerender(<WorkInProgress message={message} isWorking={false} />)
    await instance.waitUntilRenderFlush()
    instance.unmount()
    await instance.waitUntilExit()
  }
}
