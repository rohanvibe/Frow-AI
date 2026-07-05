// AI Router - Complexity Detection and Model Selection
import { ComplexityLevel, RoutingDecision, Message } from './types';

export class AIRouter {
  // Keywords that indicate different complexity levels
  private static readonly HIGH_COMPLEXITY_KEYWORDS = [
    'architecture',
    'debug',
    'debugging',
    'refactor',
    'optimize',
    'performance',
    'security',
    'scalability',
    'design pattern',
    'system design',
    'advanced',
    'complex',
    'difficult',
    'challenge',
    'solve',
    'prove',
    'algorithm',
    'data structure',
    'concurrent',
    'distributed',
    'microservices',
    'api design',
    'database schema',
    'migration',
    'testing strategy',
    'ci/cd',
    'deployment',
    'monitoring',
    'observability',
    'long context',
    'analyze code',
    'review code',
    'code review',
    'explain code',
    'fix bug',
    'troubleshoot',
    'investigate',
  ];

  private static readonly MEDIUM_COMPLEXITY_KEYWORDS = [
    'code',
    'coding',
    'programming',
    'function',
    'class',
    'component',
    'api',
    'endpoint',
    'database',
    'query',
    'sql',
    'javascript',
    'typescript',
    'python',
    'react',
    'nextjs',
    'node',
    'express',
    'research',
    'search',
    'find',
    'latest',
    'news',
    'explain',
    'how to',
    'tutorial',
    'example',
    'implement',
    'create',
    'build',
    'develop',
    'integrate',
    'calculate',
    'math',
    'formula',
    'mermaid',
    'diagram',
    'visualize',
    'draw',
    'chart',
    'graph',
    'data analysis',
    'statistics',
  ];

  private static readonly SIMPLE_KEYWORDS = [
    'hello',
    'hi',
    'hey',
    'greeting',
    'thanks',
    'thank you',
    'bye',
    'goodbye',
    'help',
    'what can you do',
    'who are you',
  ];

  /**
   * Analyze message complexity and determine routing decision
   */
  static analyzeComplexity(
    messages: Message[],
    currentMessage?: string
  ): RoutingDecision {
    const allText = this.extractAllText(messages, currentMessage);
    const textLower = allText.toLowerCase();

    // Check for high complexity indicators
    const highComplexityScore = this.countKeywordMatches(
      textLower,
      this.HIGH_COMPLEXITY_KEYWORDS
    );

    // Check for medium complexity indicators
    const mediumComplexityScore = this.countKeywordMatches(
      textLower,
      this.MEDIUM_COMPLEXITY_KEYWORDS
    );

    // Check for simple indicators
    const simpleScore = this.countKeywordMatches(
      textLower,
      this.SIMPLE_KEYWORDS
    );

    // Calculate message length factor
    const lengthFactor = this.calculateLengthFactor(allText);

    // Calculate conversation depth factor
    const conversationDepth = messages.length;

    // Determine complexity level
    let complexity: ComplexityLevel;
    let reasoning: string;

    if (highComplexityScore >= 1 || lengthFactor > 1000 || conversationDepth > 20) {
      complexity = ComplexityLevel.HIGH;
      reasoning = `High complexity detected (keywords: ${highComplexityScore}, length: ${lengthFactor}, depth: ${conversationDepth})`;
    } else if (mediumComplexityScore >= 1 || lengthFactor > 200 || conversationDepth > 5) {
      complexity = ComplexityLevel.MEDIUM;
      reasoning = `Medium complexity detected (keywords: ${mediumComplexityScore}, length: ${lengthFactor}, depth: ${conversationDepth})`;
    } else if (simpleScore >= 1 && lengthFactor < 50) {
      complexity = ComplexityLevel.SIMPLE;
      reasoning = `Simple greeting detected (keywords: ${simpleScore}, length: ${lengthFactor})`;
    } else {
      complexity = ComplexityLevel.SIMPLE;
      reasoning = `Default to simple (no complexity indicators, length: ${lengthFactor})`;
    }

    // Map complexity to model
    const { provider, model } = this.mapComplexityToModel(complexity);

    return {
      selectedModel: model,
      provider,
      complexity,
      reasoning,
    };
  }

  /**
   * Extract all text from messages for analysis
   */
  private static extractAllText(messages: Message[], currentMessage?: string): string {
    const messageTexts = messages.map(m => m.content).join(' ');
    return currentMessage ? `${messageTexts} ${currentMessage}` : messageTexts;
  }

  /**
   * Count how many keywords match in the text
   */
  private static countKeywordMatches(text: string, keywords: string[]): number {
    return keywords.filter(keyword => text.includes(keyword)).length;
  }

  /**
   * Calculate length factor (character count)
   */
  private static calculateLengthFactor(text: string): number {
    return text.length;
  }

  /**
   * Map complexity level to specific model
   */
  private static mapComplexityToModel(complexity: ComplexityLevel): {
    provider: string;
    model: string;
  } {
    switch (complexity) {
      case ComplexityLevel.HIGH:
        return {
          provider: 'gemini',
          model: 'gemini-2.0-pro-exp',
        };
      case ComplexityLevel.MEDIUM:
        return {
          provider: 'gemini',
          model: 'gemini-2.0-flash-exp',
        };
      case ComplexityLevel.SIMPLE:
      default:
        return {
          provider: 'groq',
          model: 'qwen-2.5-32b',
        };
    }
  }

  /**
   * Force a specific model (for testing or special cases)
   */
  static forceModel(provider: string, model: string): RoutingDecision {
    return {
      selectedModel: model,
      provider,
      complexity: ComplexityLevel.MEDIUM,
      reasoning: 'Model forced by caller',
    };
  }
}
