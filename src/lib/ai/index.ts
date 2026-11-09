// Main AI Service - Routing, Fallbacks, and Provider Management
import { GroqProvider } from './providers/groq';
import { GeminiProvider } from './providers/gemini';
import { OpenAIProvider } from './providers/openai';
import { AIRouter, MODEL_PROVIDERS } from './router';
import { FALLBACK_CHAIN, VISION_MODELS } from '@/config/models';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  RoutingDecision,
} from './types';

export interface BYOKKeys {
  groq?: string;
  gemini?: string;
  openai?: string;
}

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
   * Resolve an AI provider for a specific model, giving precedence to custom BYOK keys if provided.
   */
  public getProvider(
    model: string,
    byokKeys?: BYOKKeys
  ) {
    if (byokKeys) {
      const groqKey = byokKeys.groq || (byokKeys.openai?.startsWith('gsk_') ? byokKeys.openai : undefined);
      const geminiKey = byokKeys.gemini || (byokKeys.openai?.startsWith('AIza') ? byokKeys.openai : undefined);
      const openaiKey = byokKeys.openai?.startsWith('sk-') ? byokKeys.openai : undefined;

      const providerType = MODEL_PROVIDERS[model] || (model.includes('gemini') ? 'gemini' : (model.startsWith('gpt-') ? 'openai' : 'groq'));

      if (providerType === 'groq' && groqKey && !groqKey.startsWith('your_')) {
        return new GroqProvider(groqKey, model);
      }

      if (providerType === 'gemini' && geminiKey && !geminiKey.startsWith('your_')) {
        return new GeminiProvider(geminiKey, model);
      }

      if (providerType === 'openai' && openaiKey && !openaiKey.startsWith('your_')) {
        return new OpenAIProvider(openaiKey, model);
      }

      if (groqKey && !groqKey.startsWith('your_') && (model === 'openai/gpt-oss-120b' || model.includes('llama') || model.includes('mixtral') || model.includes('groq'))) {
        return new GroqProvider(groqKey, model);
      }

      if (geminiKey && !geminiKey.startsWith('your_') && model.includes('gemini')) {
        return new GeminiProvider(geminiKey, model);
      }

      if (openaiKey && !openaiKey.startsWith('your_')) {
        return new OpenAIProvider(openaiKey, model.startsWith('gpt-') ? model : 'gpt-4o-mini');
      }
    }

    return this.providers.get(model);
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
      byokKeys?: BYOKKeys;
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
      byokKeys,
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
      routingDecision,
      [],
      byokKeys
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
      byokKeys?: BYOKKeys;
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
      byokKeys,
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
      routingDecision,
      [],
      byokKeys
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
    attemptedModels: string[] = [],
    byokKeys?: BYOKKeys
  ): Promise<ChatCompletionResponse> {
    const currentAttempted = [...attemptedModels, model];
    const provider = this.getProvider(model, byokKeys);

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
        return this.executeWithFallback(nextModel, request, routingDecision, currentAttempted, byokKeys);
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
        return this.executeWithFallback(nextModel, request, routingDecision, currentAttempted, byokKeys);
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
    attemptedModels: string[] = [],
    byokKeys?: BYOKKeys
  ): Promise<ReadableStream> {
    const currentAttempted = [...attemptedModels, model];
    const provider = this.getProvider(model, byokKeys);

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
        return this.executeStreamWithFallback(nextModel, request, routingDecision, currentAttempted, byokKeys);
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
        return this.executeStreamWithFallback(nextModel, request, routingDecision, currentAttempted, byokKeys);
      }

      // No more fallbacks, throw error
      throw new Error(`All providers failed. Last error: ${error.message}`);
    }
  }

  /**
   * Check if a provider is available
   */
  public isProviderAvailable(model: string, byokKeys?: BYOKKeys): boolean {
    return Boolean(this.getProvider(model, byokKeys));
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
