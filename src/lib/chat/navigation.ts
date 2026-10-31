export interface NavigableChatMessage {
  id: string
  role: 'user' | 'assistant'
  content?: string | null
}

/** Find the assistant reply paired with a user prompt for sidebar navigation. */
export function getResponseAnchorId(
  messages: NavigableChatMessage[],
  userMessageId: string
): string {
  const userIndex = messages.findIndex(message => message.id === userMessageId)
  if (userIndex < 0 || messages[userIndex].role !== 'user') return userMessageId

  let firstAssistantId: string | undefined
  for (let index = userIndex + 1; index < messages.length; index++) {
    const message = messages[index]
    if (message.role === 'user') break
    if (message.role === 'assistant') {
      firstAssistantId ||= message.id
      if (message.content?.trim()) return message.id
    }
  }

  // While a response is streaming, its placeholder has an anchor even before
  // text arrives. If no assistant row exists, retain the original prompt link.
  return firstAssistantId || userMessageId
}
