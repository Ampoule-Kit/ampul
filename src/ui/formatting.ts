const millisecondsPerSecond = 1000
const secondsPerMinute = 60

export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / millisecondsPerSecond)
  const minutes = Math.floor(totalSeconds / secondsPerMinute)
  const seconds = totalSeconds % secondsPerMinute
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}
