import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const openAiApiKey = env.OPENAI_API_KEY || '';
  const openAiImageModel = env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const openAiImageQuality = env.OPENAI_IMAGE_QUALITY || 'medium';
  const openAiImageSize = env.OPENAI_IMAGE_SIZE || '1024x1024';
  const openAiChatModel = env.OPENAI_CHAT_MODEL || 'gpt-4.1-mini';

  const readJsonBody = async (req) => {
    let rawBody = '';

    for await (const chunk of req) {
      rawBody += chunk;
    }

    return rawBody ? JSON.parse(rawBody) : {};
  };

  const sendJson = (res, statusCode, payload) => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  };

  const extractBase64Image = async (response, res) => {
    const payload = await response.json();

    if (!response.ok) {
      sendJson(res, response.status, {
        error: payload?.error?.message || `HTTP ${response.status}`,
      });
      return null;
    }

    const base64Image = payload?.data?.[0]?.b64_json;

    if (!base64Image) {
      sendJson(res, 502, { error: 'OpenAI did not return an image.' });
      return null;
    }

    return base64Image;
  };

  const dataUrlToFile = (dataUrl, fileName = 'source-image.png') => {
    const match = String(dataUrl || '').match(/^data:(.+?);base64,(.+)$/);

    if (!match) {
      throw new Error('Invalid image data.');
    }

    const mimeType = match[1];
    const base64 = match[2];
    const bytes = Buffer.from(base64, 'base64');

    return new File([bytes], fileName, { type: mimeType });
  };

  const openAiImagePlugin = {
    name: 'openai-image-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/generate-image', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method Not Allowed' });
          return;
        }

        if (!openAiApiKey) {
          sendJson(res, 500, { error: 'Missing OPENAI_API_KEY' });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${openAiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: openAiImageModel,
              prompt: body.prompt || '',
              size: openAiImageSize,
              quality: openAiImageQuality,
            }),
          });

          const base64Image = await extractBase64Image(response, res);
          if (!base64Image) {
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'image/png');
          res.end(Buffer.from(base64Image, 'base64'));
        } catch (error) {
          sendJson(res, 500, {
            error: error?.message || 'Image generation failed',
          });
        }
      });

      server.middlewares.use('/api/edit-image', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method Not Allowed' });
          return;
        }

        if (!openAiApiKey) {
          sendJson(res, 500, { error: 'Missing OPENAI_API_KEY' });
          return;
        }

        try {
          const body = await readJsonBody(req);

          if (!body.imageDataUrl) {
            sendJson(res, 400, { error: 'Missing source image.' });
            return;
          }

          const formData = new FormData();
          formData.append('model', openAiImageModel);
          formData.append('prompt', body.prompt || '');
          formData.append('size', openAiImageSize);
          formData.append('quality', openAiImageQuality);
          formData.append(
            'image',
            dataUrlToFile(body.imageDataUrl, body.fileName || 'source-image.png')
          );

          const response = await fetch('https://api.openai.com/v1/images/edits', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${openAiApiKey}`,
            },
            body: formData,
          });

          const base64Image = await extractBase64Image(response, res);
          if (!base64Image) {
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'image/png');
          res.end(Buffer.from(base64Image, 'base64'));
        } catch (error) {
          sendJson(res, 500, {
            error: error?.message || 'Image edit failed',
          });
        }
      });

      server.middlewares.use('/api/chat-assistant', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method Not Allowed' });
          return;
        }

        if (!openAiApiKey) {
          sendJson(res, 500, { error: 'Missing OPENAI_API_KEY' });
          return;
        }

        try {
          const body = await readJsonBody(req);

          if (!body.systemPrompt || !body.prompt) {
            sendJson(res, 400, { error: 'Missing chat prompt.' });
            return;
          }

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${openAiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: openAiChatModel,
              temperature: 0.35,
              response_format: {
                type: 'json_object',
              },
              messages: [
                {
                  role: 'system',
                  content: body.systemPrompt,
                },
                {
                  role: 'user',
                  content: body.prompt,
                },
              ],
            }),
          });

          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            sendJson(res, response.status, {
              error: payload?.error?.message || 'OpenAI chat API error',
            });
            return;
          }

          const content = payload?.choices?.[0]?.message?.content;

          if (!content) {
            sendJson(res, 502, { error: 'OpenAI chat did not return content.' });
            return;
          }

          let parsedPayload = {};

          try {
            parsedPayload = JSON.parse(content);
          } catch {
            parsedPayload = {};
          }

          const reply =
            typeof parsedPayload.reply === 'string' && parsedPayload.reply.trim()
              ? parsedPayload.reply.trim()
              : body.userExplicitlyRequestsEdit
                ? 'Úpravu jsem zpracoval.'
                : body.chatMode === 'advice'
                  ? 'Tady je moje doporučení.'
                  : 'Tady je moje odpověď.';

          const normalizedUpdatedMainText =
            typeof parsedPayload.updatedMainText === 'string' && parsedPayload.updatedMainText.trim()
              ? parsedPayload.updatedMainText.trim()
              : body.currentMainText || '';
          const normalizedUpdatedVisualPrompt =
            typeof parsedPayload.updatedVisualPrompt === 'string'
              ? parsedPayload.updatedVisualPrompt.trim()
              : body.currentVisualPrompt || '';
          const normalizedUpdatedHashtags = Array.isArray(parsedPayload.updatedHashtags)
            ? parsedPayload.updatedHashtags.filter(Boolean)
            : String(body.currentHashtags || '')
                .split(/\s+/)
                .filter(Boolean);
          const normalizedUpdatedFlyerTitle =
            typeof parsedPayload.updatedFlyerTitle === 'string' &&
            parsedPayload.updatedFlyerTitle.trim()
              ? parsedPayload.updatedFlyerTitle.trim()
              : body.currentFlyerTitle || '';
          const normalizedUpdatedFlyerText =
            typeof parsedPayload.updatedFlyerText === 'string' &&
            parsedPayload.updatedFlyerText.trim()
              ? parsedPayload.updatedFlyerText.trim()
              : body.currentFlyerText || '';

          const hasMaterialChanges =
            normalizedUpdatedMainText !== (body.currentMainText || '') ||
            normalizedUpdatedVisualPrompt !== (body.currentVisualPrompt || '') ||
            normalizedUpdatedHashtags.join(' ') !== String(body.currentHashtags || '').trim() ||
            normalizedUpdatedFlyerTitle !== (body.currentFlyerTitle || '') ||
            normalizedUpdatedFlyerText !== (body.currentFlyerText || '');

          const applyChanges = Boolean(
            body.userExplicitlyRequestsEdit && parsedPayload.applyChanges && hasMaterialChanges
          );

          sendJson(res, 200, {
            provider: 'OpenAI GPT',
            model: openAiChatModel,
            reply,
            applyChanges,
            updatedMainText: normalizedUpdatedMainText,
            updatedVisualPrompt: normalizedUpdatedVisualPrompt,
            updatedHashtags: normalizedUpdatedHashtags,
            updatedFlyerTitle: normalizedUpdatedFlyerTitle,
            updatedFlyerText: normalizedUpdatedFlyerText,
          });
        } catch (error) {
          sendJson(res, 500, {
            error: error?.message || 'Chat request failed',
          });
        }
      });
    },
  };

  return {
    plugins: [react(), tailwindcss(), openAiImagePlugin],
  };
});
