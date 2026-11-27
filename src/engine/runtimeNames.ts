export const runtimeNames = ['podman', 'docker'] as const

export type RuntimeName = (typeof runtimeNames)[number]

export const runtimeDisplayNames: Record<RuntimeName, string> = {
  podman: 'Podman',
  docker: 'Docker',
}
