// Chat streaming response helpers
import { NextResponse } from 'next/server'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no', // Disable nginx buffering
}

/**
 * Creates an SSE streaming response for pre-computed content (bypasses second LLM call)
 */
export function createDirectStreamResponse(content: string, images?: any[]): Response {
  const encoder = new TextEncoder()
  const directStream = new ReadableStream({
    start(controller) {
      if (images && images.length > 0) {
        const imageResult = { type: 'image_result', images }
        controller.enqueue(encoder.encode(`[METADATA]:${JSON.stringify(imageResult)}\n`))
      }
      controller.enqueue(encoder.encode(content || ''))
      controller.close()
    },
  })

  return new Response(directStream, {
    headers: SSE_HEADERS,
  })
}

/**
 * Wraps an LLM ReadableStream and injects image metadata before the model tokens
 */
export function createChatStreamResponse(stream: ReadableStream, images?: any[]): Response {
  const encoder = new TextEncoder()

  const wrappedStream = new ReadableStream({
    async start(controller) {
      // Inject structured image data at the start of the stream if present
      if (images && images.length > 0) {
        const imageResult = {
          type: 'image_result',
          images,
        }
        controller.enqueue(encoder.encode(`[METADATA]:${JSON.stringify(imageResult)}\n`))
      }

      const reader = stream.getReader()
      if (!reader) {
        controller.close()
        return
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }
      } catch (error) {
        controller.error(error)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(wrappedStream, {
    headers: SSE_HEADERS,
  })
}
