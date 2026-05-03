import { searchWeb } from './search';

export interface ImageResult {
  url: string;
  source: string;
  alt: string;
  width?: number;
  height?: number;
  attribution?: string;
  score: number;
}

export interface ImageEngineResponse {
  type: "image_result";
  query: string;
  images: ImageResult[];
}

// Simple in-memory cache for now (can be upgraded to Redis)
const imageCache = new Map<string, { data: ImageResult[], timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface ImageIntent {
  query: string;
  limit: number;
}

/**
 * PHASE 1: Intent Detection
 * Detects search query and requested quantity from user message.
 */
export function detectImageIntent(message: string): ImageIntent | null {
  const msg = message.toLowerCase();
  
  // 1. Determine Quantity Limit
  let limit = 3; // Default for plural "images"
  
  const singlePatterns = [
    /\b(?:a|an|one|single|the|a single)\s+(?:picture|image|photo|visual)\b/i,
    /\b(?:picture|image|photo|visual)\s+of\b/i, // "image of bugatti" (singular by implication)
  ];

  if (singlePatterns.some(p => p.test(msg))) {
    limit = 1;
  } else {
    // Check for explicit numbers
    const numMatch = msg.match(/\b(\d+)\s+(?:images?|photos?|pictures?|visuals?|galleries)\b/i);
    if (numMatch) {
      limit = Math.min(Math.max(parseInt(numMatch[1]), 1), 10);
    } else {
      const wordNums: Record<string, number> = { 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'several': 4, 'few': 2, 'many': 6, 'gallery': 5 };
      for (const [word, val] of Object.entries(wordNums)) {
        if (msg.includes(word)) {
          limit = val;
          break;
        }
      }
    }
  }

  // 2. Extract Query
  const patterns = [
    /show me (?:a |an |the |some |several )?(?:picture|image|photo|visual|gallery) of (.+)/i,
    /what does (.+) look like/i,
    /find (?:a |an |the |some |several )?(?:picture|image|photo|visual) of (.+)/i,
    /search (?:for )?(?:a |an |the |some |several )?(?:picture|image|photo) of (.+)/i,
    /get (?:me )?(?:a |an |the |some |several )?(?:picture|image|photo) of (.+)/i,
    /images? of (.+)/i,
    /photos? of (.+)/i,
    /pictures? of (.+)/i,
    /gallery of (.+)/i,
    /visuals? for (.+)/i,
    /^show (.+)$/i,
    /^see (.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match && match[1]) {
      return { query: match[1].trim(), limit };
    }
  }

  // Fallback for simple "bugatti image" or "bugatti photo"
  const keywords = ['image', 'photo', 'picture', 'show', 'gallery', 'visual'];
  if (keywords.some(k => msg.includes(k))) {
     const query = msg
       .replace(/\b(?:image|photo|picture|show|me|of|a|an|the|find|search|get|gallery|visual|visuals|some|several|many|few)\b/gi, '')
       .trim();
     if (query.length > 2) return { query, limit };
  }

  return null;
}

/**
 * PHASE 3: Validation Layer
 */
async function validateImage(url: string, timeout = 2500): Promise<{ valid: boolean; contentType?: string }> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'ThreadlyAI/1.0' }
    });
    
    clearTimeout(id);

    if (!response.ok) return { valid: false };

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) return { valid: false };

    // Reject known problematic or transient domains
    const suspiciousDomains = ['example.com', 'placeholder.com'];
    if (suspiciousDomains.some(d => url.includes(d))) return { valid: false };

    return { valid: true, contentType };
  } catch {
    return { valid: false };
  }
}

/**
 * PHASE 2 & 4: Sourcing & Ranking
 */
export async function fetchVerifiedImages(query: string, limit = 5): Promise<ImageResult[]> {
  // Check Cache first
  const cached = imageCache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[ImageEngine] Cache Hit for: ${query}`);
    return cached.data;
  }

  console.log(`[ImageEngine] Fetching for: ${query}`);
  const startTime = Date.now();

  const results: ImageResult[] = [];
  const pexelsKey = process.env.PEXELS_API_KEY;

  try {
    // Parallel Fetch from Sources
    const pexelsPromise = pexelsKey 
      ? fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10`, {
          headers: { Authorization: pexelsKey }
        }).then(res => res.json()).catch(() => ({ photos: [] }))
      : Promise.resolve({ photos: [] });

    // Tavily/Web as fallback or secondary
    const webPromise = searchWeb(query).catch(() => "");

    const [pexelsData, webContent] = await Promise.all([pexelsPromise, webPromise]);

    // 1. Process Pexels (Primary/Trusted)
    if (pexelsData.photos) {
      for (const photo of pexelsData.photos) {
        results.push({
          url: photo.src.large,
          source: photo.url,
          alt: photo.alt || query,
          width: photo.width,
          height: photo.height,
          attribution: `Photo by ${photo.photographer} on Pexels`,
          score: 100 // High score for trusted source
        });
      }
    }

    // 2. Process Web Scraped Images
    // Extract images from webContent if they exist (we tagged them [VERIFIED IMAGES FOUND])
    const webImagesMatch = webContent.match(/\[VERIFIED IMAGES FOUND.*?\]:\n([\s\S]*?)(?:\n\n|$)/);
    if (webImagesMatch && webImagesMatch[1]) {
      const urls = webImagesMatch[1].split('\n').filter(u => u.startsWith('http'));
      for (const url of urls) {
        results.push({
          url,
          source: url,
          alt: query,
          score: 50 // Lower score for web results
        });
      }
    }

    // PHASE 3: Strict Validation
    const validatedResults = await Promise.all(
      results.map(async (img) => {
        const { valid } = await validateImage(img.url);
        return valid ? img : null;
      })
    );

    const finalImages = (validatedResults.filter(Boolean) as ImageResult[])
      .sort((a, b) => b.score - a.score) // Rank by score
      .slice(0, limit);

    // PHASE 5: Update Cache
    if (finalImages.length > 0) {
      imageCache.set(query, { data: finalImages, timestamp: Date.now() });
    }

    const duration = Date.now() - startTime;
    console.log(`[ImageEngine] Success rate: ${finalImages.length}/${results.length}. Latency: ${duration}ms`);

    return finalImages;
  } catch (error) {
    console.error('[ImageEngine] Error:', error);
    return [];
  }
}
