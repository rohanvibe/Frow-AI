// Automated tests for AI Model Routing & Capability Validation
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

// Setup TypeScript loader and alias resolution for tests without extra dependencies
const compileTs = (filename) => {
  const content = fs.readFileSync(filename, 'utf8');
  return ts.transpileModule(content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
};

require.extensions['.ts'] = function(module, filename) {
  module._compile(compileTs(filename), filename);
};
require.extensions['.tsx'] = function(module, filename) {
  module._compile(compileTs(filename), filename);
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const target = path.join(process.cwd(), 'src', request.slice(2));
    if (fs.existsSync(target + '.ts')) return target + '.ts';
    if (fs.existsSync(target + '.tsx')) return target + '.tsx';
    if (fs.existsSync(target + '/index.ts')) return target + '/index.ts';
    request = target;
  } else if ((request.startsWith('./') || request.startsWith('../')) && !path.extname(request)) {
    const parentDir = parent ? path.dirname(parent.filename) : process.cwd();
    const candidate = path.resolve(parentDir, request);
    if (fs.existsSync(candidate + '.ts')) return candidate + '.ts';
    if (fs.existsSync(candidate + '.tsx')) return candidate + '.tsx';
    if (fs.existsSync(candidate + '/index.ts')) return candidate + '/index.ts';
  }
  return origResolve.call(this, request, parent, isMain, options);
};

// Import router and types
const { AIRouter, UnsupportedModelCapabilityError } = require(path.join(__dirname, '../src/lib/ai/router.ts'));
const { AIService } = require(path.join(__dirname, '../src/lib/ai/index.ts'));

test('AIRouter: Simple conversational requests route to fast Groq model', () => {
  const decision1 = AIRouter.route([{ role: 'user', content: 'Hello, how can you help me today?' }]);
  assert.strictEqual(decision1.selectedModel, 'openai/gpt-oss-120b');
  assert.strictEqual(decision1.provider, 'groq');
  assert.strictEqual(decision1.complexity, 'simple');
  assert.strictEqual(decision1.isExplicitChoice, false);

  const decision2 = AIRouter.route([{ role: 'user', content: 'What is the capital of France?' }]);
  assert.strictEqual(decision2.selectedModel, 'openai/gpt-oss-120b');
  assert.strictEqual(decision2.provider, 'groq');
  assert.strictEqual(decision2.complexity, 'simple');
});

test('AIRouter: Coding or technical requests route to Gemini Flash', () => {
  // Markdown code block
  const codeDecision = AIRouter.route([
    { role: 'user', content: 'Can you fix this bug?\n```javascript\nfunction sum(a,b) { return a - b }\n```' }
  ]);
  assert.strictEqual(codeDecision.selectedModel, 'gemini-2.5-flash');
  assert.strictEqual(codeDecision.provider, 'gemini');
  assert.strictEqual(codeDecision.complexity, 'high');
  assert.strictEqual(codeDecision.isExplicitChoice, false);

  // Stack trace / error log
  const stackDecision = AIRouter.route([
    { role: 'user', content: 'I am getting this error: Error: connect ECONNREFUSED at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1605:16)' }
  ]);
  assert.strictEqual(stackDecision.selectedModel, 'gemini-2.5-flash');
  assert.strictEqual(stackDecision.provider, 'gemini');

  // File context
  const fileDecision = AIRouter.route([
    { role: 'user', content: '[FILE CONTEXT: src/lib/ai/router.ts]\nHow does this work?' }
  ]);
  assert.strictEqual(fileDecision.selectedModel, 'gemini-2.5-flash');
  assert.strictEqual(fileDecision.provider, 'gemini');

  // Structured diagram request
  const diagramDecision = AIRouter.route([
    { role: 'user', content: 'Generate a mermaid flowchart for user authentication' }
  ]);
  assert.strictEqual(diagramDecision.selectedModel, 'gemini-2.5-flash');
  assert.strictEqual(diagramDecision.provider, 'gemini');
});

