interface GenerateImageResult {
  success: boolean;
  data?: Buffer[];
  error?: string;
}

// Model configuration mapping
const MODEL_CONFIG: Record<string, { endpoint: string; type: 'standard' | 'chat' }> = {
  // SeeDream Models - Standard Image API
  'seedream-4-5-251128': { endpoint: '/v1/images/generations', type: 'standard' },
  'seedream-4-0-250828': { endpoint: '/v1/images/generations', type: 'standard' },
  
  // Nano Banana Models - Chat Completions API
  'gemini-3-pro-image-preview': { endpoint: '/v1/chat/completions', type: 'chat' },
  'gemini-2.5-flash-image': { endpoint: '/v1/chat/completions', type: 'chat' },
  
  // GPT Image Models - Standard Image API
  'gpt-image-1': { endpoint: '/v1/images/generations', type: 'standard' },
  'gpt-image-1-mini': { endpoint: '/v1/images/generations', type: 'standard' },
  
  // Sora Image - Chat Completions API
  'sora_image': { endpoint: '/v1/chat/completions', type: 'chat' },
  
  // Flux Models - Standard Image API
  'flux-pro-1.1': { endpoint: '/v1/images/generations', type: 'standard' },
};

export class ImageGenerationService {
  private apiKey: string;
  private headers: Record<string, string>;
  private baseUrl: string = "https://api.apiyi.com";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`
    };
  }

  async generateImages(
    prompt: string, 
    model: string = "gemini-3-pro-image-preview", 
    inputImages: string[] = [], 
    count: number = 4
  ): Promise<GenerateImageResult> {
    console.log(`[ImageService] Generating ${count} images with model: ${model}`);
    
    // Get model configuration
    const config = MODEL_CONFIG[model];
    if (!config) {
      console.warn(`[ImageService] Unknown model: ${model}. Defaulting to chat API.`);
      return this.generateWithChatAPI(prompt, model, count);
    }

    const apiUrl = `${this.baseUrl}${config.endpoint}`;
    console.log(`[ImageService] Using ${config.type} API: ${apiUrl}`);

    // Route to appropriate handler
    if (config.type === 'standard') {
      return this.generateWithStandardAPI(prompt, model, inputImages, count, apiUrl);
    } else {
      return this.generateWithChatAPI(prompt, model, count, apiUrl);
    }
  }

  private async generateWithStandardAPI(
    prompt: string,
    model: string,
    inputImages: string[],
    count: number,
    apiUrl: string
  ): Promise<GenerateImageResult> {
    const buffers: Buffer[] = [];
    
    // Determine image size based on model
    let size = "1024x1024";
    if (model.includes('seedream')) {
      size = "2K"; // SeeDream supports resolution specs
    } else if (model.includes('gpt-image')) {
      size = "1024x1024"; // GPT-Image standard sizes
    }

    const payload: any = {
      model: model,
      prompt: prompt,
      n: 1, // Generate one at a time for better control
      size: size,
      response_format: "b64_json",
      quality: "hd"
    };

    // Add reference images if provided (for SeeDream)
    if (inputImages && inputImages.length > 0) {
      payload.image_urls = inputImages.map(img => 
        img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
      );
    }

    // Generate images in parallel
    const promises = Array(count).fill(0).map((_, index) => 
      fetch(apiUrl, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(payload)
      }).then(async res => {
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`[ImageService] Request ${index + 1}/${count} failed:`, errorText);
          return null;
        }

        const json: any = await res.json();
        
        if (json.data && json.data[0]) {
          const item = json.data[0];
          if (item.b64_json) {
            return Buffer.from(item.b64_json, 'base64');
          }
          if (item.url) {
            const imgRes = await fetch(item.url);
            if (imgRes.ok) {
              return Buffer.from(await imgRes.arrayBuffer());
            }
          }
        }
        return null;
      }).catch(err => {
        console.error(`[ImageService] Request ${index + 1}/${count} error:`, err);
        return null;
      })
    );

    try {
      const results = await Promise.all(promises);
      results.forEach(buf => { if (buf) buffers.push(buf); });
      console.log(`[ImageService] Generated ${buffers.length}/${count} images successfully`);
    } catch (e) {
      console.error("[ImageService] Parallel generation error:", e);
      return { success: false, error: String(e) };
    }

    if (buffers.length === 0) {
      return { success: false, error: "No images generated successfully" };
    }

    return { success: true, data: buffers.slice(0, count) };
  }

  private async generateWithChatAPI(
    prompt: string,
    model: string,
    count: number,
    apiUrl: string = `${this.baseUrl}/v1/chat/completions`
  ): Promise<GenerateImageResult> {
    const buffers: Buffer[] = [];

    const payload = {
      model: model,
      stream: false,
      messages: [{ 
        role: "user", 
        content: prompt 
      }]
    };

    // Generate images in parallel
    const promises = Array(count).fill(0).map((_, index) => 
      fetch(apiUrl, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(payload)
      }).then(async res => {
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`[ImageService] Chat request ${index + 1}/${count} failed:`, errorText);
          return null;
        }

        const result: any = await res.json();
        const content = result.choices?.[0]?.message?.content;
        
        if (!content) return null;

        // Try to extract base64 image
        const base64Pattern = /data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/;
        const b64Match = content.match(base64Pattern);
        if (b64Match) {
          return Buffer.from(b64Match[2], 'base64');
        }

        // Try to extract image URL
        const urlPattern = /!\[.*?\]\((https?:\/\/[^)]+)\)/;
        const urlMatch = content.match(urlPattern);
        if (urlMatch) {
          const imgRes = await fetch(urlMatch[1]);
          if (imgRes.ok) {
            return Buffer.from(await imgRes.arrayBuffer());
          }
        }

        return null;
      }).catch(err => {
        console.error(`[ImageService] Chat request ${index + 1}/${count} error:`, err);
        return null;
      })
    );

    try {
      const results = await Promise.all(promises);
      results.forEach(buf => { if (buf) buffers.push(buf); });
      console.log(`[ImageService] Generated ${buffers.length}/${count} images via chat API`);
    } catch (e) {
      console.error("[ImageService] Parallel chat generation error:", e);
      return { success: false, error: String(e) };
    }

    if (buffers.length === 0) {
      return { success: false, error: "No images generated successfully" };
    }

    return { success: true, data: buffers.slice(0, count) };
  }

  async generateImageBytes(prompt: string, model: string, inputImages: string[] = []): Promise<GenerateImageResult> {
    return this.generateImages(prompt, model, inputImages, 1);
  }
}
