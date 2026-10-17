// AI Router - Policy-Based Model Routing and Capability Validation
import { ComplexityLevel, RoutingDecision, Message, RoutingOptions } from './types';
import { VISION_MODELS } from '@/config/models';

export class UnsupportedModelCapabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedModelCapabilityError';
  }
}

export class InvalidModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidModelError';
  }
}

export const MODEL_PROVIDERS: Record<string, string> = {
  'openai/gpt-oss-120b': 'groq',
  'gemini-2.5-flash': 'gemini',
};

export class AIRouter {
  /**
   * Main policy-based routing method.
   * Handles explicit user choices, validates model capabilities,
   * and provides predictable task-based automatic routing.
   */
  static route(messages: Message[] = [], options: RoutingOptions = {}): RoutingDecision {
    const hasImage = Boolean(options.hasImage || messages.some(m => !!m.image));
    const selectedModel = options.selectedModel;

    // 1. Explicit Model Selection: Preserve user choice & validate required capabilities
    if (selectedModel && selectedModel !== 'auto') {
      const provider = MODEL_PROVIDERS[selectedModel] || (selectedModel.includes('gemini') ? 'gemini' : 'groq');

      // Capability check: reject requests requiring vision if model does not support it
      if (hasImage && !(VISION_MODELS as readonly string[]).includes(selectedModel)) {
        throw new UnsupportedModelCapabilityError(
          `Model '${selectedModel}' does not support image input. Please select a vision-capable model (Gemini Flash) or use Auto.`
        );
      }

      return {
        selectedModel,
        provider,
        complexity: ComplexityLevel.MEDIUM,
        reasoning: `User explicitly selected model: ${selectedModel}`,
        isExplicitChoice: true,
      };
    }

    // 2. Automatic Routing Policy ('auto' or unselected)
    // Rule 2A: Image / Multimodal requirement
    if (hasImage) {
      return {
        selectedModel: 'gemini-2.5-flash',
        provider: 'gemini',
        complexity: ComplexityLevel.HIGH,
        reasoning: 'Request contains image attachment(s); routed to vision-capable model (Gemini Flash)',
        isExplicitChoice: false,
      };
    }

    const currentText = options.currentMessage || '';
    const allText = this.extractAllText(messages, currentText);

    // Rule 2B: Technical / Structured task requirements
    if (this.isTechnicalTask(currentText) || this.isTechnicalTask(allText)) {
      return {
        selectedModel: 'gemini-2.5-flash',
        provider: 'gemini',
        complexity: ComplexityLevel.HIGH,
        reasoning: 'Technical or coding task detected; routed to Gemini Flash for structured analysis',
        isExplicitChoice: false,
      };
    }

    // Rule 2C: Large context (supporting signal for long-form reasoning)
    const contextLength = allText.length;
    if (contextLength > 6000) {
      return {
        selectedModel: 'gemini-2.5-flash',
        provider: 'gemini',
        complexity: ComplexityLevel.HIGH,
        reasoning: `Large context detected (${contextLength} characters); routed to Gemini Flash for long-context analysis`,
        isExplicitChoice: false,
      };
    }

    // Rule 2D: Default conversational & general queries -> Fast model
    return {
      selectedModel: 'openai/gpt-oss-120b',
      provider: 'groq',
      complexity: ComplexityLevel.SIMPLE,
      reasoning: 'General conversational query; routed to fast model (GPT on Groq)',
      isExplicitChoice: false,
    };
  }

  /**
   * Identifies clear technical, coding, or structured execution tasks
   * using syntax and structural task indicators rather than fragile keyword counting.
   */
  private static isTechnicalTask(text: string): boolean {
    if (!text) return false;

    // Markdown code blocks or code snippet syntax
    if (/```[\s\S]*?```/.test(text) || text.includes('```')) return true;

    // Attached file context
    if (text.includes('[FILE CONTEXT:')) return true;

    // Stack traces or error logs
    if (/(\bat\s+[A-Za-z0-9_$.]+\s*\(|Traceback \(most recent call last\)|Error:\s+|Exception:\s+)/i.test(text)) {
      return true;
    }

    // Explicit technical tasks and diagram/script tools
    if (/\b(mermaid|flowchart|python sandbox|python script|database schema|refactor this code|debug this code)\b/i.test(text)) {
      return true;
    }

    return false;
  }

  /**
   * Extract all text from messages and current prompt
   */
  private static extractAllText(messages: Message[], currentMessage?: string): string {
    const messageTexts = messages.map(m => m.content || '').join(' ');
    return currentMessage ? `${messageTexts} ${currentMessage}` : messageTexts;
  }

  /**
   * Backwards-compatible interface for existing callers
   */
  static analyzeComplexity(messages: Message[], currentMessage?: string): RoutingDecision {
    return this.route(messages, { currentMessage });
  }

  /**
   * Force a specific model (for testing or explicit caller overrides)
   */
  static forceModel(provider: string, model: string): RoutingDecision {
    return {
      selectedModel: model,
      provider,
      complexity: ComplexityLevel.MEDIUM,
      reasoning: 'Model forced by caller',
      isExplicitChoice: true,
    };
  }
}
