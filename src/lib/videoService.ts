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
      // SORA-2 API oficial usa JSON con Bearer
      // Model debe ser exactamente 'sora-2' según la documentación
      const submitPayload: any = {
        model: 'sora-2',
        prompt: prompt,
        seconds: '8',  // MUST be string according to API error
        size: '1280x720'  // Landscape by default
      };

      // Add input image if provided (for image-to-video)
      if (inputImage) {
        submitPayload.input_image = inputImage;
      }

      console.log('[VideoService] Submitting to SORA-2 API...');
      console.log('[VideoService] Request URL:', `${this.baseUrl}/v1/videos`);
      console.log('[VideoService] Full payload:', JSON.stringify(submitPayload, null, 2));
      console.log('[VideoService] API Key (first 20 chars):', this.apiKey.substring(0, 20) + '...');

      const submitResponse = await fetch(`${this.baseUrl}/v1/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(submitPayload),
      });

      console.log('[VideoService] SORA submit response status:', submitResponse.status);
      console.log('[VideoService] SORA response headers:', Object.fromEntries(submitResponse.headers.entries()));

      if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        console.error('[VideoService] SORA submit error:', errorText);
        return { success: false, error: `SORA API error ${submitResponse.status}: ${errorText}` };
      }

      const submitResult: any = await submitResponse.json();
      console.log('[VideoService] SORA task submitted successfully:', JSON.stringify(submitResult, null, 2));

      const videoId = submitResult.id;
      if (!videoId) {
        console.error('[VideoService] No video ID in SORA response. Full response:', submitResult);
        return { success: false, error: 'Invalid SORA response - no video ID' };
      }

      console.log('[VideoService] Starting SORA polling for video ID:', videoId);

      // Poll for result
      const videoUrl = await this.pollSoraTask(videoId);

      if (videoUrl) {
        console.log('[VideoService] ✅ SORA video generated successfully:', videoUrl);
        return { success: true, videoUrl, taskId: videoId };
      } else {
        console.error('[VideoService] ❌ SORA polling failed to get video URL after all attempts');
        return { success: false, error: 'Failed to get video from SORA - polling timeout or error', taskId: videoId };
      }
    } catch (error) {
      console.error('[VideoService] SORA generation exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SORA generation failed',
      };
    }
  }

  private async pollSoraTask(videoId: string): Promise<string | null> {
    const maxAttempts = 120; // 20 minutes max (10 segundos por intento)
    const pollInterval = 10000; // 10 segundos según documentación

    console.log(`[VideoService] Starting SORA polling for video ID: ${videoId}`);
    console.log(`[VideoService] Will poll up to ${maxAttempts} times (${maxAttempts * pollInterval / 1000 / 60} minutes)`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Wait before polling (except first attempt - check immediately)
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      try {
        const pollUrl = `${this.baseUrl}/v1/videos/${videoId}`;
        console.log(`[VideoService] SORA poll attempt ${attempt + 1}/${maxAttempts} - URL: ${pollUrl}`);
        
        const response = await fetch(pollUrl, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        });

        console.log(`[VideoService] SORA poll ${attempt + 1} - Status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[VideoService] SORA poll ${attempt + 1} error (${response.status}):`, errorText);
          
          // If 404, the video ID might be invalid
          if (response.status === 404) {
            console.error('[VideoService] Video ID not found - stopping polling');
            return null;
          }
          
          continue;
        }

        const result: any = await response.json();
        console.log(`[VideoService] SORA poll ${attempt + 1} - Full response:`, JSON.stringify(result, null, 2));

        // Check for completed status with multiple possible URL field names
        if (result.status === 'completed' || result.status === 'succeeded' || result.status === 'success') {
          const videoUrl = result.video_url || result.videoUrl || result.url || 
                          result.output?.video_url || result.output?.url ||
                          result.data?.video_url || result.data?.url;
          
          if (videoUrl) {
            console.log('[VideoService] ✅ SORA video URL found:', videoUrl);
            return videoUrl;
          } else {
            console.error('[VideoService] ⚠️ SORA marked as completed but no video URL found');
            console.error('[VideoService] Full result object:', JSON.stringify(result, null, 2));
            // Continue polling in case URL appears later
          }
        }

        if (result.status === 'failed' || result.status === 'error' || result.status === 'cancelled') {
          console.error('[VideoService] ❌ SORA task failed with status:', result.status);
          console.error('[VideoService] Error details:', result.error || result.message || 'No error details');
          return null;
        }

        // Log progress for in_progress status
        const status = result.status || 'unknown';
        const progress = result.progress || result.percent || 'unknown';
        console.log(`[VideoService] SORA status: ${status}, progress: ${progress}`);

        // Status: queued, in_progress, processing - continue polling
      } catch (error) {
        console.error(`[VideoService] SORA polling exception on attempt ${attempt + 1}:`, error);
        // Continue polling even on error
      }
    }

    console.error(`[VideoService] ❌ SORA polling timeout after ${maxAttempts} attempts (${maxAttempts * pollInterval / 1000 / 60} minutes)`);
    return null;
  }
}
