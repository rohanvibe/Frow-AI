import { Sparkles, Zap, Star } from 'lucide-react';

export const AI_MODELS = [
  { id: 'auto', name: 'Auto (Smart Routing)', icon: Sparkles, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { id: 'openai/gpt-oss-120b', name: 'GPT (Fast)', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { id: 'gemini-2.5-flash', name: 'Gemini Flash (Vision)', icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/10' },
] as const;

export type ModelId = typeof AI_MODELS[number]['id'];

// Vision-capable models that can process images
export const VISION_MODELS = ['gemini-2.5-flash'];

export const FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'openai/gpt-oss-120b',
];
