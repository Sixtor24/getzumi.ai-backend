interface GenerateImageResult {
  success: boolean;
  data?: Buffer[];
  error?: string;
}

// Model configuration mapping
const MODEL_CONFIG: Record<string, { api: string; endpoint: string; type: 'standard' | 'chat' | 'edit' }> = {
  // SeeDream Models - Standard Image API
  'seedream-4-5-251128': { api: 'standard', endpoint: '/v1/images/generations', type: 'standard' },
  'seedream-4-0-250828': { api: 'standard', endpoint: '/v1/images/generations', type: 'standard' },
  
  // Nano Banana Models - Chat Completions API
  'gemini-3-pro-image-preview': { api: 'chat', endpoint: '/v1/chat/completions', type: 'chat' },
  'gemini-2.5-flash-image': { api: 'chat', endpoint: '/v1/chat/completions', type: 'chat' },
  
  // GPT Image Models - Standard Image API
  'gpt-image-1': { api: 'standard', endpoint: '/v1/images/generations', type: 'standard' },
  'gpt-image-1-mini': { api: 'standard', endpoint: '/v1/images/generations', type: 'standard' },
  
  // Sora Image - Chat Completions API
  'sora_image': { api: 'chat', endpoint: '/v1/chat/completions', type: 'chat' },
  
  // Flux Models - Standard Image API
  'flux-pro-1.1': { api: 'standard', endpoint: '/v1/images/generations', type: 'standard' },
  'flux-kontext-pro': { api: 'edit', endpoint: '/v1/images/edits', type: 'edit' },
  'flux-kontext-max': { api: 'edit', endpoint: '/v1/images/edits', type: 'edit' },
};

export class GeminiImageService {
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