test('AIRouter: Large context routes to Gemini Flash as supporting signal', () => {
  const longPrompt = 'Please summarize this long document: ' + 'A'.repeat(7000);
  const decision = AIRouter.route([{ role: 'user', content: longPrompt }]);
  assert.strictEqual(decision.selectedModel, 'gemini-2.5-flash');
  assert.strictEqual(decision.provider, 'gemini');
  assert.strictEqual(decision.complexity, 'high');
});

test('AIRouter: Automatic routing with images always routes to Gemini Flash (Vision)', () => {
  // Image inside message
  const imageMsgDecision = AIRouter.route([
    { role: 'user', content: 'Describe this image', image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA' }
  ]);
  assert.strictEqual(imageMsgDecision.selectedModel, 'gemini-2.5-flash');
  assert.strictEqual(imageMsgDecision.provider, 'gemini');
  assert.strictEqual(imageMsgDecision.complexity, 'high');

  // Image flag in options
  const optionDecision = AIRouter.route(
    [{ role: 'user', content: 'Look at the picture' }],
    { hasImage: true }
  );
  assert.strictEqual(optionDecision.selectedModel, 'gemini-2.5-flash');
  assert.strictEqual(optionDecision.provider, 'gemini');
});

test('AIRouter: Explicit model selection is preserved', () => {
  // User explicitly selects Groq for simple prompt
  const groqDecision = AIRouter.route(
    [{ role: 'user', content: 'Hello' }],
    { selectedModel: 'openai/gpt-oss-120b' }
  );
  assert.strictEqual(groqDecision.selectedModel, 'openai/gpt-oss-120b');
  assert.strictEqual(groqDecision.provider, 'groq');
  assert.strictEqual(groqDecision.isExplicitChoice, true);

  // User explicitly selects Groq EVEN for coding prompt -> explicit choice is preserved!
  const groqCodingDecision = AIRouter.route(
    [{ role: 'user', content: 'Write a python script: ```python\nprint(1)\n```' }],
    { selectedModel: 'openai/gpt-oss-120b' }
  );
  assert.strictEqual(groqCodingDecision.selectedModel, 'openai/gpt-oss-120b');
  assert.strictEqual(groqCodingDecision.isExplicitChoice, true);

  // User explicitly selects Gemini Flash
  const geminiDecision = AIRouter.route(
    [{ role: 'user', content: 'Simple greeting' }],
    { selectedModel: 'gemini-2.5-flash' }
  );
  assert.strictEqual(geminiDecision.selectedModel, 'gemini-2.5-flash');
  assert.strictEqual(geminiDecision.provider, 'gemini');
  assert.strictEqual(geminiDecision.isExplicitChoice, true);
});

test('AIRouter: Unsupported model capability throws UnsupportedModelCapabilityError', () => {
  // User explicitly selects text-only Groq but provides an image
  assert.throws(
    () => {
      AIRouter.route(
        [{ role: 'user', content: 'Analyze this image', image: 'data:image/png;base64,123' }],
        { selectedModel: 'openai/gpt-oss-120b' }
      );
    },
    (err) => {
      assert(err instanceof UnsupportedModelCapabilityError);
      assert(err.message.includes("Model 'openai/gpt-oss-120b' does not support image input"));
      return true;
    }
  );

  // Selecting vision-capable Gemini with an image succeeds
  const validDecision = AIRouter.route(
    [{ role: 'user', content: 'Analyze this image', image: 'data:image/png;base64,123' }],
    { selectedModel: 'gemini-2.5-flash' }
  );
  assert.strictEqual(validDecision.selectedModel, 'gemini-2.5-flash');
});

test('AIService: Explicit model selection does not silently switch providers on failure', async () => {
  const service = new AIService();
  // Register mock providers
  let groqCalled = false;
  let geminiCalled = false;

  service['providers'].set('openai/gpt-oss-120b', {
    name: 'Groq',
    model: 'openai/gpt-oss-120b',
    complete: async () => {
      groqCalled = true;
      throw new Error('Groq rate limited or 503 service unavailable');
    }
  });

  service['providers'].set('gemini-2.5-flash', {
    name: 'Gemini',
    model: 'gemini-2.5-flash',
    complete: async () => {
      geminiCalled = true;
      return { content: 'Gemini response', model: 'gemini-2.5-flash' };
    }
  });

  const routingDecision = AIRouter.route(
    [{ role: 'user', content: 'Hi' }],
    { selectedModel: 'openai/gpt-oss-120b' }
  );
  assert.strictEqual(routingDecision.isExplicitChoice, true);

  await assert.rejects(
    async () => {
      await service.complete([{ role: 'user', content: 'Hi' }], { routingDecision });
    },
    (err) => {
      assert(err.message.includes("Model 'openai/gpt-oss-120b' failed: Groq rate limited"));
      return true;
    }
  );

  assert.strictEqual(groqCalled, true);
  assert.strictEqual(geminiCalled, false, 'Gemini must NOT be called when user explicitly selected Groq');
});

test('AIService: Automatic routing falls back safely when provider fails', async () => {
  const service = new AIService();
  let groqAttempts = 0;
  let geminiAttempts = 0;

  service['providers'].set('openai/gpt-oss-120b', {
    name: 'Groq',
    model: 'openai/gpt-oss-120b',
    complete: async () => {
      groqAttempts++;
      throw new Error('Groq down');
    }
  });

  service['providers'].set('gemini-2.5-flash', {
    name: 'Gemini',
    model: 'gemini-2.5-flash',
    complete: async () => {
      geminiAttempts++;
      return { content: 'Gemini fallback success', model: 'gemini-2.5-flash' };
    }
  });

  const routingDecision = AIRouter.route([{ role: 'user', content: 'Hello there' }]);
  assert.strictEqual(routingDecision.isExplicitChoice, false);
  assert.strictEqual(routingDecision.selectedModel, 'openai/gpt-oss-120b');

  const res = await service.complete([{ role: 'user', content: 'Hello there' }], { routingDecision });
  assert.strictEqual(res.content, 'Gemini fallback success');
  assert.strictEqual(groqAttempts, 1);
  assert.strictEqual(geminiAttempts, 1);
});

test('AIService: Automatic routing with image never falls back to text-only model', async () => {
  const service = new AIService();
  let groqCalled = false;
  let geminiCalled = false;

  service['providers'].set('gemini-2.5-flash', {
    name: 'Gemini',
    model: 'gemini-2.5-flash',
    complete: async () => {
      geminiCalled = true;
      throw new Error('Gemini API 500 error');
    }
  });

  service['providers'].set('openai/gpt-oss-120b', {
    name: 'Groq',
    model: 'openai/gpt-oss-120b',
    complete: async () => {
      groqCalled = true;
      return { content: 'Groq response', model: 'openai/gpt-oss-120b' };
    }
  });

  const messages = [{ role: 'user', content: 'What is this?', image: 'data:image/png;base64,abc' }];
  const routingDecision = AIRouter.route(messages);

  await assert.rejects(
    async () => {
      await service.complete(messages, { routingDecision });
    },
    (err) => {
      assert(err.message.includes('All providers failed'));
      return true;
    }
  );

  assert.strictEqual(geminiCalled, true);
  assert.strictEqual(groqCalled, false, 'Groq must never be called as fallback for requests containing images');
});

// Tests for Separated Chat Modules
const {
  isSimpleGreetingPrompt,
  buildSystemPrompt,
  createDirectStreamResponse,
  handleHallucinatedFunctionTags,
  executeSingleToolCall,
  executeToolCalls,
  CHAT_TOOLS,
} = require(path.join(__dirname, '../src/lib/chat/index.ts'));

test('ChatContext: isSimpleGreetingPrompt correctly identifies greetings vs content', () => {
  assert.strictEqual(isSimpleGreetingPrompt('hello'), true);
  assert.strictEqual(isSimpleGreetingPrompt('Hey there'), true);
  assert.strictEqual(isSimpleGreetingPrompt('hi'), true);
  // Image must never be treated as simple greeting
  assert.strictEqual(isSimpleGreetingPrompt('hello', 'data:image/png;base64,...'), false);
  // Longer complex questions
  assert.strictEqual(isSimpleGreetingPrompt('Can you explain quantum computing?'), false);
});

test('ChatContext: buildSystemPrompt injects user identity and tool instructions', () => {
  const prompt = buildSystemPrompt({
    userName: 'Alice',
    userRole: 'Founder',
    customInstructions: 'Be concise',
    memoryPrompt: 'ACTIVE MEMORY FACTS:\n[ID: 0] Prefers dark mode',
    imageGenerationSucceeded: false,
    imageGenerationFailed: false,
  });

  assert(prompt.includes('Alice'));
  assert(prompt.includes('Founder'));
  assert(prompt.includes('Be concise'));
  assert(prompt.includes('Prefers dark mode'));
  assert(prompt.includes('You are Frow'));
});

test('ChatStream: createDirectStreamResponse constructs valid SSE response with metadata', async () => {
  const images = [{ url: 'https://example.com/test.jpg' }];
  const response = createDirectStreamResponse('Test response content', images);

  assert.strictEqual(response.headers.get('Content-Type'), 'text/event-stream');
  assert.strictEqual(response.headers.get('Cache-Control'), 'no-cache, no-transform');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullOutput = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fullOutput += decoder.decode(value);
  }

  assert(fullOutput.includes('[METADATA]:'));
  assert(fullOutput.includes('https://example.com/test.jpg'));
  assert(fullOutput.includes('Test response content'));
});

