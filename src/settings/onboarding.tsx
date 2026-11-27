import fs from 'node:fs'
import { Text } from 'ink'
import { runtimeDisplayNames, runtimeNames } from '../engine/runtimeNames.ts'
import { findExecutable } from '../system/executables.ts'
import { ampulPaths, displayPath } from '../system/platform.ts'
import { Bullet, Callout } from '../ui/components/Callout.tsx'
import { Header } from '../ui/components/Header.tsx'
import { AnsweredQuestion, Question } from '../ui/components/Question.tsx'
import { SelectList, type SelectOption } from '../ui/components/SelectList.tsx'
import { TextPrompt } from '../ui/components/TextPrompt.tsx'
import { printElement, showInteractiveScreen } from '../ui/terminal.tsx'
import {
  type AmpulSettings,
  containerUserProblem,
  defaultSettings,
  type RuntimeChoice,
} from './settingsSchema.ts'
import { ampulSettings, saveSettings, settingsFileExists } from './settingsStore.ts'

const automaticRuntimeLabel = 'Pick for me'

function runtimeLabel(choice: RuntimeChoice): string {
  return choice === 'auto' ? automaticRuntimeLabel : runtimeDisplayNames[choice]
}

function runtimeOptions(): SelectOption<RuntimeChoice>[] {
  return [
    {
      value: 'auto',
      label: automaticRuntimeLabel,
      description: 'Podman when it is installed, otherwise Docker.',
    },
    ...runtimeNames.map((name) => ({
      value: name,
      label: runtimeDisplayNames[name],
      hint: findExecutable(name) ? 'installed' : 'not installed',
    })),
  ]
}

function askForRuntime(): Promise<RuntimeChoice> {
  return showInteractiveScreen<RuntimeChoice>(
    (finish) => (
      <Question
        title="Which container runtime should ampul use?"
        explanation="The AMPUL_RUNTIME environment variable can still override it for a single command."
      >
        <SelectList options={runtimeOptions()} initialValue="auto" onSelect={finish} />
      </Question>
    ),
    (answer) => <AnsweredQuestion title="Container runtime" answer={runtimeLabel(answer)} />,
  )
}

function askForContainerUser(): Promise<string> {
  return showInteractiveScreen<string>(
    (finish) => (
      <Question
        title="What should your user in the containers be called?"
        explanation="You work as this user in every container, with passwordless sudo."
      >
        <TextPrompt
          initialValue={defaultSettings.containerUser}
          validate={containerUserProblem}
          onSubmit={finish}
        />
      </Question>
    ),
    (answer) => <AnsweredQuestion title="Container user" answer={answer} />,
  )
}

async function askForSettings(): Promise<AmpulSettings> {
  printElement(
    <Header
      title="Welcome"
      subtitle={`Two questions to set up ${displayPath(ampulPaths.settings)}. You can change the answers there later.`}
    />,
  )
  const runtime = await askForRuntime()
  const containerUser = await askForContainerUser()
  return { ...defaultSettings, runtime, containerUser }
}

function SetUpSummary() {
  return (
    <Callout tone="success" title="ampul is set up">
      <Bullet>
        Your settings are in <Text bold>{displayPath(ampulPaths.settings)}</Text>.
      </Bullet>
      <Bullet>
        Put your dotfiles in <Text bold>{displayPath(ampulPaths.dotfiles)}</Text>, laid out like a
        home folder. Each file is linked into every container at the same place, so dotfiles/.bashrc
        becomes ~/.bashrc.
      </Bullet>
    </Callout>
  )
}

function reportDefaultSettings(): void {
  process.stderr.write(
    `Created ${displayPath(ampulPaths.settings)} with the default settings, and ${displayPath(ampulPaths.dotfiles)} for your dotfiles.\n`,
  )
}

export async function ensureSettings(interactive: boolean): Promise<void> {
  if (settingsFileExists()) {
    ampulSettings()
    return
  }
  saveSettings(interactive ? await askForSettings() : defaultSettings)
  fs.mkdirSync(ampulPaths.dotfiles, { recursive: true })
  if (interactive) printElement(<SetUpSummary />)
  else reportDefaultSettings()
}
