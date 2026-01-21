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

  async generateImageBytes(prompt: string, model: string): Promise<GenerateImageResult> {
    const payload = {
      model: model,
      stream: false,
      messages: [{ role: "user", content: prompt }],
    };

    try {
      const response = await fetch(this.apiUrl, {
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
      const content = result.choices?.[0]?.message?.content;

      if (!content) {
        return { success: false, error: "Invalid response format or empty content" };
      }

      // Extract base64
      const pattern = /data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/;
      const match = content.match(pattern);

      if (!match) {
        return { success: false, error: "No image found in response" };
      }

      const imageBuffer = Buffer.from(match[2], 'base64');
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
