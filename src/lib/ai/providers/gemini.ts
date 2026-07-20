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
    const geminiMessages = this.convertToGeminiFormat(request.messages);
    
    console.log(`[GeminiProvider] Requesting model: ${this.model}`);
    
    const response = await fetch(
      `${this.baseURL}/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: request.temperature || 0.1,
            maxOutputTokens: request.max_tokens || 8192,
          },
          tools: request.tools ? this.convertTools(request.tools) : undefined,
        }),
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
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        content = candidate.content.parts[0].text || '';
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
    const geminiMessages = this.convertToGeminiFormat(request.messages);
    
    const response = await fetch(
      `${this.baseURL}/models/${this.model}:streamGenerateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: request.temperature || 0.1,
            maxOutputTokens: request.max_tokens,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.name} API Error: ${response.status} - ${error}`);
    }

    return this.transformGeminiStream(response);
  }

  private convertToGeminiFormat(messages: Message[]): any[] {
    return messages.map(msg => {
      let parts: any[] = []
      if (msg.role === 'system') {
        parts = [{ text: `System: ${msg.content}` }];
      } else if (msg.role === 'tool') {
        parts = [{ text: `Tool Result (${msg.name}): ${msg.content}` }];
      } else {
        parts = [{ text: msg.content }];
        if (msg.image) {
          try {
            // Expected format: "data:image/jpeg;base64,..."
            const [header, base64Data] = msg.image.split(';base64,');
            const mimeType = header.split(':')[1];
            if (mimeType && base64Data) {
              parts.push({
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              });
            }
          } catch (e) {
            console.error('[GeminiProvider] Error parsing image data URL', e);
          }
        }
      }
      return { 
        role: msg.role === 'assistant' ? 'model' : 'user', 
        parts
      };
    });
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
