import chalk from 'chalk'
import { ampulPaths, displayPath } from '../system/platform.ts'
import { ampulVersion } from '../version.ts'
import { type CommandDefinition, type FlagDefinition, helpFlag } from './CommandDefinition.ts'
import { definitionList, indent, pageWidth, paragraphs, wrap } from './textLayout.ts'

interface Section {
  heading: string
  body: string[]
}

function flagTerm(flag: FlagDefinition): string {
  return flag.short ? `-${flag.short}, --${flag.name}` : `    --${flag.name}`
}

function usageLine(command: CommandDefinition): string {
  const options = command.flags.length > 0 ? ' [options]' : ''
  const commandArguments = command.arguments
    .map((argument) => (argument.required ? `<${argument.name}>` : `[${argument.name}]`))
    .join(' ')
  return `${command.name}${options}${commandArguments ? ` ${commandArguments}` : ''}`
}

function renderPage(title: string, sections: Section[]): string {
  const left = chalk.bold(title)
  const right = chalk.dim(`ampul ${ampulVersion}`)
  const gap = Math.max(2, pageWidth() - title.length - `ampul ${ampulVersion}`.length)
  const header = left + ' '.repeat(gap) + right
  const body = sections.flatMap((section) => [
    '',
    chalk.bold.cyan(section.heading),
    ...section.body,
  ])
  return [header, ...body, ''].join('\n')
}

export function commandManualPage(command: CommandDefinition): string {
  const sections: Section[] = [
    { heading: 'NAME', body: wrap(`ampul ${command.name} — ${command.summary}`, indent) },
    { heading: 'SYNOPSIS', body: [`${indent}ampul ${usageLine(command)}`] },
    { heading: 'DESCRIPTION', body: paragraphs(command.description) },
  ]
  if (command.arguments.length > 0) {
    sections.push({
      heading: 'ARGUMENTS',
      body: definitionList(
        command.arguments.map((argument) => [argument.name, argument.description]),
      ),
    })
  }
  sections.push({
    heading: 'OPTIONS',
    body: definitionList(
      [...command.flags, helpFlag].map((flag) => [flagTerm(flag), flag.description]),
    ),
  })
  const aliases = command.aliases ?? []
  if (aliases.length > 0) {
    sections.push({
      heading: 'ALIASES',
      body: [indent + aliases.map((alias) => `ampul ${alias}`).join(', ')],
    })
  }
  if (command.examples.length > 0) {
    sections.push({
      heading: 'EXAMPLES',
      body: command.examples.flatMap((example, index) => [
        ...(index > 0 ? [''] : []),
        indent + chalk.cyan(`$ ${example.command}`),
        ...wrap(example.explanation, indent + indent),
      ]),
    })
  }
  if (command.seeAlso.length > 0) {
    sections.push({
      heading: 'SEE ALSO',
      body: [indent + command.seeAlso.map((name) => `ampul ${name}`).join(', ')],
    })
  }
  return renderPage(`AMPUL-${command.name.toUpperCase()}(1)`, sections)
}

export function overviewManualPage(commands: CommandDefinition[]): string {
  return renderPage('AMPUL(1)', [
    { heading: 'NAME', body: [`${indent}ampul — portable, containerized developer environments`] },
    {
      heading: 'SYNOPSIS',
      body: [
        `${indent}ampul`,
        `${indent}ampul <command> [options] [project]`,
        `${indent}ampul <command> --help`,
      ],
    },
    {
      heading: 'DESCRIPTION',
      body: paragraphs([
        'ampul creates a container for each of your projects, with the tools you pick, your dotfiles, git and SSH already in place, and the code cloned or copied inside it.',
        'Run ampul on its own to see your projects and act on them, or run one of the commands below. Commands that need a project ask you to pick one when you leave the name out.',
      ]),
    },
    {
      heading: 'COMMANDS',
      body: definitionList(commands.map((command) => [usageLine(command), command.summary])),
    },
    {
      heading: 'GLOBAL OPTIONS',
      body: definitionList([
        ['-h, --help', 'Show this manual, or a command’s manual after its name.'],
        ['-v, --version', 'Print the installed version of ampul.'],
      ]),
    },
    {
      heading: 'FILES',
      body: definitionList([
        [
          displayPath(ampulPaths.settings),
          'Your settings: runtime (auto, podman or docker) and containerUser. ampul creates it the first time it runs.',
        ],
        [
          displayPath(ampulPaths.dotfiles),
          'Your dotfiles, laid out like a home folder and linked into every container.',
        ],
        [displayPath(ampulPaths.projects), 'One settings file per project.'],
        [displayPath(ampulPaths.logs), 'Full output of every build and setup, per project.'],
      ]),
    },
    {
      heading: 'ENVIRONMENT',
      body: definitionList([
        ['AMPUL_RUNTIME', 'podman or docker. Overrides the runtime in settings.json.'],
        ['NO_COLOR', 'Turns colors off.'],
      ]),
    },
    { heading: 'SEE ALSO', body: [`${indent}ampul help <command>, for example: ampul help new`] },
  ])
}
