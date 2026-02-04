interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  taskId?: string;
  error?: string;
}

export class VideoGenerationService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = "https://api.apiyi.com";
  }

  async generateVideo(
    prompt: string,
    model: string,
    inputImage?: string
  ): Promise<VideoGenerationResult> {
    console.log('[VideoService] generateVideo called:', { prompt: prompt.substring(0, 50), model, hasImage: !!inputImage });
    
    try {
      // Determine which API to use based on model
      if (model.includes('veo')) {
        console.log('[VideoService] Using VEO API');
        return await this.generateVeoVideo(prompt, model, inputImage);
      } else if (model.includes('sora')) {
        console.log('[VideoService] Using SORA API');
        return await this.generateSoraVideo(prompt, model, inputImage);
      } else {
        console.error('[VideoService] Unsupported model:', model);
        return { success: false, error: `Unsupported model: ${model}` };
      }
    } catch (error) {
      console.error('[VideoService] Unexpected error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async generateVeoVideo(
    prompt: string,
    model: string,
    inputImage?: string
  ): Promise<VideoGenerationResult> {
    console.log('[VideoService] Generating VEO video:', { model, hasImage: !!inputImage });

    try {
      // Map model names to VEO API format
      const veoModelMap: Record<string, string> = {
        'veo-3.1': 'veo3',
        'veo-3.1-fast': 'veo3-fast',
        'veo-3.1-pro': 'veo3-pro',
        'veo3': 'veo3',
        'veo3-fast': 'veo3-fast',
        'veo3-pro': 'veo3-pro',
      };

      const veoModel = veoModelMap[model] || 'veo3';
      console.log('[VideoService] Mapped model:', veoModel);

      // Submit task
      const submitPayload: any = {
        prompt,
        model: veoModel,
        enhance_prompt: false,
      };

      if (inputImage) {
        submitPayload.images = [inputImage];
      }

      console.log('[VideoService] Submitting to VEO API...');
      console.log('[VideoService] Request URL:', `${this.baseUrl}/veo/v1/api/video/submit`);
      console.log('[VideoService] Request payload:', JSON.stringify(submitPayload, null, 2));
      console.log('[VideoService] API Key (first 20 chars):', this.apiKey.substring(0, 20) + '...');
      
      const submitResponse = await fetch(`${this.baseUrl}/veo/v1/api/video/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(submitPayload),
      });

      console.log('[VideoService] VEO submit response status:', submitResponse.status);
      console.log('[VideoService] VEO response headers:', Object.fromEntries(submitResponse.headers.entries()));

      // Get response as text first to check if it's HTML
      const responseText = await submitResponse.text();
      console.log('[VideoService] VEO response (first 500 chars):', responseText.substring(0, 500));

      if (!submitResponse.ok) {
        console.error('[VideoService] VEO submit error:', responseText);
        return { success: false, error: `VEO API error: ${submitResponse.status}` };
      }

      // Check if response is HTML instead of JSON
      if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
        console.error('[VideoService] VEO returned HTML instead of JSON');
        return { success: false, error: 'VEO API returned HTML - check API key or endpoint' };
      }

      let submitResult: any;
      try {
        submitResult = JSON.parse(responseText);
        console.log('[VideoService] VEO task submitted:', submitResult);
      } catch (parseError) {
        console.error('[VideoService] Failed to parse VEO response:', parseError);
        return { success: false, error: 'Invalid JSON response from VEO API' };
      }

      if (!submitResult.success || !submitResult.data?.taskId) {
        console.error('[VideoService] Invalid VEO response structure:', submitResult);
        return { success: false, error: 'Invalid VEO response' };
      }

      const { taskId, pollingUrl } = submitResult.data;
      console.log('[VideoService] Starting polling:', { taskId, pollingUrl });

      // Poll for result
      const videoUrl = await this.pollVeoTask(pollingUrl, taskId);

      if (videoUrl) {
        console.log('[VideoService] VEO video generated successfully:', videoUrl);
        return { success: true, videoUrl, taskId };
      } else {
        console.error('[VideoService] Polling failed to get video URL');
        return { success: false, error: 'Failed to get video from VEO', taskId };
      }
    } catch (error) {
      console.error('[VideoService] VEO generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'VEO generation failed',
      };
    }
  }

  private async pollVeoTask(pollingUrl: string, taskId: string): Promise<string | null> {
    const maxAttempts = 60; // 5 minutes max
    const pollInterval = 5000; // 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      try {
        const response = await fetch(pollingUrl, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        });

        if (!response.ok) continue;

        const result: any = await response.json();
        console.log(`[VideoService] VEO poll attempt ${attempt + 1}:`, result.status);

        if (result.status === 'completed' && result.data?.videoUrl) {
          return result.data.videoUrl;
        }

        if (result.status === 'failed') {
          console.error('[VideoService] VEO task failed:', result);
          return null;
        }
      } catch (error) {
        console.error('[VideoService] Polling error:', error);
      }
    }

    console.error('[VideoService] VEO polling timeout');
    return null;
  }

  private async generateSoraVideo(
    prompt: string,
    model: string,
    inputImage?: string
  ): Promise<VideoGenerationResult> {
    console.log('[VideoService] Generating SORA video:', { model, hasImage: !!inputImage });

    try {
      // SORA requires multipart/form-data
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      
      formData.append('prompt', prompt);
      formData.append('model', 'sora-2');
      formData.append('size', '1280x720');
      formData.append('seconds', '10');

      console.log('[VideoService] Submitting to SORA API...');
      console.log('[VideoService] Request URL:', `${this.baseUrl}/v1/videos`);

      const submitResponse = await fetch(`${this.baseUrl}/v1/videos`, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,  // SORA no usa "Bearer" con multipart/form-data
          ...formData.getHeaders(),
        },
        body: formData as any,
      });

      console.log('[VideoService] SORA submit response status:', submitResponse.status);

      const responseText = await submitResponse.text();
      console.log('[VideoService] SORA response (first 500 chars):', responseText.substring(0, 500));

      if (!submitResponse.ok) {
        console.error('[VideoService] SORA submit error:', responseText);
        return { success: false, error: `SORA API error: ${submitResponse.status}` };
      }

      // Check if response is HTML
      if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
        console.error('[VideoService] SORA returned HTML instead of JSON');
        return { success: false, error: 'SORA API returned HTML - check API key or endpoint' };
      }

      let submitResult: any;
      try {
        submitResult = JSON.parse(responseText);
        console.log('[VideoService] SORA task submitted:', submitResult);
      } catch (parseError) {
        console.error('[VideoService] Failed to parse SORA response:', parseError);
        return { success: false, error: 'Invalid JSON response from SORA API' };
      }

      const videoId = submitResult.id || submitResult.video_id;
      if (!videoId) {
        console.error('[VideoService] No video ID in SORA response:', submitResult);
        return { success: false, error: 'Invalid SORA response - no video ID' };
      }

      console.log('[VideoService] Starting SORA polling:', videoId);

      // Poll for result
      const videoUrl = await this.pollSoraTask(videoId);

      if (videoUrl) {
        console.log('[VideoService] SORA video generated successfully:', videoUrl);
        return { success: true, videoUrl, taskId: videoId };
      } else {
        console.error('[VideoService] SORA polling failed to get video URL');
        return { success: false, error: 'Failed to get video from SORA', taskId: videoId };
      }
    } catch (error) {
      console.error('[VideoService] SORA generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SORA generation failed',
      };
    }
  }

  private async pollSoraTask(videoId: string): Promise<string | null> {
    const maxAttempts = 60;
    const pollInterval = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      try {
        const response = await fetch(`${this.baseUrl}/v1/videos/${videoId}`, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        });

        if (!response.ok) continue;

        const result: any = await response.json();
        console.log(`[VideoService] SORA poll attempt ${attempt + 1}:`, result.status);

        if (result.status === 'completed' && result.video_url) {
          return result.video_url;
        }

        if (result.status === 'failed') {
          console.error('[VideoService] SORA task failed:', result);
          return null;
        }
      } catch (error) {
        console.error('[VideoService] Polling error:', error);
      }
    }

    console.error('[VideoService] SORA polling timeout');
    return null;
  }
}
