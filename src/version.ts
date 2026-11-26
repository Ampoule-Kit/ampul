import packageManifest from '../package.json' with { type: 'json' }

export const ampulVersion: string = packageManifest.version
