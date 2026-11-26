import { ConfirmPrompt } from './components/ConfirmPrompt.tsx'
import { Question } from './components/Question.tsx'
import { showInteractiveScreen } from './terminal.tsx'

interface YesOrNoQuestion {
  title: string
  explanation?: string
  yesLabel: string
  noLabel: string
}

export function askYesOrNo(question: YesOrNoQuestion): Promise<boolean> {
  return showInteractiveScreen<boolean>(
    (finish) => (
      <Question title={question.title} explanation={question.explanation}>
        <ConfirmPrompt
          yesLabel={question.yesLabel}
          noLabel={question.noLabel}
          defaultAnswer
          onAnswer={finish}
        />
      </Question>
    ),
    () => null,
  )
}
