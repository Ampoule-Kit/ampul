import packageManifest from '../package.json' with { type: 'json' }

export const devenvVersion: string = packageManifest.version
