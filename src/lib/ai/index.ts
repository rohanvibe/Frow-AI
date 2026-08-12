// Main AI Service - Routing, Fallbacks, and Provider Management
import { GroqProvider } from './providers/groq';
import { GeminiProvider } from './providers/gemini';
import { AIRouter } from './router';
import { FALLBACK_CHAIN, VISION_MODELS } from '@/config/models';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  RoutingDecision,
} from './types';

export class AIService {
  private providers: Map<string, any> = new Map();
  private fallbackChain: string[] = FALLBACK_CHAIN as string[];

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize all AI providers with API keys from environment
   */
  private initializeProviders() {
    // Initialize Groq (Qwen)
    const groqApiKey = process.env.GROQ_API_KEY;
    if (groqApiKey && !groqApiKey.startsWith('your_')) {
      this.providers.set('openai/gpt-oss-120b', new GroqProvider(groqApiKey, 'openai/gpt-oss-120b'));
      console.log('[AIService] Groq provider initialized');
    } else {
      console.warn('[AIService] GROQ_API_KEY not found or is a placeholder');
    }

    // Initialize Gemini
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey && !geminiApiKey.startsWith('your_')) {
      this.providers.set('gemini-2.5-flash', new GeminiProvider(geminiApiKey, 'gemini-2.5-flash'));
      console.log('[AIService] Gemini provider initialized');
    } else {
      console.warn('[AIService] GEMINI_API_KEY not found or is a placeholder — vision will NOT work');
    }
  }

  /**
   * Get routing decision for a request
   */
  public getRoutingDecision(
    messages: any[],
    currentMessage?: string
  ): RoutingDecision {
    return AIRouter.analyzeComplexity(messages, currentMessage);
  }

  /**
   * Check if any message in the request contains an image
   */
  private hasImages(messages: any[]): boolean {
    return messages.some(m => !!m.image);
  }

  /**
   * Execute chat completion with automatic routing and fallback
   */
  public async complete(
    messages: any[],
    options: {
      currentMessage?: string;
      tools?: any[];
      tool_choice?: any;
      temperature?: number;
      max_tokens?: number;
      forceModel?: string;
      forceProvider?: string;
    } = {}
  ): Promise<ChatCompletionResponse> {
    const {
      currentMessage,
      tools,
      tool_choice,
      temperature,
      max_tokens,
      forceModel,
      forceProvider,
    } = options;

    // Get routing decision
    let routingDecision: RoutingDecision;
    if (forceModel && forceProvider) {
      routingDecision = AIRouter.forceModel(forceProvider, forceModel);
    } else {
      routingDecision = this.getRoutingDecision(messages, currentMessage);
    }

    console.log(`[AIService] Routing decision:`, {
      model: routingDecision.selectedModel,
      provider: routingDecision.provider,
      complexity: routingDecision.complexity,
      reasoning: routingDecision.reasoning,
    });

    // Try primary model with fallback
    return this.executeWithFallback(
      routingDecision.selectedModel,
      {
        messages,
        tools,
        tool_choice,
        temperature,
        max_tokens,
      },
      routingDecision
    );
  }

  /**
   * Execute streaming chat completion with automatic routing and fallback
   */
  public async stream(
    messages: any[],
    options: {
      currentMessage?: string;
      tools?: any[];
      tool_choice?: any;
      temperature?: number;
      max_tokens?: number;
      forceModel?: string;
      forceProvider?: string;
    } = {}
  ): Promise<ReadableStream> {
    const {
      currentMessage,
      tools,
      tool_choice,
      temperature,
      max_tokens,
      forceModel,
      forceProvider,
    } = options;

    // Get routing decision
    let routingDecision: RoutingDecision;
    if (forceModel && forceProvider) {
      routingDecision = AIRouter.forceModel(forceProvider, forceModel);
    } else {
      routingDecision = this.getRoutingDecision(messages, currentMessage);
    }

    console.log(`[AIService] Streaming routing decision:`, {
      model: routingDecision.selectedModel,
      provider: routingDecision.provider,
      complexity: routingDecision.complexity,
      reasoning: routingDecision.reasoning,
    });

    // Try primary model with fallback
    return this.executeStreamWithFallback(
      routingDecision.selectedModel,
      {
        messages,
        tools,
        tool_choice,
        temperature,
        max_tokens,
      },
      routingDecision
    );
  }

  /**
   * Get the filtered fallback chain: if images are present, only use vision-capable models
   */
  private getFallbackChain(request: ChatCompletionRequest): string[] {
    const requestHasImages = this.hasImages(request.messages);
    if (requestHasImages) {
      // Only fall back to models that support vision — NEVER send images to text-only models
      return this.fallbackChain.filter(m => (VISION_MODELS as readonly string[]).includes(m));
    }
    return this.fallbackChain;
  }

  /**
   * Execute request with fallback chain
   */
  private async executeWithFallback(
    model: string,
    request: ChatCompletionRequest,
    routingDecision: RoutingDecision,
    attempt: number = 0
  ): Promise<ChatCompletionResponse> {
    const chain = this.getFallbackChain(request);
    const provider = this.providers.get(model);

    if (!provider) {
      console.error(`[AIService] Provider not found for model: ${model}`);
      const currentIndex = chain.indexOf(model);
      if (currentIndex >= 0 && currentIndex < chain.length - 1) {
        const nextModel = chain[currentIndex + 1];
        console.log(`[AIService] Falling back to: ${nextModel}`);
        return this.executeWithFallback(nextModel, request, routingDecision, attempt + 1);
      }
      // Try the first model in the chain as a last resort
      if (chain.length > 0 && chain[0] !== model) {
        console.log(`[AIService] Trying first available in chain: ${chain[0]}`);
        return this.executeWithFallback(chain[0], request, routingDecision, attempt + 1);
      }
      throw new Error(`No available providers for model: ${model}`);
    }

    try {
      console.log(`[AIService] Attempting completion with ${model} (attempt ${attempt + 1})`);
      const response = await provider.complete(request);
      console.log(`[AIService] Success with ${model}`);
      return response;
    } catch (error: any) {
      console.error(`[AIService] Error with ${model}:`, error.message);
      
      // Check if we have more fallback options
      const currentIndex = chain.indexOf(model);
      if (currentIndex >= 0 && currentIndex < chain.length - 1) {
        const nextModel = chain[currentIndex + 1];
        console.log(`[AIService] Falling back to: ${nextModel}`);
        return this.executeWithFallback(nextModel, request, routingDecision, attempt + 1);
      }

      // No more fallbacks, throw error
      throw new Error(`All providers failed. Last error: ${error.message}`);
    }
  }

  /**
   * Execute streaming request with fallback chain
   */
  private async executeStreamWithFallback(
    model: string,
    request: ChatCompletionRequest,
    routingDecision: RoutingDecision,
    attempt: number = 0
  ): Promise<ReadableStream> {
    const chain = this.getFallbackChain(request);
    const provider = this.providers.get(model);

    if (!provider) {
      console.error(`[AIService] Provider not found for model: ${model}`);
      const currentIndex = chain.indexOf(model);
      if (currentIndex >= 0 && currentIndex < chain.length - 1) {
        const nextModel = chain[currentIndex + 1];
        console.log(`[AIService] Falling back to: ${nextModel}`);
        return this.executeStreamWithFallback(nextModel, request, routingDecision, attempt + 1);
      }
      if (chain.length > 0 && chain[0] !== model) {
        console.log(`[AIService] Trying first available in chain: ${chain[0]}`);
        return this.executeStreamWithFallback(chain[0], request, routingDecision, attempt + 1);
      }
      throw new Error(`No available providers for model: ${model}`);
    }

    try {
      console.log(`[AIService] Attempting stream with ${model} (attempt ${attempt + 1})`);
      const stream = await provider.stream(request);
      console.log(`[AIService] Stream started with ${model}`);
      return stream;
    } catch (error: any) {
      console.error(`[AIService] Error with ${model}:`, error.message);
      
      // Check if we have more fallback options
      const currentIndex = chain.indexOf(model);
      if (currentIndex >= 0 && currentIndex < chain.length - 1) {
        const nextModel = chain[currentIndex + 1];
        console.log(`[AIService] Falling back to: ${nextModel}`);
        return this.executeStreamWithFallback(nextModel, request, routingDecision, attempt + 1);
      }

      // No more fallbacks, throw error
      throw new Error(`All providers failed. Last error: ${error.message}`);
    }
  }

  /**
   * Check if a provider is available
   */
  public isProviderAvailable(model: string): boolean {
    return this.providers.has(model);
  }

  /**
   * Get list of available models
   */
  public getAvailableModels(): string[] {
    return Array.from(this.providers.keys());
  }
}

// Singleton instance
export const aiService = new AIService();
