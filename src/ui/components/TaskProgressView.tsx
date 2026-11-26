import { Box, Text, useAnimation } from 'ink'
import { useEffect, useState } from 'react'
import type { TaskRunner, TaskRunSnapshot, TaskState } from '../../tasks/TaskRunner.js'
import { formatDuration } from '../formatting.js'
import { colors, symbols } from '../theme.js'
import { Spinner } from './Spinner.js'

const visibleOutputLines = 5
const progressBarWidth = 24
const refreshIntervalMilliseconds = 100

function useThrottledSnapshot(runner: TaskRunner): TaskRunSnapshot {
  const [snapshot, setSnapshot] = useState(() => runner.snapshot())
  useEffect(() => {
    let latest = runner.snapshot()
    const unsubscribe = runner.subscribe((next) => {
      latest = next
      const isSettled = next.tasks.every((task) => task.status !== 'running')
      if (isSettled) setSnapshot(next)
    })
    const timer = setInterval(() => setSnapshot(latest), refreshIntervalMilliseconds)
    return () => {
      unsubscribe()
      clearInterval(timer)
    }
  }, [runner])
  return snapshot
}

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const filled = Math.round((Math.min(completed, total) / Math.max(total, 1)) * progressBarWidth)
  return (
    <Text>
      <Text color={colors.accent}>{'█'.repeat(filled)}</Text>
      <Text color={colors.muted}>{'░'.repeat(progressBarWidth - filled)}</Text>
      <Text color={colors.muted}>
        {' '}
        {completed}/{total}
      </Text>
    </Text>
  )
}

function ElapsedTime({ since }: { since: number }) {
  useAnimation({ interval: 1000 })
  return <Text color={colors.muted}>{formatDuration(Date.now() - since)}</Text>
}

function StatusIcon({ status }: { status: TaskState['status'] }) {
  if (status === 'running') return <Spinner />
  if (status === 'succeeded') return <Text color={colors.success}>{symbols.success}</Text>
  if (status === 'failed') return <Text color={colors.danger}>{symbols.failure}</Text>
  return <Text color={colors.muted}>{symbols.pending}</Text>
}

function TaskRow({ task }: { task: TaskState }) {
  const isRunning = task.status === 'running'
  const duration =
    task.startedAt && task.finishedAt ? formatDuration(task.finishedAt - task.startedAt) : undefined
  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <StatusIcon status={task.status} />
        <Text color={task.status === 'pending' ? colors.muted : undefined} bold={isRunning}>
          {task.title}
        </Text>
        {isRunning && task.startedAt && <ElapsedTime since={task.startedAt} />}
        {duration && <Text color={colors.muted}>{duration}</Text>}
      </Box>
      {isRunning && (task.progress || task.detail) && (
        <Box marginLeft={2} gap={2}>
          {task.progress && <ProgressBar {...task.progress} />}
          {task.detail && <Text color={colors.accent}>{task.detail}</Text>}
        </Box>
      )}
      {isRunning && task.recentOutput.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {task.recentOutput.slice(-visibleOutputLines).map((line, index) => (
            <Text key={index} color={colors.muted} wrap="truncate-end">
              │ {line}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  )
}

export function TaskProgressView({ runner }: { runner: TaskRunner }) {
  const snapshot = useThrottledSnapshot(runner)
  return (
    <Box flexDirection="column">
      {snapshot.tasks.map((task) => (
        <TaskRow key={task.title} task={task} />
      ))}
      {snapshot.warnings.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {snapshot.warnings.map((warning) => (
            <Text key={warning} color={colors.warning}>
              {symbols.warning} {warning}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  )
}
