// Chat tool definitions, validation, and structured execution handlers

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: string
      properties: Record<string, any>
      required: string[]
    }
  }
}

export const CHAT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search the web for real-time information or news.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query string to look up on the web.',
          },
        },
        required: ['query'],
      },
    },
  },
]

export interface ToolExecutionResult {
  toolCallId: string
  name: string
  content: string
  success: boolean
}

/**
 * Validates and executes a single structured tool call safely.
 * - Rejects unknown tool names safely.
 * - Validates argument JSON formatting and required parameters.
 * - Captures execution failures gracefully so the conversation flow is not broken.
 */
export async function executeSingleToolCall(toolCall: any): Promise<ToolExecutionResult> {
  const toolCallId = toolCall?.id || `call_${Math.random().toString(36).substring(2, 9)}`
  const toolName = toolCall?.function?.name

  if (!toolName || typeof toolName !== 'string') {
    return {
      toolCallId,
      name: 'unknown',
      content: 'Error: Tool call missing function name.',
      success: false,
    }
  }

  // Parse and validate arguments JSON
  let args: any
  try {
    const rawArgs = toolCall.function.arguments
    args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : (rawArgs || {})
  } catch (parseError: any) {
    return {
      toolCallId,
      name: toolName,
      content: `Error: Malformed JSON arguments for tool '${toolName}'.`,
      success: false,
    }
  }

  // Authoritative tool dispatch with argument validation
  switch (toolName) {
    case 'search_web': {
      if (!args || typeof args !== 'object' || typeof args.query !== 'string' || !args.query.trim()) {
        return {
          toolCallId,
          name: toolName,
          content: "Error: Missing or invalid required argument 'query' (must be a non-empty string).",
          success: false,
        }
      }

      const cleanQuery = args.query.trim()
      try {
        const { searchWeb } = await import('@/utils/search')
        const searchResult = await searchWeb(cleanQuery)
        return {
          toolCallId,
          name: toolName,
          content: searchResult || 'No results found.',
          success: true,
        }
      } catch (err: any) {
        console.error(`[Tool Execution] search_web failed for query "${cleanQuery}":`, err)
        return {
          toolCallId,
          name: toolName,
          content: 'Error: Unable to retrieve search results at this time.',
          success: false,
        }
      }
    }

    default: {
      console.warn(`[Tool Execution] Rejected call to unsupported tool: '${toolName}'`)
      return {
        toolCallId,
        name: toolName,
        content: `Error: Tool '${toolName}' is not recognized or supported.`,
        success: false,
      }
    }
  }
}

/**
 * Authoritative tool call execution path.
 * Validates tool calls, executes supported tools, and appends tool responses to apiMessages.
 */
export async function executeToolCalls(
  toolCalls: any[],
  apiMessages: any[],
  messageObj: any
): Promise<boolean> {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return false
  }

  apiMessages.push(messageObj)

  for (const toolCall of toolCalls) {
    const result = await executeSingleToolCall(toolCall)
    apiMessages.push({
      role: 'tool',
      tool_call_id: result.toolCallId,
      name: result.name,
      content: result.content,
    })
  }

  return true
}

/**
 * Legacy hallucinated function-tag handler.
 * DISABLED: Structured tool calls are the authoritative execution path.
 * Raw model text resembling function tags is no longer executed.
 */
export async function handleHallucinatedFunctionTags(
  _content: string | undefined,
  _apiMessages: any[]
): Promise<boolean> {
  // Disabled: tools must only be executed through structured model tool calls.
  return false
}
