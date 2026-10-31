/** Shared copyright safeguards for chat requests and model output. */

export const COPYRIGHT_REFUSAL =
  "I can’t provide a substantial reproduction of that work. I can summarize it, explain a section, or discuss its themes instead."

const TRANSFORM_REQUEST =
  /\b(summar(?:y|ize|ise)|explain|analy[sz]e|review|critique|discuss|compare|themes?|interpret|paraphrase|transform|adapt|inspire[ds]? by)\b/i

const PUBLIC_DOMAIN_CUE =
  /\b(public domain|public-domain|copyright expired|copyright-free|creative commons)\b/i

const DIRECT_REPRODUCTION_ASK =
  /\b(give|show|send|provide|paste|print|write out|recite|repeat|quote|copy|reproduce|continue)\b[\s\S]{0,100}\b(lyrics?|songs?|novels?|books?|stories|articles?|papers?|publications?|scripts?|screenplays?|dialogue|poems?|textbooks?|workbooks?|lessons?|chapters?|pages?|works?|passages?|excerpts?|answer keys?|course materials?)\b/i

const SPECIFIC_REPRODUCTION_ASK =
  /\b(verbatim|word[- ]for[- ]word|rest of|next chapter|next page|full text|lyrics|song lyrics|answer key|workbook answers|course materials?)\b|\b(full|entire|complete|whole|all of)\b[\s\S]{0,40}\b(lyrics?|songs?|novels?|books?|stories|articles?|papers?|publications?|scripts?|screenplays?|poems?|textbooks?|workbooks?|lessons?|chapters?|pages?|works?|passages?|excerpts?|text)\b/i

/**
 * Conservatively catches explicit requests to obtain protected expression.
 * Discussion and transformation requests, and requests clearly identifying a
 * public-domain source, remain allowed.
 */
export function isCopyrightReproductionRequest(prompt: string): boolean {
  const text = prompt.trim()
  if (!text || PUBLIC_DOMAIN_CUE.test(text)) return false

  const asksForExactCopy =
    /\b(verbatim|word[- ]for[- ]word|exact(?:ly)?|copy|reproduce|recite|quote|write out|paste|print|repeat|continue|rest of|next chapter|next page)\b/i.test(
      text
    )
  if (TRANSFORM_REQUEST.test(text) && !asksForExactCopy) return false

  return DIRECT_REPRODUCTION_ASK.test(text) || SPECIFIC_REPRODUCTION_ASK.test(text)
}

function normalizeForMatch(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/** Detects substantial verbatim copying from text the user supplied. */
export function reproducesSuppliedText(prompt: string, output: string): boolean {
  const source = normalizeForMatch(prompt)
  const result = normalizeForMatch(output)
  if (source.length < 40 || result.length < 40) return false

  // Flag a shared run of 35 words, or a large answer that substantially
  // reproduces the supplied material. Short quotations remain available.
  const sourcePhrases = new Set<string>()
  const phraseLength = Math.min(35, Math.max(20, Math.ceil(result.length * 0.5)))
  for (let index = 0; index <= source.length - phraseLength; index++) {
    sourcePhrases.add(source.slice(index, index + phraseLength).join(' '))
  }
  for (let index = 0; index <= result.length - phraseLength; index++) {
    if (sourcePhrases.has(result.slice(index, index + phraseLength).join(' '))) return true
  }
  return false
}

export function shouldBlockCopyrightOutput(prompt: string, output: string): boolean {
  return isCopyrightReproductionRequest(prompt) || reproducesSuppliedText(prompt, output)
}

/** Buffers provider output so no token is sent before the shared check passes. */
export async function checkCopyrightStream(
  stream: ReadableStream<Uint8Array>,
  prompt: string
): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let output = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      output += decoder.decode(value, { stream: true })
    }
    output += decoder.decode()
  } finally {
    reader.releaseLock()
  }

  return shouldBlockCopyrightOutput(prompt, output) ? COPYRIGHT_REFUSAL : output
}
