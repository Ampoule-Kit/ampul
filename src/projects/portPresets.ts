import { combinePorts, portsInRange, type PortRange } from './ports.js'

export interface PortPreset {
  id: string
  label: string
  range: PortRange
  section: string
  description: string
}

const webApps = 'Web apps'
const debuggers = 'Debuggers'
const services = 'Databases and services'

function single(port: number): PortRange {
  return { first: port, last: port }
}

export const portPresets: PortPreset[] = [
  {
    id: 'node-web',
    label: 'Next.js, React, Express',
    range: single(3000),
    section: webApps,
    description:
      'The default dev server port of Next.js, Create React App, Express, Remix and Rails.',
  },
  {
    id: 'angular',
    label: 'Angular',
    range: single(4200),
    section: webApps,
    description: 'The Angular CLI dev server started by ng serve.',
  },
  {
    id: 'vite',
    label: 'Vite',
    range: single(5173),
    section: webApps,
    description: 'The Vite dev server, used by the Vue, Svelte, SolidJS and React templates.',
  },
  {
    id: 'aspnet',
    label: 'ASP.NET Core',
    range: { first: 5000, last: 5001 },
    section: webApps,
    description:
      'Kestrel’s defaults: HTTP on 5000 and HTTPS on 5001. Projects made with dotnet new pick their own ports in Properties/launchSettings.json.',
  },
  {
    id: 'python-web',
    label: 'Django, FastAPI',
    range: single(8000),
    section: webApps,
    description: 'Django’s runserver, FastAPI with uvicorn, and python -m http.server.',
  },
  {
    id: 'java-web',
    label: 'Spring Boot, Tomcat',
    range: single(8080),
    section: webApps,
    description: 'The default port of Spring Boot, Tomcat, Quarkus and many other HTTP servers.',
  },
  {
    id: 'storybook',
    label: 'Storybook',
    range: single(6006),
    section: webApps,
    description: 'The Storybook component explorer.',
  },
  {
    id: 'jupyter',
    label: 'Jupyter',
    range: single(8888),
    section: webApps,
    description: 'JupyterLab and Jupyter Notebook.',
  },
  {
    id: 'node-inspector',
    label: 'Node.js inspector',
    range: single(9229),
    section: debuggers,
    description: 'Attach a debugger on this machine to an app started with node --inspect.',
  },
  {
    id: 'java-debugger',
    label: 'Java debugger (JDWP)',
    range: single(5005),
    section: debuggers,
    description:
      'Attach a debugger on this machine to a JVM started with -agentlib:jdwp, the port Gradle and Maven use for debugging.',
  },
  {
    id: 'postgres',
    label: 'PostgreSQL',
    range: single(5432),
    section: services,
    description:
      'Reach a PostgreSQL server running in the container, for example from a compose stack, with tools on this machine.',
  },
  {
    id: 'mysql',
    label: 'MySQL, MariaDB',
    range: single(3306),
    section: services,
    description:
      'Reach a MySQL or MariaDB server running in the container with tools on this machine.',
  },
  {
    id: 'sql-server',
    label: 'SQL Server',
    range: single(1433),
    section: services,
    description: 'Reach a SQL Server running in the container with tools on this machine.',
  },
  {
    id: 'mongodb',
    label: 'MongoDB',
    range: single(27017),
    section: services,
    description: 'Reach a MongoDB server running in the container with tools on this machine.',
  },
  {
    id: 'redis',
    label: 'Redis',
    range: single(6379),
    section: services,
    description: 'Reach a Redis server running in the container with tools on this machine.',
  },
]

export function presetRanges(presetIds: string[]): PortRange[] {
  return portPresets.filter((preset) => presetIds.includes(preset.id)).map((preset) => preset.range)
}

export function presetsCoveredBy(ports: number[]): { presetIds: string[]; otherPorts: number[] } {
  const presetIds = portPresets
    .filter((preset) => portsInRange(preset.range).every((port) => ports.includes(port)))
    .map((preset) => preset.id)
  const coveredPorts = combinePorts(presetRanges(presetIds))
  return { presetIds, otherPorts: ports.filter((port) => !coveredPorts.includes(port)) }
}
