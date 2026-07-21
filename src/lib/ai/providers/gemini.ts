// Gemini Provider (Flash and Pro)
import { BaseProvider } from './base';
import { ChatCompletionRequest, ChatCompletionResponse, Message } from '../types';

export class GeminiProvider extends BaseProvider {
  name = 'Gemini';
  model: string;

  constructor(apiKey: string, model: string) {
    super(apiKey, 'https://generativelanguage.googleapis.com/v1beta');
    this.model = model;
  }

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    // Separate system message from conversation
    const systemMsg = request.messages.find(m => m.role === 'system');
    const conversationMessages = request.messages.filter(m => m.role !== 'system');
    const geminiMessages = this.convertToGeminiFormat(conversationMessages);
    
    // Check if any message in the conversation contains an image
    const hasImages = conversationMessages.some(m => !!m.image);
    
    console.log(`[GeminiProvider] Requesting model: ${this.model} (hasImages: ${hasImages})`);
    
    const body: any = {
      contents: geminiMessages,
      generationConfig: {
        temperature: request.temperature || 0.1,
        maxOutputTokens: request.max_tokens || 8192,
      },
    };

    // Add system instruction in proper Gemini format
    if (systemMsg?.content) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    // Gemini API does NOT support function calling when images are in the conversation
    if (!hasImages && request.tools) {
      body.tools = this.convertTools(request.tools);
    }
    
    const response = await fetch(
      `${this.baseURL}/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[GeminiProvider] API Error: ${response.status} - ${error}`);
      throw new Error(`${this.name} API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    // Handle different response formats from Gemini
    let content = '';
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts) {
        // Concatenate all text parts (Gemini can return multiple parts)
        content = candidate.content.parts
          .map((p: any) => p.text || '')
          .join('');
      }
    }
    
    return {
      content,
      model: this.model,
      usage: data.usageMetadata ? {
        prompt_tokens: data.usageMetadata.promptTokenCount || 0,
        completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined,
    };
  }

  async stream(request: ChatCompletionRequest): Promise<ReadableStream> {
    // Separate system message from conversation
    const systemMsg = request.messages.find(m => m.role === 'system');
    const conversationMessages = request.messages.filter(m => m.role !== 'system');
    const geminiMessages = this.convertToGeminiFormat(conversationMessages);
    
    const body: any = {
      contents: geminiMessages,
      generationConfig: {
        temperature: request.temperature || 0.1,
        maxOutputTokens: request.max_tokens,
      },
    };

    if (systemMsg?.content) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }
    
    const response = await fetch(
      `${this.baseURL}/models/${this.model}:streamGenerateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.name} API Error: ${response.status} - ${error}`);
    }

    return this.transformGeminiStream(response);
  }

  private convertToGeminiFormat(messages: Message[]): any[] {
    const result: any[] = [];
    for (const msg of messages) {
      // Skip system messages — handled via systemInstruction at the top level
      if (msg.role === 'system') continue;
      let parts: any[] = [];
      if (msg.role === 'tool') {
        // Tool result as text since Gemini handles this as a user turn
        parts = [{ text: `Tool Result (${msg.name || 'tool'}): ${msg.content}` }];
      } else {
        if (msg.content) parts = [{ text: msg.content }];
        if (msg.image) {
          try {
            // Expected format: "data:image/jpeg;base64,..."
            const [header, base64Data] = msg.image.split(';base64,');
            const mimeType = header.split(':')[1];
            if (mimeType && base64Data) {
              // For Gemini vision: image BEFORE text works better
              parts = [
                { inlineData: { mimeType, data: base64Data } },
                ...(msg.content ? [{ text: msg.content }] : []),
              ];
            }
          } catch (e) {
            console.error('[GeminiProvider] Error parsing image data URL', e);
          }
        }
      }
      result.push({ 
        role: msg.role === 'assistant' ? 'model' : 'user', 
        parts
      });
    }
    return result;
  }

  private convertTools(tools: any[]): any {
    // Convert OpenAI-style tools to Gemini format if needed
    return tools.map(tool => ({
      functionDeclarations: [tool.function],
    }));
  }

  private transformGeminiStream(response: Response): ReadableStream {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    return new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.trim().startsWith('data:')) {
                try {
                  const json = JSON.parse(line.slice(5).trim());
                  const content = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  if (content) {
                    controller.enqueue(encoder.encode(content));
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }
        } catch (error) {
          controller.error(error);
        } finally {
          controller.close();
        }
      }
    });
  }
}
