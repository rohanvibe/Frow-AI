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
      routingDecision?: RoutingDecision;
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
      routingDecision: customRoutingDecision,
    } = options;

    // Get routing decision
    let routingDecision: RoutingDecision;
    if (customRoutingDecision) {
      routingDecision = customRoutingDecision;
    } else if (forceModel && forceProvider) {
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
      routingDecision?: RoutingDecision;
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
      routingDecision: customRoutingDecision,
    } = options;

    // Get routing decision
    let routingDecision: RoutingDecision;
    if (customRoutingDecision) {
      routingDecision = customRoutingDecision;
    } else if (forceModel && forceProvider) {
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
    attemptedModels: string[] = []
  ): Promise<ChatCompletionResponse> {
    const currentAttempted = [...attemptedModels, model];
    const provider = this.providers.get(model);

    if (!provider) {
      console.error(`[AIService] Provider not found for model: ${model}`);
      // Do not silently switch providers if the user explicitly selected this model
      if (routingDecision.isExplicitChoice) {
        throw new Error(`Provider not available for explicitly selected model: ${model}`);
      }

      // Automatic fallback for auto-selected models: pick next untried model in chain
      const chain = this.getFallbackChain(request);
      const nextModel = chain.find(m => !currentAttempted.includes(m));
      if (nextModel) {
        console.log(`[AIService] Falling back to: ${nextModel}`);
        return this.executeWithFallback(nextModel, request, routingDecision, currentAttempted);
      }
      throw new Error(`No available providers for model: ${model}`);
    }

    try {
      console.log(`[AIService] Attempting completion with ${model} (attempt ${currentAttempted.length})`);
      const response = await provider.complete(request);
      console.log(`[AIService] Success with ${model}`);
      return response;
    } catch (error: any) {
      console.error(`[AIService] Error with ${model}:`, error.message);
      
      // If user explicitly chose this model, do not silently switch providers on failure
      if (routingDecision.isExplicitChoice) {
        throw new Error(`Model '${model}' failed: ${error.message}`);
      }

      // Safe fallback allowed only for auto-selected models (preserving required capabilities)
      const chain = this.getFallbackChain(request);
      const nextModel = chain.find(m => !currentAttempted.includes(m));
      if (nextModel) {
        console.log(`[AIService] Falling back to: ${nextModel}`);
        return this.executeWithFallback(nextModel, request, routingDecision, currentAttempted);
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
    attemptedModels: string[] = []
  ): Promise<ReadableStream> {
    const currentAttempted = [...attemptedModels, model];
    const provider = this.providers.get(model);

    if (!provider) {
      console.error(`[AIService] Provider not found for model: ${model}`);
      // Do not silently switch providers if the user explicitly selected this model
      if (routingDecision.isExplicitChoice) {
        throw new Error(`Provider not available for explicitly selected model: ${model}`);
      }

      // Automatic fallback for auto-selected models: pick next untried model in chain
      const chain = this.getFallbackChain(request);
      const nextModel = chain.find(m => !currentAttempted.includes(m));
      if (nextModel) {
        console.log(`[AIService] Falling back to: ${nextModel}`);
        return this.executeStreamWithFallback(nextModel, request, routingDecision, currentAttempted);
      }
      throw new Error(`No available providers for model: ${model}`);
    }

    try {
      console.log(`[AIService] Attempting stream with ${model} (attempt ${currentAttempted.length})`);
      const stream = await provider.stream(request);
      console.log(`[AIService] Stream started with ${model}`);
      return stream;
    } catch (error: any) {
      console.error(`[AIService] Error with ${model}:`, error.message);
      
      // If user explicitly chose this model, do not silently switch providers on failure
      if (routingDecision.isExplicitChoice) {
        throw new Error(`Model '${model}' failed: ${error.message}`);
      }

      // Safe fallback allowed only for auto-selected models (preserving required capabilities)
      const chain = this.getFallbackChain(request);
      const nextModel = chain.find(m => !currentAttempted.includes(m));
      if (nextModel) {
        console.log(`[AIService] Falling back to: ${nextModel}`);
        return this.executeStreamWithFallback(nextModel, request, routingDecision, currentAttempted);
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
