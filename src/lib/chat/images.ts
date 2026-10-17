// Deterministic image intent detection and resolution

export interface ResolvedImageIntent {
  detectedImages: any[]
  imageGenerationSucceeded: boolean
  imageGenerationFailed: boolean
}

/**
 * Detects whether the user prompt requests an image action (generation or search)
 * and resolves the images deterministically before LLM invocation.
 */
export async function resolveImageIntent(message?: string): Promise<ResolvedImageIntent> {
  const { detectImageIntent, fetchVerifiedImages, generateImage } = await import('@/utils/image-engine')
  const imageIntent = detectImageIntent(message || '')
  let detectedImages: any[] = []

  if (imageIntent) {
    console.log(`[Deterministic Flow] Image intent detected for: ${imageIntent.query} (Action: ${imageIntent.action}, Limit: ${imageIntent.limit})`)
    if (imageIntent.action === 'generate') {
      detectedImages = await generateImage(imageIntent.query, imageIntent.limit)
    } else {
      detectedImages = await fetchVerifiedImages(imageIntent.query, imageIntent.limit)
    }
  }

  const imageGenerationSucceeded = imageIntent?.action === 'generate' && detectedImages.length > 0
  const imageGenerationFailed = imageIntent?.action === 'generate' && detectedImages.length === 0

  return {
    detectedImages,
    imageGenerationSucceeded,
    imageGenerationFailed,
  }
}
