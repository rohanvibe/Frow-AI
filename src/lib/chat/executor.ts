// Chat completion execution and error recovery orchestration
import { NextResponse } from 'next/server'
import { aiService } from '@/lib/ai'
import { AIRouter } from '@/lib/ai/router'
import { RoutingDecision } from '@/lib/ai/types'

export interface CompletionExecutionResult {
  messageObj: {
    role: string
    content: string
    tool_calls?: any[]
  }
  earlyResponse?: Response
}

export interface ExecuteChatCompletionParams {
  apiMessages: any[]
  message?: string
  isSimpleGreeting: boolean
  tools: any[]
  routingDecision: RoutingDecision
  detectedImages: any[]
}

/**
 * Executes the primary AI completion call with tool evaluation,
 * handles Groq empty output escalation (for auto-routed requests),
 * handles retrying without tools upon tool failures,
 * extracts hallucinated code from Groq failed_generation errors,
 * and sets up appropriate fallback responses.
 */
export async function executeChatCompletion(
  params: ExecuteChatCompletionParams
): Promise<CompletionExecutionResult> {
  const {
    apiMessages,
    message,
    isSimpleGreeting,
    tools,
    routingDecision,
    detectedImages,
  } = params

  const forcedModel = routingDecision.selectedModel
  const forcedProvider = routingDecision.provider

  let aiResponse: any
  try {
    aiResponse = await aiService.complete(apiMessages, {
      currentMessage: message,
      tools: isSimpleGreeting ? undefined : tools,
      tool_choice: isSimpleGreeting ? undefined : 'auto',
      temperature: 0.1,
      max_tokens: 4096,
      forceModel: forcedModel,
      forceProvider: forcedProvider,
      routingDecision,
    })
  } catch (error: any) {
    console.error('[Chat API] AI Service Error:', error.message)
    const errLower = (error.message || '').toLowerCase()

    // If Groq returned "empty output" error and routing was automatic, escalate to Gemini.
    // If user explicitly selected this model, do not silently switch providers!
    const isGroqEmptyOutputError =
      errLower.includes('model output') ||
      errLower.includes('cannot both be empty') ||
      errLower.includes('empty output')
    const canEscalateToGemini = isGroqEmptyOutputError && !routingDecision.isExplicitChoice

    const retryModel = canEscalateToGemini ? 'gemini-2.5-flash' : forcedModel
    const retryProvider = canEscalateToGemini ? 'gemini' : forcedProvider
    const retryDecision = canEscalateToGemini
      ? AIRouter.forceModel('gemini', 'gemini-2.5-flash')
      : routingDecision

    if (canEscalateToGemini) {
      console.log('[Chat API] Groq returned empty output — escalating to Gemini Flash (auto-routing)')
    } else {
      console.log('[Chat API] Retrying without tools due to error')
    }

    try {
      aiResponse = await aiService.complete(apiMessages, {
        currentMessage: message,
        tools: undefined,
        tool_choice: undefined,
        temperature: 0.1,
        max_tokens: 4096,
        forceModel: retryModel,
        forceProvider: retryProvider,
        routingDecision: retryDecision,
      })
    } catch (retryError: any) {
      console.error('[Chat API] Retry failed:', retryError)

      // Handle Groq strict tool failure by extracting the hallucinated code
      const errMsg = retryError.message || ''
      if (errMsg.includes('failed_generation')) {
        try {
          const match =
            errMsg.match(/"failed_generation"\s*:\s*"([\s\S]*?)"\s*}/) ||
            errMsg.match(/"failed_generation"\s*:\s*'(.*?)'\s*}/)
          let unescaped = ''
          if (match) {
            unescaped = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
          } else if (errMsg.includes('failed_generation')) {
            unescaped = errMsg.substring(errMsg.indexOf('"failed_generation"'))
            unescaped = unescaped.replace(/\\"/g, '"').replace(/\\n/g, '\n')
          }

          if (unescaped.includes('"name": "python"')) {
            const code = unescaped.split('"arguments":')[1]?.replace(/}$/, '').trim()
            if (code) {
              return {
                messageObj: { role: 'assistant', content: `\`\`\`python\n${code}\n\`\`\`` },
                earlyResponse: NextResponse.json({
                  content: `\`\`\`python\n${code}\n\`\`\``,
                  images: detectedImages,
                }),
              }
            }
          } else if (unescaped.includes('"name": "calculator"')) {
            const code = unescaped.split('"arguments":')[1]?.replace(/}$/, '').trim()
            if (code) {
              return {
                messageObj: { role: 'assistant', content: `\`\`\`calculator\n${code}\n\`\`\`` },
                earlyResponse: NextResponse.json({
                  content: `\`\`\`calculator\n${code}\n\`\`\``,
                  images: detectedImages,
                }),
              }
            }
          }
        } catch (e) {}
      }

      throw retryError
    }
  }

  const messageObj = {
    role: 'assistant',
    content: aiResponse.content || '',
    tool_calls: aiResponse.tool_calls,
  }

  // Fallback for empty content
  if (!messageObj.content && (!messageObj.tool_calls || messageObj.tool_calls.length === 0)) {
    messageObj.content = isSimpleGreeting
      ? 'Hey 👋 I’m ready when you are—what do you want to work on, build, or figure out today?'
      : "I couldn't process that properly. Could you rephrase or try again?"
  }

  return { messageObj }
}
