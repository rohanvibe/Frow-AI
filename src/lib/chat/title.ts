/**
 * Chat Title Utilities
 * Handles title cleaning, fallback title extraction from user prompts,
 * and default title validation.
 */

const DEFAULT_TITLES = new Set(['new chat', 'untitled chat', 'new session', 'untitled conversation']);

/**
 * Checks whether a chat title is a placeholder or default title.
 */
export function isDefaultChatTitle(title?: string | null): boolean {
  if (!title || typeof title !== 'string') return true;
  const normalized = title.trim().toLowerCase();
  return !normalized || DEFAULT_TITLES.has(normalized);
}

/**
 * Cleans an AI-generated title:
 * - Strips quotes, markdown characters, label prefixes, and trailing punctuation
 * - Normalizes whitespace
 * - Bounds length to 40 characters
 */
export function cleanGeneratedTitle(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';

  let t = raw.trim();

  // Strip code blocks and inline code markers
  t = t.replace(/```[\s\S]*?```/g, '').replace(/`/g, '');

  // Strip markdown formatting: bold, italic, headers
  t = t.replace(/[*_#~]/g, '');

  // Strip leading/trailing quotes (standard and curly)
  t = t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');

  // Strip common label prefixes like "Title:", "Chat Title:", "Session:"
  t = t.replace(/^(chat\s+)?(session\s+)?title\s*:\s*/i, '');
  t = t.replace(/^topic\s*:\s*/i, '');

  // Strip trailing punctuation
  t = t.replace(/[.,!?;:\-_]+$/, '');

  // Normalize internal whitespace
  t = t.replace(/\s+/g, ' ').trim();

  // If the cleaned title is a default placeholder or empty, reject it
  if (!t || isDefaultChatTitle(t)) {
    return '';
  }

  // Bound length to 40 chars
  if (t.length > 40) {
    t = t.slice(0, 37).trim() + '...';
  }

  return t;
}

/**
 * Generates a concise (3-6 words), readable fallback title directly from a user prompt.
 * Used when AI title generation is unavailable, rate-limited, or fails.
 */
export function generateFallbackTitle(promptText?: string | null): string {
  if (!promptText || typeof promptText !== 'string' || !promptText.trim()) {
    return 'New Session';
  }

  // Clean out file context blocks, code blocks, and markdown
  let clean = promptText
    .replace(/\[FILE CONTEXT:[\s\S]*?\]/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[*_#`~>]/g, '')
    .trim();

  if (!clean) {
    return 'New Session';
  }

  // Split into words, discarding empty tokens
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return 'New Session';
  }

  // Take the first 3 to 5 meaningful words (aim for 3-6 words)
  const selectedWords = words.slice(0, 5);
  let title = selectedWords.join(' ');

  // Remove trailing punctuation
  title = title.replace(/[.,!?;:\-_]+$/, '').trim();

  // Capitalize first letter if it is lower case
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  // Ensure length does not exceed 40 chars
  if (title.length > 40) {
    title = title.slice(0, 37).trim() + '...';
  }

  return title || 'New Session';
}
