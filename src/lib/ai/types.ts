// AI Provider Type Definitions

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  image?: string;
  tool_call_id?: string;
  name?: string;
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface ChatCompletionRequest {
  messages: Message[];
  tools?: Tool[];
  tool_choice?: 'auto' | 'none' | { type: string; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  content: string;
  tool_calls?: any[];
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIProvider {
  name: string;
  model: string;
  complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  stream(request: ChatCompletionRequest): Promise<ReadableStream>;
}

export interface ModelConfig {
  provider: 'groq' | 'gemini';
  model: string;
  apiKey: string;
  baseURL: string;
}

export enum ComplexityLevel {
  SIMPLE = 'simple',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface RoutingDecision {
  selectedModel: string;
  provider: string;
  complexity: ComplexityLevel;
  reasoning: string;
}
