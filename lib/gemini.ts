interface GenerateImageResult {
  success: boolean;
  data?: Buffer;
  error?: string;
}

export class GeminiImageService {
  private apiKey: string;
  private apiUrl: string;
  private headers: HeadersInit;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.apiUrl = "https://api.apiyi.com/v1/chat/completions";
    this.headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    };
  }

  async generateImageBytes(prompt: string, model: string, inputImages: string[] = []): Promise<GenerateImageResult> {
    // 1. Determine the API Endpoint and Mode
    // - SeeDream: Uses /v1/images/generations (Standard OpenAI Image API)
    // - Sora: Uses /v1/chat/completions (Docs confirm: "Uses standard chat completion interface")
    // - Nano Banana (Gemini): Uses /v1/chat/completions
    
    let currentApiUrl = "https://api.apiyi.com/v1/chat/completions";
    let isChatModel = true;

    if (model.includes('seedream') || model.includes('dall-e')) {
      currentApiUrl = "https://api.apiyi.com/v1/images/generations"; 
      isChatModel = false;
    }

    // 2. Construct Payload
    let payload: any;

    if (isChatModel) {
        // Chat Completion Payload
        let content: any = prompt;

        // Support Multimodal Input (Text + Images)
        // Nano Banana supports this. Sora docs don't explicitly show input images, but strict Chat API usually handles it.
        if (inputImages && inputImages.length > 0) {
          content = [
            { type: "text", text: prompt },
            ...inputImages.map(img => ({
              type: "image_url",
              image_url: {
                // Ensure data URI format
                url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
              }
            }))
          ];
        }

        payload = {
          model: model,
          stream: false,
          messages: [{ role: "user", content }],
        };
    } else {
        // Image Generation Payload (SeeDream)
        payload = {
            model: model,
            prompt: prompt,
            n: 1,
            size: "1024x1024", // Default safe size
            response_format: "b64_json"
        };
        // Note: seedream docs show input "size" can be "2K", "4K", or "2048x2048". "1024x1024" should work or be close to 1K.
        if (model.includes('seedream-4-5') || model.includes('seedream-4-0')) {
             // Use 2K as default for SeeDream high quality, or let user specify? 
             // Start safe with 1024x1024 unless we want to maximize quality. Docs say "Default: 2048x2048".
             // Let's stick to standard 1024 to save latency/bandwidth unless requested.
             payload.size = "2048x2048"; 
        }
    }

    try {
      console.log(`[GeminiService] Generating with ${model} at ${currentApiUrl}`);
      
      const response = await fetch(currentApiUrl, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `API error: ${response.status} - ${errorText}` };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await response.json();
      let imageBuffer: Buffer | undefined;

      // 3. Parse Response based on Mode
      if (isChatModel) {
          // Expecting Base64 inside Chat Content (Nano Banana / Sora)
          // Sora docs: "content = result['choices'][0]['message']['content'] ... image_urls = re.findall..."
          // Wait, Sora docs say it returns **URLs** in the markdown content!
          // Nano Banana docs say it returns **Base64** in the content (via regex detection).
          // We need to handle BOTH patterns (Base64 data URI OR Markdown Image URL).

          const content = result.choices?.[0]?.message?.content;
          if (!content) return { success: false, error: "Empty content from API" };

          // Pattern 1: Base64 Data URI (Nano Banana)
          const base64Pattern = /data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/;
          const b64Match = content.match(base64Pattern);

          if (b64Match) {
             imageBuffer = Buffer.from(b64Match[2], 'base64');
          } else {
             // Pattern 2: Markdown Image URL (Sora) -> ![image](https://...)
             const urlPattern = /!\[.*?\]\((https?:\/\/[^)]+)\)/;
             const urlMatch = content.match(urlPattern);
             
             if (urlMatch) {
                 const imgUrl = urlMatch[1];
                 console.log(`[GeminiService] Found Image URL in Chat: ${imgUrl}`);
                 // Fetch the image to store bytes
                 const imgReq = await fetch(imgUrl);
                 if (!imgReq.ok) return { success: false, error: "Failed to download image from URL" };
                 const arrayBuffer = await imgReq.arrayBuffer();
                 imageBuffer = Buffer.from(arrayBuffer);
             } else {
                 return { success: false, error: "No image (Base64 or URL) found in response content" };
             }
          }
      } else {
          // Standard Image Generation Response (SeeDream)
          // { data: [ { b64_json: "..." } ] } or { data: [ { url: "..." } ] }
          if (result.data && result.data.length > 0) {
              const item = result.data[0];
              if (item.b64_json) {
                  imageBuffer = Buffer.from(item.b64_json, 'base64');
              } else if (item.url) {
                   const imgReq = await fetch(item.url);
                   if (!imgReq.ok) return { success: false, error: "Failed to download image from URL" };
                   const arrayBuffer = await imgReq.arrayBuffer();
                   imageBuffer = Buffer.from(arrayBuffer);
              } else {
                  return { success: false, error: "No image data found in standard response" };
              }
          } else {
              return { success: false, error: "Empty data array in standard response" };
          }
      }
      
      if (!imageBuffer) return { success: false, error: "Failed to process image buffer" };
      return { success: true, data: imageBuffer };

    } catch (error) {
       let errorMessage = "Unknown error";
       if (error instanceof Error) {
           errorMessage = error.message;
       }
      return { success: false, error: errorMessage };
    }
  }
}
