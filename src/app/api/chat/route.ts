import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { aiService } from '@/lib/ai'
import { AIRouter, UnsupportedModelCapabilityError } from '@/lib/ai/router'
import { RoutingDecision } from '@/lib/ai/types'
import {
  resolveImageIntent,
  buildChatContext,
  CHAT_TOOLS,
  executeToolCalls,
  executeChatCompletion,
  createDirectStreamResponse,
  COPYRIGHT_REFUSAL,
  isCopyrightReproductionRequest,
  shouldBlockCopyrightOutput,
  checkCopyrightStream,
  sanitizeClientChatHistory,
  isValidChatMessageContent,
  isValidImageDataUrl,
} from '@/lib/chat'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // 1. Authenticate user on server (never trust client-supplied identity)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Validate request payload
    const payload = await req.json().catch(() => null)
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const {
      message,
      image: rawImage,
      messages: rawHistory,
      chatId,
      skipSave,
      stream: requestedStream = true,
      selectedModel,
    } = payload

    if (rawHistory !== undefined && !Array.isArray(rawHistory)) {
      return NextResponse.json({ error: 'Messages must be an array' }, { status: 400 })
    }
    if (message !== undefined && !isValidChatMessageContent(message)) {
      return NextResponse.json({ error: 'Message content must be text within the size limit' }, { status: 400 })
    }
    if (rawImage !== undefined && rawImage !== null && !isValidImageDataUrl(rawImage)) {
      return NextResponse.json({ error: 'Image attachment is invalid' }, { status: 400 })
    }

    const image = isValidImageDataUrl(rawImage) ? rawImage : undefined
    const history = sanitizeClientChatHistory(rawHistory ?? [])

    if (!message && history.length === 0 && !image) {
      return NextResponse.json({ error: 'Message or history is required' }, { status: 400 })
    }

    const copyrightPrompt =
      message || [...history].reverse().find((item: any) => item?.role === 'user')?.content || ''

    // Block explicit requests for substantial reproduction before calling any provider.
    if (isCopyrightReproductionRequest(copyrightPrompt)) {
      if (!requestedStream) {
        return NextResponse.json({ content: COPYRIGHT_REFUSAL, images: [] })
      }
      return createDirectStreamResponse(COPYRIGHT_REFUSAL)
    }

    // 3. Resolve deterministic image intent (generation or search) before LLM
    const {
      detectedImages,
      imageGenerationSucceeded,
      imageGenerationFailed,
    } = await resolveImageIntent(message)

    // 4. Load user personalization & memories, construct system prompt and conversation messages
    const { apiMessages, isSimpleGreeting } = await buildChatContext(
      supabase,
      user,
      history,
      message,
      image,
      {
        imageGenerationSucceeded,
        imageGenerationFailed,
      }
    )

    // 5. Intelligent model routing & capability validation
    const hasImageInput = !!image || apiMessages.some(m => !!m.image)
    let routingDecision: RoutingDecision
    try {
      routingDecision = AIRouter.route(apiMessages, {
        selectedModel,
        currentMessage: message,
        hasImage: hasImageInput,
      })
    } catch (err: any) {
      if (
        err instanceof UnsupportedModelCapabilityError ||
        err.name === 'UnsupportedModelCapabilityError'
      ) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
      throw err
    }

    console.log('[Chat API] Routing decision:', routingDecision)

    // 6. Execute primary completion and evaluate tools
    const executionResult = await executeChatCompletion({
      apiMessages,
      message,
      isSimpleGreeting,
      tools: CHAT_TOOLS,
      routingDecision,
      detectedImages,
    })

    if (executionResult.earlyResponse) {
      return executionResult.earlyResponse
    }

    const { messageObj } = executionResult

    // 7. Handle structured tool calls requested by the model
    if (messageObj.tool_calls && messageObj.tool_calls.length > 0) {
      await executeToolCalls(messageObj.tool_calls, apiMessages, messageObj)

      const finalStream = await aiService.stream(apiMessages, {
        temperature: 0.1,
        forceModel: routingDecision.selectedModel,
        forceProvider: routingDecision.provider,
        routingDecision,
      })
      const safeContent = await checkCopyrightStream(finalStream, copyrightPrompt)
      return createDirectStreamResponse(safeContent, detectedImages)
    }

    if (shouldBlockCopyrightOutput(copyrightPrompt, messageObj.content || '')) {
      messageObj.content = COPYRIGHT_REFUSAL
    }

    // 8. Deliver non-tool response (streamed directly or JSON)
    if (!requestedStream) {
      return NextResponse.json({ content: messageObj.content, images: detectedImages })
    }

    return createDirectStreamResponse(messageObj.content || '', detectedImages)
  } catch (error: any) {
    console.error('Chat API Error:', error)
    return NextResponse.json(
      { error: 'The chat request failed. Please try again.' },
      { status: 500 }
    )
  }
}
