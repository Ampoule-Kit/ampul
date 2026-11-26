import { render, Text } from 'ink'
import { Spinner } from './components/Spinner.tsx'
import { isInteractiveTerminal } from './terminal.tsx'
import { colors } from './theme.ts'

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
