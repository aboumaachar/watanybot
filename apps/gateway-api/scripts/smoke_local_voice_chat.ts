import fs from 'node:fs';
import path from 'node:path';

import Fastify from 'fastify';

import voiceRoutes from '../src/routes/voice.ts';

const candidateAudioPaths = [
  path.resolve('../../tts_test.mp3'),
  path.resolve('../../../tts_test.mp3'),
  path.resolve('../../_test_audio.mp3'),
  path.resolve('../../../_test_audio.mp3'),
  path.resolve('tts_test.mp3'),
  path.resolve('_test_audio.mp3'),
];

const audioPath = candidateAudioPaths.find((candidate) => fs.existsSync(candidate));

if (!audioPath) {
  throw new Error('Could not find _test_audio.mp3 for smoke test');
}

process.env.STT_PROVIDER = 'local';
process.env.WHISPER_SERVICE_URL = process.env.WHISPER_SERVICE_URL || 'http://127.0.0.1:8001/transcribe';
process.env.VOICE_MAX_REPLY_WORDS = process.env.VOICE_MAX_REPLY_WORDS || '45';

const app = Fastify();

await app.register(voiceRoutes, {
  fetchChatResponse: async ({ message }) => ({
    reply: `تم استلام الرسالة الصوتية: ${message}`,
    debug: {
      sources: [{ id: 'smoke-local-1', title: 'Local Smoke Source', score: 0.99 }],
    },
  }),
  evaluateRelevance: () => ({
    confidence: 'high',
    score: 0.99,
    topScore: 0.99,
  }),
});

await app.ready();

try {
  const audioBase64 = fs.readFileSync(audioPath).toString('base64');
  const response = await app.inject({
    method: 'POST',
    url: '/api/voice/chat',
    headers: { 'content-type': 'application/json' },
    payload: {
      audio: audioBase64,
      mime: 'audio/mpeg',
      lang: 'ar',
      channel: 'voice',
    },
  });

  console.log(
    JSON.stringify(
      {
        statusCode: response.statusCode,
        body: JSON.parse(response.body),
      },
      null,
      2,
    ),
  );
} finally {
  await app.close();
}