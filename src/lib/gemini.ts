interface GenerateImageResult {
  success: boolean;
  data?: Buffer[];
  error?: string;
}

export class GeminiImageService {
  private apiKey: string;
  private apiUrl: string;
  private headers: Record<string, string>;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.apiUrl = "https://api.apiyi.com/v1/chat/completions";
    this.headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
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
    let currentApiUrl = "https://api.apiyi.com/v1/chat/completions";
    let isChatModel = true;

    if (model.includes('seedream') || model.includes('dall-e')) {
      currentApiUrl = "https://api.apiyi.com/v1/images/generations"; 
      isChatModel = false;
    }

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
