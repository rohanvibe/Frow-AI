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
  createChatStreamResponse,
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
    const {
      message,
      image,
      messages: history = [],
      chatId,
      skipSave,
      stream: requestedStream = true,
      selectedModel,
    } = await req.json()

    if (!message && history.length === 0) {
      return NextResponse.json({ error: 'Message or history is required' }, { status: 400 })
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
      return createChatStreamResponse(finalStream, detectedImages)
    }

    // 8. Deliver non-tool response (streamed directly or JSON)
    if (!requestedStream) {
      return NextResponse.json({ content: messageObj.content, images: detectedImages })
    }

    return createDirectStreamResponse(messageObj.content || '', detectedImages)
  } catch (error: any) {
    console.error('Chat API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Server error', details: error.stack },
      { status: 500 }
    )
  }
}
