# AI Model Routing System

## Overview

Frow now uses an intelligent model routing system that automatically selects the most appropriate AI model based on request complexity. This system provides optimal performance, cost efficiency, and reliability through automatic fallbacks.

## Architecture

### Components

1. **Type Definitions** (`src/lib/ai/types.ts`)
   - Interfaces for messages, requests, responses
   - Provider contracts
   - Complexity levels and routing decisions

2. **Provider Classes** (`src/lib/ai/providers/`)
   - `base.ts` - Abstract base provider class
   - `groq.ts` - Groq provider (Qwen models)
   - `gemini.ts` - Gemini provider (Flash and Pro models)

3. **Router** (`src/lib/ai/router.ts`)
   - Complexity detection algorithm
   - Keyword-based analysis
   - Message length and conversation depth factors
   - Model selection logic

4. **AI Service** (`src/lib/ai/index.ts`)
   - Central service orchestrating providers
   - Automatic fallback mechanism
   - Logging and monitoring
   - Singleton pattern for efficiency

## Models

### Qwen 3.6 27B (Groq)
- **Use Case**: Simple requests, greetings, low-complexity tasks
- **Provider**: Groq
- **Environment Variable**: `GROQ_API_KEY`
- **Characteristics**: Fast, cost-effective, good for simple interactions

### Gemini 2.5 Flash (Google)
- **Use Case**: Medium-complexity reasoning, coding assistance, research
- **Provider**: Google Gemini
- **Environment Variable**: `GEMINI_API_KEY`
- **Characteristics**: Balanced performance, good for coding and analysis

### Gemini 2.5 Pro (Google)
- **Use Case**: High-complexity tasks, advanced coding, architecture decisions
- **Provider**: Google Gemini
- **Environment Variable**: `GEMINI_API_KEY`
- **Characteristics**: Most capable, best for complex reasoning

## Routing Logic

### Complexity Detection

The router analyzes messages using multiple factors:

1. **Keyword Analysis**
   - High complexity keywords: architecture, debug, refactor, optimize, security, etc.
   - Medium complexity keywords: code, programming, api, database, research, etc.
   - Simple keywords: hello, hi, greeting, thanks, etc.

2. **Message Length**
   - Simple: < 50 characters
   - Medium: 50-1000 characters
   - High: > 1000 characters

3. **Conversation Depth**
   - Simple: ≤ 5 messages
   - Medium: 5-20 messages
   - High: > 20 messages

### Routing Rules

```
HIGH complexity → Gemini 2.5 Pro
MEDIUM complexity → Gemini 2.5 Flash
SIMPLE complexity → Qwen 3.6 27B
```

## Fallback Mechanism

The system implements automatic fallback in this order:

1. **Primary Model** (based on routing decision)
2. **Gemini 2.5 Flash** (if primary fails)
3. **Qwen 3.6 27B** (if all else fails)

This ensures reliability even when providers experience outages or rate limits.

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Supabase (Public)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Provider Keys
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key

# Service Role (Server-side only)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### API Keys

- **Groq API Key**: Get from https://console.groq.com/
- **Gemini API Key**: Get from https://makersuite.google.com/app/apikey

## Usage

### In API Routes

```typescript
import { aiService } from '@/lib/ai'

// Automatic routing
const response = await aiService.complete(messages, {
  currentMessage: message,
  tools: tools,
  temperature: 0.1,
})

// Streaming
const stream = await aiService.stream(messages, {
  temperature: 0.1,
})

// Force specific model
const response = await aiService.complete(messages, {
  forceModel: 'qwen-3.6-27b',
  forceProvider: 'groq',
})
```

### Getting Routing Decisions

```typescript
const decision = aiService.getRoutingDecision(messages, currentMessage)
console.log(decision)
// {
//   selectedModel: 'gemini-2.5-pro',
//   provider: 'gemini',
//   complexity: 'high',
//   reasoning: 'High complexity detected (keywords: 2, length: 1200, depth: 25)'
// }
```

## Logging

The system logs all routing decisions and fallback attempts:

```
[AIService] Groq provider initialized
[AIService] Gemini providers initialized
[Chat API] Routing decision: { model: 'gemini-2.5-pro', provider: 'gemini', complexity: 'high', reasoning: '...' }
[AIService] Attempting completion with gemini-2.5-pro (attempt 1)
[AIService] Success with gemini-2.5-pro
```

## Extensibility

### Adding New Models

1. Create a new provider class in `src/lib/ai/providers/`
2. Extend the `BaseProvider` class
3. Implement `complete()` and `stream()` methods
4. Add the model to the fallback chain in `AIService`
5. Update routing logic in `AIRouter` if needed

### Adding New Providers

1. Create provider class following the pattern
2. Initialize in `AIService.initializeProviders()`
3. Add environment variable for API key
4. Update documentation

## Backward Compatibility

The system maintains full backward compatibility:

- Existing API endpoints work unchanged
- UI components require no modifications
- Chat functionality preserved
- Tool calling (web search) continues to work
- Image detection and injection unchanged

## Performance Considerations

- **Latency**: Routing adds minimal overhead (< 10ms)
- **Cost**: Automatic routing optimizes for cost by using simpler models when appropriate
- **Reliability**: Fallback mechanism ensures high availability
- **Scalability**: Singleton pattern minimizes resource usage

## Troubleshooting

### Provider Not Available

If you see warnings about missing API keys:

```
[AIService] GROQ_API_KEY not found
[AIService] GEMINI_API_KEY not found
```

Add the missing keys to your `.env` file and restart the server.

### All Providers Failed

If all providers fail, check:

1. API keys are valid
2. Network connectivity
3. Provider service status
4. Rate limits

### Forced Model Not Working

When forcing a specific model, ensure:
- The provider is initialized (API key present)
- The model name is correct
- The provider name matches the provider class

## Testing

### Manual Testing

1. Test simple greetings (should use Qwen)
2. Test coding questions (should use Gemini Flash)
3. Test complex architecture questions (should use Gemini Pro)
4. Test fallback by disabling API keys
5. Check console logs for routing decisions

### Automated Testing

```typescript
import { aiService } from '@/lib/ai'

// Test routing
const decision = aiService.getRoutingDecision(
  [{ role: 'user', content: 'Hello' }],
  'Hello'
)
console.assert(decision.complexity === 'simple')

// Test fallback
const response = await aiService.complete(messages)
console.assert(response.content)
```

## Future Enhancements

Potential improvements:

1. **ML-based routing**: Train a model to predict optimal model selection
2. **Cost tracking**: Monitor and optimize API costs
3. **Performance metrics**: Track latency and success rates
4. **Custom routing rules**: Allow users to configure preferences
5. **A/B testing**: Compare model performance for different tasks
6. **Cache layer**: Cache responses for repeated queries