  private async extractImageFromResponse(response: Response, isChatModel: boolean): Promise<Buffer | null> {
    if (!response.ok) {
      const t = await response.text();
      console.error(`API Error: ${response.status} - ${t}`);
      return null;
    }
    
    const result: any = await response.json();

    if (isChatModel) {
      const content = result.choices?.[0]?.message?.content;
      if (!content) return null;

      const base64Pattern = /data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/;
      const b64Match = content.match(base64Pattern);
      if (b64Match) return Buffer.from(b64Match[2], 'base64');

      const urlPattern = /!\[.*?\]\((https?:\/\/[^)]+)\)/;
      const urlMatch = content.match(urlPattern);
      if (urlMatch) {
        const imgReq = await fetch(urlMatch[1]);
        if (imgReq.ok) return Buffer.from(await imgReq.arrayBuffer());
      }
    } else {
      if (result.data && result.data[0]) {
        const item = result.data[0];
        if (item.b64_json) return Buffer.from(item.b64_json, 'base64');
        if (item.url) {
          const r = await fetch(item.url);
          if (r.ok) return Buffer.from(await r.arrayBuffer());
        }
      }
    }
    return null;
  }

  async generateImages(prompt: string, model: string, inputImages: string[] = [], count: number = 4): Promise<GenerateImageResult> {
    console.log(`[GeminiService] Generating ${count} images with model: ${model}`);
    
    // Get model configuration
    const config = MODEL_CONFIG[model];
    if (!config) {
      console.error(`[GeminiService] Unknown model: ${model}. Using default chat model.`);
      return this.generateWithChatAPI(prompt, model, count);
    }

    const currentApiUrl = `${this.baseUrl}${config.endpoint}`;
    console.log(`[GeminiService] Using ${config.type} API: ${currentApiUrl}`);

    // Route to appropriate API handler
    switch (config.type) {
      case 'standard':
        return this.generateWithStandardAPI(prompt, model, inputImages, count, currentApiUrl);
      case 'chat':
        return this.generateWithChatAPI(prompt, model, count, currentApiUrl);
      case 'edit':
        console.warn(`[GeminiService] Edit models (${model}) require mask images. Use edit API instead.`);
        return { success: false, error: 'Edit models require mask images. Use image edit endpoint.' };
      default:
        return { success: false, error: `Unsupported model type: ${config.type}` };
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

    if (!isChatModel) {
      if (model.includes('seedream')) {
        const payload: any = {
          model: model,
          prompt: prompt,
          n: 1,
          size: model.includes('seedream-4') ? "2048x2048" : "1024x1024",
          response_format: "b64_json",
          watermark: false
        };
        
        // CRITICAL FIX: SeeDream requires image_urls parameter for reference images
        if (inputImages && inputImages.length > 0) {
          payload.image_urls = inputImages.map(img => 
            img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
          );
        }

        const promises = Array(count).fill(0).map((_, index) => 
          fetch(currentApiUrl, {
            method: "POST", 
            headers: this.headers, 
            body: JSON.stringify(payload)
          }).then(async res => {
            if (!res.ok) {
              console.error(`Seedream Request ${index + 1}/${count} Error:`, await res.text());
              return null;
            }
            const json: any = await res.json();
            console.log(`[GeminiService] Request ${index + 1}/${count} response:`, {
              hasData: !!json.data,
              dataLength: json.data?.length,
              firstItem: json.data?.[0] ? Object.keys(json.data[0]) : []
            });
            
            if (json.data && json.data[0]) {
              if (json.data[0].b64_json) return Buffer.from(json.data[0].b64_json, 'base64');
              if (json.data[0].url) {
                const r = await fetch(json.data[0].url);
                return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
              }
            }
            return null;
          })
        );

        try {
          console.log(`[GeminiService] Launching ${count} parallel requests to ${model} (Image API)...`);
          const results = await Promise.all(promises);
          console.log(`[GeminiService] Received ${results.length} results from Promise.all`);
          results.forEach(buf => { if (buf) buffers.push(buf); });
          console.log(`[GeminiService] Total buffers collected: ${buffers.length}`);
        } catch (e) {
          console.error("Parallel Seedream Gen Error", e);
          return { success: false, error: String(e) };
        }

      } else {
        const payload = {
          model: model,
          prompt: prompt,
          n: count,
          size: "1024x1024",
          response_format: "b64_json",
          watermark: false
        };

        try {
          console.log(`[GeminiService] Generating ${count} images with ${model}...`);
          const response = await fetch(currentApiUrl, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(payload)
          });

          if (!response.ok) throw new Error(await response.text());
          
          const result: any = await response.json();
          
          if (result.data && Array.isArray(result.data)) {
            for (const item of result.data) {
              if (item.b64_json) buffers.push(Buffer.from(item.b64_json, 'base64'));
              else if (item.url) {
                const r = await fetch(item.url);
                if (r.ok) buffers.push(Buffer.from(await r.arrayBuffer()));
              }
            }
          }
        } catch (e) {
          console.error("Image Gen Error", e);
          return { success: false, error: String(e) };
        }
      }

    } else {
      let content: any = prompt;
      if (inputImages && inputImages.length > 0) {
        content = [
          { type: "text", text: prompt },
          ...inputImages.map(img => ({
            type: "image_url",
            image_url: { url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}` }
          }))
        ];
      }

      const payload = {
        model: model,
        stream: false,
        messages: [{ role: "user", content }],
      };

      const promises = Array(count).fill(0).map(() => 
        fetch(currentApiUrl, {
          method: "POST", 
          headers: this.headers, 
          body: JSON.stringify(payload)
        }).then(res => this.extractImageFromResponse(res, true))
      );

      try {
        console.log(`[GeminiService] Launching ${count} parallel requests to ${model}...`);
        const results = await Promise.all(promises);
        results.forEach(buf => { if (buf) buffers.push(buf); });
      } catch (e) {
        console.error("Parallel Gen Error", e);
        return { success: false, error: String(e) };
      }
    }

    if (buffers.length === 0) return { success: false, error: "No images generated successfully" };
    
    // CRITICAL FIX: Limit results to requested count
    // Some APIs (like SeeDream) may return more images than requested
    const limitedBuffers = buffers.slice(0, count);
    console.log(`[GeminiService] Requested: ${count}, Generated: ${buffers.length}, Returning: ${limitedBuffers.length}`);
    
    return { success: true, data: limitedBuffers };
  }

  async generateImageBytes(prompt: string, model: string, inputImages: string[] = []): Promise<GenerateImageResult> {
    return this.generateImages(prompt, model, inputImages, 1);
  }
}
