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
      // VEO has TWO different APIs:
      if (model.startsWith('veo-3.1')) {
        // VEO Async API: veo-3.1, veo-3.1-fast, veo-3.1-landscape-fast ($0.15-$0.25)
        console.log('[VideoService] Using VEO Async API (new)');
        return await this.generateVeoAsyncVideo(prompt, model, inputImage);
      } else if (model.startsWith('veo3') || model.includes('veo')) {
        // VEO Sync API: veo3, veo3-fast, veo3-pro ($2.00-$10.00)
        console.log('[VideoService] Using VEO Sync API (official)');
        return await this.generateVeoSyncVideo(prompt, model, inputImage);
      } else if (model === 'sora-2' || model === 'sora-2-pro' || model === 'sora-character') {
        console.log('[VideoService] Using SORA Async API (with polling)');
        return await this.generateSoraAsyncVideo(prompt, model, inputImage);
      } else if (model.includes('sora')) {
        console.log('[VideoService] Using SORA Streaming API (instant response)');
        return await this.generateSoraStreamingVideo(prompt, model, inputImage);
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

  private async generateVeoAsyncVideo(
    prompt: string,
    model: string,
    inputImage?: string
  ): Promise<VideoGenerationResult> {
    console.log('[VideoService] Generating VEO Async video:', { model, hasImage: !!inputImage });

    try {
      // VEO Async API uses model names as-is: veo-3.1, veo-3.1-fast, etc.
      const submitPayload: any = {
        prompt,
        model: model, // Use model name directly (no mapping needed)
      };

      console.log('[VideoService] Submitting to VEO Async API...');
      console.log('[VideoService] Request URL:', `${this.baseUrl}/v1/videos`);
      console.log('[VideoService] Request payload:', JSON.stringify(submitPayload, null, 2));
      console.log('[VideoService] API Key (first 20 chars):', this.apiKey.substring(0, 20) + '...');
      
      const submitResponse = await fetch(`${this.baseUrl}/v1/videos`, {
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
      if (responseText.trim().startsWith('<!doctype') || responseText.trim().startsWith('<html')) {
        console.error('[VideoService] VEO returned HTML instead of JSON');
        return { success: false, error: 'VEO API returned HTML - check API key or endpoint' };
      }

      let submitResult: any;
      try {
        submitResult = JSON.parse(responseText);
        console.log('[VideoService] VEO task submitted:', JSON.stringify(submitResult, null, 2));
      } catch (parseError) {
        console.error('[VideoService] Failed to parse VEO response:', parseError);
        return { success: false, error: 'Invalid JSON response from VEO API' };
      }

      // VEO uses same format as SORA: { id, status, model, etc }
      const taskId = submitResult.id;
      if (!taskId) {
        console.error('[VideoService] No task ID in VEO response:', submitResult);
        return { success: false, error: 'Invalid VEO response - no task ID' };
      }

      console.log('[VideoService] Starting VEO polling for task ID:', taskId);

      // Poll for result using /v1/videos/{id} endpoint
      const pollingUrl = `${this.baseUrl}/v1/videos/${taskId}`;
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

  private async generateVeoSyncVideo(
    prompt: string,
    model: string,
    inputImage?: string
  ): Promise<VideoGenerationResult> {
    console.log('[VideoService] Generating VEO Sync video (Official API):', { model, hasImage: !!inputImage });

    try {
      // VEO Sync API (Official) - uses different endpoint
      const submitPayload: any = {
        prompt,
        model: model, // veo3, veo3-fast, veo3-pro
        enhance_prompt: false,
      };

      if (inputImage) {
        submitPayload.images = [inputImage];
      }

      console.log('[VideoService] Submitting to VEO Sync API (Official)...');
      console.log('[VideoService] Request URL:', `${this.baseUrl}/veo/v1/api/video/submit`);
      console.log('[VideoService] Request payload:', JSON.stringify(submitPayload, null, 2));
      
      const submitResponse = await fetch(`${this.baseUrl}/veo/v1/api/video/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(submitPayload),
      });

      console.log('[VideoService] VEO Sync submit response status:', submitResponse.status);

      if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        console.error('[VideoService] VEO Sync submit error:', errorText);
        return { success: false, error: `VEO Sync API error: ${submitResponse.status}` };
      }

      const submitResult: any = await submitResponse.json();
      console.log('[VideoService] VEO Sync task submitted:', JSON.stringify(submitResult, null, 2));

      if (!submitResult.success || !submitResult.data?.taskId) {
        console.error('[VideoService] Invalid VEO Sync response:', submitResult);
        return { success: false, error: 'Invalid VEO Sync response' };
      }

      const { taskId, pollingUrl } = submitResult.data;
      console.log('[VideoService] Starting VEO Sync polling:', { taskId, pollingUrl });

      // Poll for result using the pollingUrl from response
      const videoUrl = await this.pollVeoSyncTask(pollingUrl, taskId);

      if (videoUrl) {
        console.log('[VideoService] ✅ VEO Sync video generated successfully:', videoUrl);
        return { success: true, videoUrl, taskId };
      } else {
        console.error('[VideoService] ❌ VEO Sync polling failed');
        return { success: false, error: 'Failed to get video from VEO Sync', taskId };
      }
    } catch (error) {
      console.error('[VideoService] VEO Sync generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'VEO Sync generation failed',
      };
    }
  }

  private async pollVeoSyncTask(pollingUrl: string, taskId: string): Promise<string | null> {
    const maxAttempts = 60; // 10 minutes max (10s interval)
    const pollInterval = 10000; // 10 seconds

    console.log(`[VideoService] Starting VEO Sync polling for ${maxAttempts * pollInterval / 1000}s`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      try {
        console.log(`[VideoService] VEO Sync poll attempt ${attempt + 1}/${maxAttempts}`);
        console.log(`[VideoService] Polling URL: ${pollingUrl}`);
        
        const response = await fetch(pollingUrl, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        });

        if (!response.ok) {
          console.log(`[VideoService] VEO Sync poll ${attempt + 1}: Response not OK (${response.status})`);
          continue;
        }

        const result: any = await response.json();
        console.log(`[VideoService] VEO Sync poll ${attempt + 1}:`, JSON.stringify(result, null, 2));

        // VEO Sync API response format
        if (result.success && result.data?.status === 'completed' && result.data?.result?.video_url) {
          const videoUrl = result.data.result.video_url;
          console.log('[VideoService] ✅ VEO Sync video URL found:', videoUrl);
          return videoUrl;
        }

        if (result.data?.status === 'failed') {
          console.error('[VideoService] ❌ VEO Sync task failed:', result);
          return null;
        }

        // Continue polling for processing status
      } catch (error) {
        console.error(`[VideoService] VEO Sync polling error on attempt ${attempt + 1}:`, error);
      }
    }

    console.error('[VideoService] ❌ VEO Sync polling timeout after 10 minutes');
    return null;
  }

  private async pollVeoTask(pollingUrl: string, taskId: string): Promise<string | null> {
    const maxAttempts = 60; // 5 minutes max
    const pollInterval = 5000; // 5 seconds

    console.log(`[VideoService] Starting VEO polling for ${maxAttempts * pollInterval / 1000}s`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      try {
        console.log(`[VideoService] VEO poll attempt ${attempt + 1}/${maxAttempts}`);
        
        const response = await fetch(pollingUrl, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        });

        if (!response.ok) {
          console.log(`[VideoService] VEO poll ${attempt + 1}: Response not OK (${response.status})`);
          continue;
        }

        const result: any = await response.json();
        console.log(`[VideoService] VEO poll ${attempt + 1}:`, JSON.stringify(result, null, 2));

        // Check for completed status - VEO uses same format as SORA
        if (result.status === 'completed' || result.status === 'succeeded') {
          const videoUrl = result.video_url || result.videoUrl || result.url || 
                          result.output?.video_url || result.data?.videoUrl;
          
          if (videoUrl) {
            console.log('[VideoService] ✅ VEO video URL found:', videoUrl);
            return videoUrl;
          }
        }

        if (result.status === 'failed' || result.status === 'error') {
          console.error('[VideoService] ❌ VEO task failed:', result);
          return null;
        }

        // Continue polling for queued/in_progress
      } catch (error) {
        console.error(`[VideoService] VEO polling error on attempt ${attempt + 1}:`, error);
      }
    }

    console.error('[VideoService] ❌ VEO polling timeout after 5 minutes');
    return null;
  }

  private async generateSoraAsyncVideo(
    prompt: string,
    model: string,
    inputImage?: string
  ): Promise<VideoGenerationResult> {
    console.log('[VideoService] Generating SORA Async video:', { model, hasImage: !!inputImage });

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

  private async generateSoraStreamingVideo(
    prompt: string,
    model: string,
    inputImage?: string
  ): Promise<VideoGenerationResult> {
    console.log('[VideoService] Generating SORA Streaming video:', { model, hasImage: !!inputImage });

    try {
      // SORA Video2 Streaming API - instant response, no polling needed
      // Endpoint: /v1/chat/completions (streaming mode)
      const payload: any = {
        model: model,
        stream: false,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      };

      // Add input image if provided
      if (inputImage) {
        payload.messages[0].content = [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: inputImage } }
        ];
      }

      console.log('[VideoService] Submitting to SORA Streaming API...');
      console.log('[VideoService] Request URL:', `${this.baseUrl}/v1/chat/completions`);
      console.log('[VideoService] Model:', model);
      console.log('[VideoService] Payload:', JSON.stringify(payload, null, 2));

      // Add timeout for streaming API (15 minutes max)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000); // 15 minutes

      console.log('[VideoService] Waiting for SORA Streaming response (max 15 minutes)...');
      const startTime = Date.now();

      let response;
      try {
        response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.error('[VideoService] SORA Streaming timeout after 15 minutes');
          return { success: false, error: 'Video generation timeout (15 minutes)' };
        }
        throw error;
      }

      clearTimeout(timeoutId);
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[VideoService] SORA Streaming response received in ${elapsedTime}s`);
      console.log('[VideoService] SORA Streaming response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VideoService] SORA Streaming error:', errorText);
        return { success: false, error: `SORA Streaming API error ${response.status}: ${errorText}` };
      }

      const result: any = await response.json();
      console.log('[VideoService] SORA Streaming response:', JSON.stringify(result, null, 2));

      // Extract video URL from response
      const content = result.choices?.[0]?.message?.content;
      if (!content) {
        console.error('[VideoService] No content in SORA Streaming response');
        return { success: false, error: 'No content in response' };
      }

      // Try to extract video URL from markdown format: ![video](url)
      const urlPattern = /!\[.*?\]\((https?:\/\/[^)]+)\)/;
      const urlMatch = content.match(urlPattern);
      
      if (urlMatch && urlMatch[1]) {
        const videoUrl = urlMatch[1];
        console.log('[VideoService] ✅ SORA Streaming video URL found:', videoUrl);
        return { success: true, videoUrl };
      }

      // Try direct URL in content
      const directUrlPattern = /(https?:\/\/[^\s]+\.mp4[^\s]*)/;
      const directMatch = content.match(directUrlPattern);
      
      if (directMatch && directMatch[1]) {
        const videoUrl = directMatch[1];
        console.log('[VideoService] ✅ SORA Streaming video URL found (direct):', videoUrl);
        return { success: true, videoUrl };
      }

      console.error('[VideoService] Could not extract video URL from content:', content);
      return { success: false, error: 'Could not extract video URL from response' };

    } catch (error) {
      console.error('[VideoService] SORA Streaming exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SORA Streaming failed',
      };
    }
  }
}
