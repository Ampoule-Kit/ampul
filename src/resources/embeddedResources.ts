import { z } from 'zod'

export const embeddedResourcesAssetName = 'resources'

export const embeddedResourcesSchema = z.strictObject({
  fingerprint: z.string().regex(/^[0-9a-f]{16}$/),
  files: z.array(
    z.strictObject({
      path: z.string().min(1),
      mode: z.int().min(0),
      contentBase64: z.base64(),
    }),
  ),
})

export type EmbeddedResources = z.infer<typeof embeddedResourcesSchema>
