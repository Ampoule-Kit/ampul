import type { ContainerEngine } from '../../engine/ContainerEngine.ts'
import {
  createEngine,
  diagnoseEngine,
  type EngineDiagnosis,
  type EngineRepair,
} from '../../engine/engineReadiness.ts'
import { Problem } from '../../problems/Problem.ts'
import { UserCancelled } from '../../problems/UserCancelled.ts'
import { LogFile } from '../../tasks/LogFile.ts'
import { ProblemView } from '../../ui/components/ProblemView.tsx'
import { Question } from '../../ui/components/Question.tsx'
import { SelectList } from '../../ui/components/SelectList.tsx'
import { runTasks } from '../../ui/runTasks.tsx'
import { showInteractiveScreen } from '../../ui/terminal.tsx'
import { withSpinner } from '../../ui/withSpinner.tsx'

const repairAttempts = 2

type RepairChoice = 'repair' | 'quit'

async function offerRepair(problem: Problem, repair: EngineRepair): Promise<boolean> {
  const choice = await showInteractiveScreen<RepairChoice>(
    (finish) => (
      <>
        <ProblemView problem={problem} />
        <Question title="ampul can fix this for you">
          <SelectList<RepairChoice>
            options={[
              { value: 'repair', label: repair.offer, hint: `runs: ${repair.command.join(' ')}` },
              { value: 'quit', label: 'Quit, I will fix it myself' },
            ]}
            onSelect={finish}
            onCancel={() => finish('quit')}
            cancelLabel="quit"
          />
        </Question>
      </>
    ),
    (answer) => (answer === 'quit' ? <ProblemView problem={problem} /> : null),
  )
  return choice === 'repair'
}

async function runRepair(engine: ContainerEngine, repair: EngineRepair): Promise<void> {
  const [, ...args] = repair.command
  const result = await runTasks(
    [
      {
        title: repair.progressTitle,
        run: async (context) => {
          const exitCode = await engine.stream(args, {
            onOutput: context.output,
            onLine: context.outputLine,
          })
          if (exitCode !== 0) {
            throw new Problem(`${repair.progressTitle} failed`, {
              fixes: [
                {
                  description: 'Run it yourself to see what is wrong',
                  command: repair.command.join(' '),
                },
              ],
            })
          }
        },
      },
    ],
    new LogFile('engine', 'repair'),
  )
  if (!result.succeeded) throw result.problem
}

export async function connectToEngine(interactive: boolean): Promise<ContainerEngine> {
  const engine = createEngine()
  let diagnosis: EngineDiagnosis = await withSpinner(
    `Connecting to ${engine.displayName}`,
    diagnoseEngine(engine),
  )
  for (let attempt = 0; attempt < repairAttempts && !diagnosis.ready; attempt++) {
    if (!interactive || !diagnosis.repair) break
    if (!(await offerRepair(diagnosis.problem, diagnosis.repair))) throw new UserCancelled()
    await runRepair(engine, diagnosis.repair)
    diagnosis = await diagnoseEngine(engine)
  }
  if (!diagnosis.ready) throw diagnosis.problem
  return engine
}