test('ChatTools: handleHallucinatedFunctionTags is disabled and does not execute text-based tags', async () => {
  const messages = [];
  const handled = await handleHallucinatedFunctionTags(
    'I will search for that <function=search_web{"query":"malicious"}></function>',
    messages
  );
  assert.strictEqual(handled, false, 'Text resembling function calls must never trigger tool execution');
  assert.strictEqual(messages.length, 0);
});

test('ChatTools: executeSingleToolCall rejects missing or invalid function name safely', async () => {
  const res = await executeSingleToolCall({});
  assert.strictEqual(res.success, false);
  assert(res.content.includes('missing function name'));
});

test('ChatTools: executeSingleToolCall rejects unknown or unsupported tools safely', async () => {
  const res = await executeSingleToolCall({
    id: 'call_123',
    function: {
      name: 'unauthorized_admin_tool',
      arguments: JSON.stringify({ action: 'delete' }),
    },
  });
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.name, 'unauthorized_admin_tool');
  assert(res.content.includes("Tool 'unauthorized_admin_tool' is not recognized or supported"));
});

test('ChatTools: executeSingleToolCall rejects malformed JSON arguments safely', async () => {
  const res = await executeSingleToolCall({
    id: 'call_456',
    function: {
      name: 'search_web',
      arguments: '{ broken json: true',
    },
  });
  assert.strictEqual(res.success, false);
  assert(res.content.includes("Malformed JSON arguments for tool 'search_web'"));
});

