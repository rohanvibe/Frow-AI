// Groq Provider (Llama Models)
import { BaseProvider } from './base';
import { ChatCompletionRequest, ChatCompletionResponse } from '../types';

export class GroqProvider extends BaseProvider {
  name = 'Groq';
  model: string;

  constructor(apiKey: string, model: string) {
    super(apiKey, 'https://api.groq.com/openai/v1');
    this.model = model;
  }

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await this.makeRequest('/chat/completions', {
      model: this.model,
      messages: request.messages,
      tools: request.tools,
      tool_choice: request.tool_choice,
      temperature: request.temperature || 0.1,
      max_tokens: request.max_tokens || 4096,
      stream: false,
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Groq API Error: ${data.error.message || JSON.stringify(data.error)}`);
    }
    
    const message = data.choices[0].message;

    return {
      content: message.content || '',
      tool_calls: message.tool_calls,
      model: this.model,
      usage: data.usage,
    };
  }

  async stream(request: ChatCompletionRequest): Promise<ReadableStream> {
    const response = await this.makeRequest('/chat/completions', {
      model: this.model,
      messages: request.messages,
      tools: request.tools,
      tool_choice: request.tool_choice,
      temperature: request.temperature || 0.1,
      max_tokens: request.max_tokens,
      stream: true,
    }, true);

    return this.transformStream(response);
  }

  private transformStream(response: Response): ReadableStream {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    return new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') continue;

              if (trimmed.startsWith('data: ')) {
                try {
                  const json = JSON.parse(trimmed.slice(6));
                  const content = json.choices[0]?.delta?.content || '';
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
