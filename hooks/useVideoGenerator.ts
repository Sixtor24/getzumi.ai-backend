import { useState, useCallback } from 'react';

export type VideoGenerationParams = {
  prompt: string;
  model: string;
  seconds?: number;
  aspect_ratio?: string; // "16:9", "9:16", "1:1"
  input_images?: string[]; // Base64
  input_image?: string; // Legacy single image
};

export type VideoGenerationResult = {
  video_url: string;
};

export const useVideoGenerator = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [result, setResult] = useState<VideoGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');

  const generateVideo = useCallback(async (params: VideoGenerationParams) => {
    setLoading(true);
    setProgress(0);
    setStatus('Iniciando...');
    setError(null);
    setResult(null);
    setLogs('');

    try {
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error: ${response.statusText}`);
      }

      if (!response.body) throw new Error("No response body received");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let loop = true;

      while (loop) {
        const { done, value } = await reader.read();
        if (done) {
          loop = false;
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        
        // Process SSE lines
        const lines = accumulated.split('\n');
        accumulated = lines.pop() || ""; // Keep partial line

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            if (trimmed.includes('[DONE]')) continue;

            try {
                const jsonStr = trimmed.replace('data: ', '');
                const json = JSON.parse(jsonStr);
                
                if (json.choices?.[0]?.delta?.content) {
                    const content = json.choices[0].delta.content;
                    
                    // Update Logs
                    setLogs(prev => prev + content);

                    // Parse Status & Progress
                    // Example: "Status: processing (Progress: 45%)"
                    const pctMatch = content.match(/Progress:\s+(\d+(?:\.\d+)?)/);
                    if (pctMatch) {
                        setProgress(parseFloat(pctMatch[1]));
                    }
                    
                    const statusMatch = content.match(/Status:\s+(\w+)/);
                    if (statusMatch) {
                        setStatus(statusMatch[1]);
                    }

                    // Parse Final URL
                    // Example: "DONE: [Download Video](https://...)"
                    const urlMatch = content.match(/\[.*?\]\((https?:\/\/[^\s)]+)\)/);
                    if (urlMatch && urlMatch[1]) {
                        setResult({ video_url: urlMatch[1] });
                        setProgress(100);
                        setStatus('Completado');
                    }
                }
            } catch (e) {
                // Ignore parse errors on partial chunks
            }
        }
      }

    } catch (err: any) {
      setError(err.message || 'Error desconocido generando el video');
      setStatus('Fallido');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    generate: generateVideo,
    loading,
    progress,
    status,
    result,
    error,
    logs
  };
};