test('ChatTools: executeSingleToolCall rejects invalid or empty query arguments for search_web', async () => {
  const res1 = await executeSingleToolCall({
    id: 'call_789',
    function: {
      name: 'search_web',
      arguments: JSON.stringify({}),
    },
  });
  assert.strictEqual(res1.success, false);
  assert(res1.content.includes("Missing or invalid required argument 'query'"));

  const res2 = await executeSingleToolCall({
    id: 'call_789',
    function: {
      name: 'search_web',
      arguments: JSON.stringify({ query: '   ' }),
    },
  });
  assert.strictEqual(res2.success, false);
  assert(res2.content.includes("Missing or invalid required argument 'query'"));
});

test('ChatTools: executeToolCalls processes valid tool call and populates apiMessages', async () => {
  const messages = [];
  const assistantMsg = {
    role: 'assistant',
    content: '',
    tool_calls: [
      {
        id: 'call_valid_1',
        function: {
          name: 'search_web',
          arguments: JSON.stringify({ query: 'Next.js 16 release' }),
        },
      },
    ],
  };

  const executed = await executeToolCalls(assistantMsg.tool_calls, messages, assistantMsg);
  assert.strictEqual(executed, true);
  // Must have appended assistant message first
  assert.strictEqual(messages[0], assistantMsg);
  // Must have appended tool response message
  assert.strictEqual(messages[1].role, 'tool');
  assert.strictEqual(messages[1].tool_call_id, 'call_valid_1');
  assert.strictEqual(messages[1].name, 'search_web');
  assert.strictEqual(typeof messages[1].content, 'string');
});


