export async function searchWeb(query: string) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return "Web search is currently disabled. Please add TAVILY_API_KEY to your environment variables.";
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "basic",
        include_answer: true,
        include_images: true,
        max_results: 5,
      }),
    });

    if (!response.ok) {
      return `Search failed with status ${response.status}`;
    }

    const data = await response.json();
    
    // Combine search results into a concise string
    const results = data.results.map((r: any) => 
      `Source: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`
    ).join('\n\n');

    // Step 2: Validate Image URLs (CRITICAL PRODUCTION FIX)
    let validImages: string[] = [];
    if (data.images && data.images.length > 0) {
      const validationPromises = data.images.map(async (imgUrl: string) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1500); // Fast timeout
          
          const headRes = await fetch(imgUrl, { 
            method: 'HEAD',
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          const contentType = headRes.headers.get('content-type');
          if (headRes.ok && contentType && contentType.startsWith('image/')) {
            return imgUrl;
          }
        } catch (e) {
          return null; // Silent fail for bad URLs
        }
        return null;
      });

      const results = await Promise.all(validationPromises);
      validImages = results.filter((url): url is string => url !== null).slice(0, 3); // Max 3 verified images
    }

    const imagesStr = validImages.length > 0 
      ? `\n\n[VERIFIED IMAGES FOUND - USE THESE EXACT URLS FOR VISUALS]:\n${validImages.join('\n')}`
      : '';

    return `SEARCH RESULTS FOR "${query}":\n\n${results}${imagesStr}\n\nSUMMARY: ${data.answer || 'No direct answer available.'}`;
  } catch (error) {
    console.error('Search Error:', error);
    return "An error occurred during web search.";
  }
}

export async function searchImages(query: string) {
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) return "Image search is disabled. Please add PEXELS_API_KEY.";

  try {
    // RACE CONDITION: Start Pexels and Tavily simultaneously to minimize latency
    const pexelsPromise = fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3`, {
      headers: { Authorization: pexelsKey }
    }).then(res => res.json());
    
    const webSearchPromise = searchWeb(query);

    const pexelsData = await pexelsPromise;
    
    if (pexelsData.photos && pexelsData.photos.length > 0) {
      const imagesStr = pexelsData.photos.map((photo: any) => {
        // We pass the credit in the title attribute for the frontend to pick up
        const credit = `Photo by ${photo.photographer} on Pexels`;
        return `Image URL: ${photo.src.large}\nSource Page: ${photo.url}\nAlt Text: ${photo.alt || query}\nAttribution: ${credit}`;
      }).join('\n\n');
      return `[VERIFIED IMAGES FOUND FROM PEXELS]:\n\n${imagesStr}`;
    }

    console.log(`[Pexels] No results for "${query}". Falling back to Web Search results...`);
    return await webSearchPromise;
  } catch (error) {
    console.error('Image Search Error:', error);
    return "An error occurred during image search.";
  }
}
