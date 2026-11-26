import chalk from 'chalk'
import { devenvPaths, displayPath } from '../system/platform.js'
import { devenvVersion } from '../version.js'
import { helpFlag, type CommandDefinition, type FlagDefinition } from './CommandDefinition.js'

const indent = '    '
const maximumWidth = 100

interface Section {
  heading: string
  body: string[]
}

function pageWidth(): number {
  return Math.min(process.stdout.columns || maximumWidth, maximumWidth)
}

function wrap(text: string, leadingSpace: string): string[] {
  const available = Math.max(20, pageWidth() - leadingSpace.length)
  const lines: string[] = []
  let current = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (current && current.length + 1 + word.length > available) {
      lines.push(leadingSpace + current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) lines.push(leadingSpace + current)
  return lines
}

function paragraphs(texts: string[]): string[] {
  return texts.flatMap((text, index) => [...(index > 0 ? [''] : []), ...wrap(text, indent)])
}

function definitionList(entries: [term: string, definition: string][]): string[] {
  const termWidth = Math.max(...entries.map(([term]) => term.length)) + 3
  return entries.flatMap(([term, definition]) => {
    const [first = '', ...rest] = wrap(definition, indent + ' '.repeat(termWidth))
    return [indent + chalk.bold(term) + first.slice(indent.length + term.length), ...rest]
  })
}

function flagTerm(flag: FlagDefinition): string {
  return flag.short ? `-${flag.short}, --${flag.name}` : `    --${flag.name}`
}

function usageLine(command: CommandDefinition): string {
  const options = command.flags.length > 0 ? ' [options]' : ''
  const commandArguments = command.arguments
    .map((argument) => (argument.required ? `<${argument.name}>` : `[${argument.name}]`))
    .join(' ')
  return `dev ${command.name}${options}${commandArguments ? ` ${commandArguments}` : ''}`
}

function renderPage(title: string, sections: Section[]): string {
  const left = chalk.bold(title)
  const right = chalk.dim(`devenv ${devenvVersion}`)
  const gap = Math.max(2, pageWidth() - title.length - `devenv ${devenvVersion}`.length)
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
    { heading: 'NAME', body: wrap(`dev ${command.name} — ${command.summary}`, indent) },
    { heading: 'SYNOPSIS', body: [indent + usageLine(command)] },
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
  if (command.aliases?.length) {
    sections.push({
      heading: 'ALIASES',
      body: [indent + command.aliases.map((alias) => `dev ${alias}`).join(', ')],
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
      body: [indent + command.seeAlso.map((name) => `dev ${name}`).join(', ')],
    })
  }
  return renderPage(`DEV-${command.name.toUpperCase()}(1)`, sections)
}

export function overviewManualPage(commands: CommandDefinition[]): string {
  return renderPage('DEV(1)', [
    { heading: 'NAME', body: [`${indent}dev — portable, containerized developer environments`] },
    {
      heading: 'SYNOPSIS',
      body: [
        `${indent}dev`,
        `${indent}dev <command> [options] [project]`,
        `${indent}dev <command> --help`,
      ],
    },
    {
      heading: 'DESCRIPTION',
      body: paragraphs([
        'dev creates a container for each of your projects, with the tools you pick, your dotfiles and their config, git and SSH already in place, and the code cloned or copied inside it.',
        'Run dev on its own to see your projects and act on them, or run one of the commands below. Commands that need a project ask you to pick one when you leave the name out.',
      ]),
    },
    {
      heading: 'COMMANDS',
      body: definitionList(
        commands.map((command) => [usageLine(command).slice(4), command.summary]),
      ),
    },
    {
      heading: 'GLOBAL OPTIONS',
      body: definitionList([
        ['-h, --help', 'Show this manual, or a command’s manual after its name.'],
        ['-v, --version', 'Print the installed version of devenv.'],
      ]),
    },
    {
      heading: 'FILES',
      body: definitionList([
        [displayPath(devenvPaths.projects), 'One settings file per project.'],
        [
          displayPath(devenvPaths.preferences),
          'Optional: {"runtime": "podman" | "docker", "containerUser": "dev"}.',
        ],
        [displayPath(devenvPaths.logs), 'Full output of every build and setup, per project.'],
      ]),
    },
    {
      heading: 'ENVIRONMENT',
      body: definitionList([
        ['DEVENV_RUNTIME', 'podman or docker. Overrides the runtime devenv would pick.'],
        ['NO_COLOR', 'Turns colors off.'],
      ]),
    },
    { heading: 'SEE ALSO', body: [`${indent}dev help <command>, for example: dev help new`] },
  ])
}
