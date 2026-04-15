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
  const supabaseUrl = env.SUPABASE_URL || '';
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabaseGalleryBucket = env.SUPABASE_GALLERY_BUCKET || 'gallery-images';
  const supabaseGalleryTable = env.SUPABASE_GALLERY_TABLE || 'gallery_images';

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

  const decodeDataUrl = (dataUrl) => {
    const match = String(dataUrl || '').match(/^data:(.+?);base64,(.+)$/);

    if (!match) {
      throw new Error('Invalid image data.');
    }

    return {
      mimeType: match[1],
      buffer: Buffer.from(match[2], 'base64'),
    };
  };

  const ensureSupabaseConfigured = () => {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
  };

  const getSupabaseHeaders = (extra = {}) => ({
    apikey: supabaseServiceRoleKey,
    Authorization: `Bearer ${supabaseServiceRoleKey}`,
    ...extra,
  });

  const buildSupabasePublicUrl = (filePath) =>
    `${supabaseUrl}/storage/v1/object/public/${supabaseGalleryBucket}/${filePath}`;

  const mapGalleryRecord = (record) => ({
    id: record.id,
    name: record.title || record.file_path?.split('/').pop() || 'obrázek',
    title: record.title || '',
    prompt: record.prompt || '',
    url: record.public_url,
    source: record.source || 'generated',
    createdAt: record.created_at,
    tags: Array.isArray(record.tags) ? record.tags : [],
    width: record.width || null,
    height: record.height || null,
  });

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

      server.middlewares.use('/api/flyer-assistant', async (req, res) => {
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
            sendJson(res, 400, { error: 'Missing flyer prompt.' });
            return;
          }

          const flyerModel = env.OPENAI_FLYER_MODEL || openAiChatModel;

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${openAiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: flyerModel,
              temperature: 0.55,
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
              error: payload?.error?.message || 'OpenAI flyer API error',
            });
            return;
          }

          const content = payload?.choices?.[0]?.message?.content;

          if (!content) {
            sendJson(res, 502, { error: 'OpenAI flyer did not return content.' });
            return;
          }

          let parsedPayload = {};

          try {
            parsedPayload = JSON.parse(content);
          } catch {
            parsedPayload = {};
          }

          sendJson(res, 200, {
            provider: 'OpenAI GPT',
            model: flyerModel,
            headline: typeof parsedPayload.headline === 'string' ? parsedPayload.headline.trim() : '',
            subheadline: typeof parsedPayload.subheadline === 'string' ? parsedPayload.subheadline.trim() : '',
            benefits: Array.isArray(parsedPayload.benefits) ? parsedPayload.benefits.filter(Boolean) : [],
            proof: typeof parsedPayload.proof === 'string' ? parsedPayload.proof.trim() : '',
            cta: typeof parsedPayload.cta === 'string' ? parsedPayload.cta.trim() : '',
          });
        } catch (error) {
          sendJson(res, 500, {
            error: error?.message || 'Flyer request failed',
          });
        }
      });

      server.middlewares.use('/api/visual-assistant', async (req, res) => {
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
            sendJson(res, 400, { error: 'Missing visual prompt.' });
            return;
          }

          const visualAssistantModel = env.OPENAI_VISUAL_ASSISTANT_MODEL || openAiChatModel;

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${openAiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: visualAssistantModel,
              temperature: 0.6,
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
              error: payload?.error?.message || 'OpenAI visual assistant API error',
            });
            return;
          }

          const content = payload?.choices?.[0]?.message?.content;

          if (!content) {
            sendJson(res, 502, { error: 'OpenAI visual assistant did not return content.' });
            return;
          }

          let parsedPayload = {};

          try {
            parsedPayload = JSON.parse(content);
          } catch {
            parsedPayload = {};
          }

          sendJson(res, 200, {
            provider: 'OpenAI GPT',
            model: visualAssistantModel,
            visualPrompt:
              typeof parsedPayload.visualPrompt === 'string'
                ? parsedPayload.visualPrompt.trim()
                : '',
          });
        } catch (error) {
          sendJson(res, 500, {
            error: error?.message || 'Visual assistant request failed',
          });
        }
      });

      server.middlewares.use('/api/company-by-ico', async (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { error: 'Method Not Allowed' });
          return;
        }

        try {
          const url = new URL(req.url || '/', 'http://localhost');
          const parts = url.pathname.split('/').filter(Boolean);
          const ico = String(parts[parts.length - 1] || '').replace(/\D/g, '');

          if (!ico || ico.length !== 8) {
            sendJson(res, 400, { error: 'IČO musí mít 8 číslic.' });
            return;
          }

          const response = await fetch(
            `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`,
            {
              headers: {
                Accept: 'application/json',
              },
            }
          );

          const payload = await response.json().catch(() => ({}));

          if (response.status === 404) {
            sendJson(res, 404, { error: 'Firma s tímto IČO nebyla v ARES nalezena.' });
            return;
          }

          if (!response.ok) {
            sendJson(res, response.status, {
              error: payload?.message || 'ARES lookup se nepodařilo načíst.',
            });
            return;
          }

          const addressParts = [
            payload?.sidlo?.nazevUlice,
            payload?.sidlo?.cisloDomovni,
            payload?.sidlo?.nazevObce,
            payload?.sidlo?.psc,
          ].filter(Boolean);

          const companyProfile = {
            ico,
            name:
              payload?.obchodniJmeno ||
              payload?.firma ||
              payload?.nazev ||
              '',
            legalForm: payload?.pravniForma?.nazev || '',
            industry: payload?.czNace?.length
              ? payload.czNace
                  .map((item) => item?.text || item?.nazev)
                  .filter(Boolean)
                  .join(', ')
              : '',
            address: addressParts.join(', '),
            statutoryPeople: [],
            recommendedContact: {
              label: 'vedení společnosti',
              personName: '',
              source: 'fallback',
            },
          };

          if (!companyProfile.name) {
            sendJson(res, 404, { error: 'Z ARES se nepodařilo získat název firmy.' });
            return;
          }

          sendJson(res, 200, companyProfile);
        } catch (error) {
          sendJson(res, 500, {
            error: error?.message || 'Nepodařilo se dohledat firmu podle IČO.',
          });
        }
      });

      server.middlewares.use('/api/gallery', async (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { error: 'Method Not Allowed' });
          return;
        }

        try {
          ensureSupabaseConfigured();

          const response = await fetch(
            `${supabaseUrl}/rest/v1/${supabaseGalleryTable}?select=id,title,prompt,source,file_path,public_url,mime_type,width,height,tags,created_at&order=created_at.desc`,
            {
              headers: getSupabaseHeaders(),
            }
          );

          const payload = await response.json().catch(() => []);

          if (!response.ok) {
            sendJson(res, response.status, {
              error: payload?.message || 'Failed to load gallery.',
            });
            return;
          }

          sendJson(res, 200, {
            items: Array.isArray(payload) ? payload.map(mapGalleryRecord) : [],
          });
        } catch (error) {
          sendJson(res, 500, {
            error: error?.message || 'Failed to load gallery.',
          });
        }
      });

      server.middlewares.use('/api/gallery/upload', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method Not Allowed' });
          return;
        }

        try {
          ensureSupabaseConfigured();

          const body = await readJsonBody(req);

          if (!body.dataUrl) {
            sendJson(res, 400, { error: 'Missing image data.' });
            return;
          }

          const { mimeType, buffer } = decodeDataUrl(body.dataUrl);
          const extension =
            mimeType === 'image/png'
              ? 'png'
              : mimeType === 'image/webp'
                ? 'webp'
                : 'jpg';
          const filePath = `generated/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

          const uploadResponse = await fetch(
            `${supabaseUrl}/storage/v1/object/${supabaseGalleryBucket}/${filePath}`,
            {
              method: 'POST',
              headers: getSupabaseHeaders({
                'Content-Type': mimeType,
                'x-upsert': 'false',
              }),
              body: buffer,
            }
          );

          const uploadPayload = await uploadResponse.json().catch(() => ({}));

          if (!uploadResponse.ok) {
            sendJson(res, uploadResponse.status, {
              error: uploadPayload?.message || 'Failed to upload image.',
            });
            return;
          }

          const insertResponse = await fetch(`${supabaseUrl}/rest/v1/${supabaseGalleryTable}`, {
            method: 'POST',
            headers: getSupabaseHeaders({
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            }),
            body: JSON.stringify([
              {
                title: String(body.title || '').trim(),
                prompt: String(body.prompt || '').trim(),
                source: String(body.source || 'generated').trim(),
                file_path: filePath,
                public_url: buildSupabasePublicUrl(filePath),
                mime_type: mimeType,
                tags: Array.isArray(body.tags) ? body.tags.filter(Boolean) : [],
              },
            ]),
          });

          const insertPayload = await insertResponse.json().catch(() => []);

          if (!insertResponse.ok) {
            sendJson(res, insertResponse.status, {
              error: insertPayload?.message || 'Failed to save gallery metadata.',
            });
            return;
          }

          sendJson(res, 201, {
            item: Array.isArray(insertPayload) && insertPayload[0] ? mapGalleryRecord(insertPayload[0]) : null,
          });
        } catch (error) {
          sendJson(res, 500, {
            error: error?.message || 'Failed to upload gallery image.',
          });
        }
      });
    },
  };

  return {
    plugins: [react(), tailwindcss(), openAiImagePlugin],
  };
});
