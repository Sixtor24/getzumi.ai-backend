import { env } from '@/server/env';

export async function elevenLabsTts(params: {
  voiceId: string;
  text: string;
  modelId?: string;
}): Promise<ArrayBuffer> {
  if (!env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not set');
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${params.voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY,
      'content-type': 'application/json',
      accept: 'audio/mpeg'
    },
    body: JSON.stringify({
      text: params.text,
      model_id: params.modelId ?? 'eleven_multilingual_v2'
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs error ${res.status}: ${body}`);
  }

  return await res.arrayBuffer();
}
