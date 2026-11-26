export interface ProblemFix {
  description: string
  command?: string
}

export interface ProblemDetails {
  explanation?: string
  fixes?: ProblemFix[]
  outputTail?: string[]
  logFile?: string
}

export class Problem extends Error {
  readonly title: string
  readonly explanation?: string
  readonly fixes: ProblemFix[]
  readonly outputTail: string[]
  readonly logFile?: string

  constructor(title: string, details: ProblemDetails = {}) {
    super(title)
    this.name = 'Problem'
    this.title = title
    this.explanation = details.explanation
    this.fixes = details.fixes ?? []
    this.outputTail = details.outputTail ?? []
    this.logFile = details.logFile
  }
}

export class UserCancelled extends Error {
  constructor() {
    super('Cancelled')
    this.name = 'UserCancelled'
  }
}

export function asProblem(error: unknown): Problem {
  if (error instanceof Problem) return error
  const message = error instanceof Error ? error.message : String(error)
  return new Problem('Something went wrong', {
    explanation: message,
    fixes: [
      {
        description:
          'This is unexpected. Run the command again; if it keeps happening, report it with the message above.',
      },
    ],
  })
}
