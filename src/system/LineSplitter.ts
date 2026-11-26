const lineBreakPattern = /\r\n|\n|\r/

export class LineSplitter {
  private unfinishedLine = ''
  private readonly onCompleteLine: (line: string) => void

  constructor(onCompleteLine: (line: string) => void) {
    this.onCompleteLine = onCompleteLine
  }

  push(chunk: string): void {
    const lines = (this.unfinishedLine + chunk).split(lineBreakPattern)
    this.unfinishedLine = lines.pop() ?? ''
    for (const line of lines) this.onCompleteLine(line)
  }

  flush(): void {
    if (this.unfinishedLine) this.onCompleteLine(this.unfinishedLine)
    this.unfinishedLine = ''
  }
}
