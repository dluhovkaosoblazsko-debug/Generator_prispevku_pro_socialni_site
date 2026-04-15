import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseGalleryBucket = process.env.SUPABASE_GALLERY_BUCKET || 'gallery-images';
const supabaseGalleryTable = process.env.SUPABASE_GALLERY_TABLE || 'gallery_images';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: '20mb' }));

function normalizeIco(value) {
  return String(value || '').replace(/\D/g, '').trim();
}

function collectStatutoryCandidates(node, path = '') {
  if (!node || typeof node !== 'object') return [];

  const normalizedPath = path.toLowerCase();
  const results = [];

  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      results.push(...collectStatutoryCandidates(item, `${path}[${index}]`));
    });
    return results;
  }

  const objectKeys = Object.keys(node);
  const keySignature = objectKeys.join(' ').toLowerCase();
  const looksLikeStatutoryNode =
    /statutar|jednatel|predstaven|spravn/i.test(normalizedPath) ||
    /statutar|jednatel|predstaven|spravn/i.test(keySignature);

  if (looksLikeStatutoryNode) {
    const role =
      node.funkce?.nazev ||
      node.funkce ||
      node.typFunkce?.nazev ||
      node.typFunkce ||
      node.nazevFunkce ||
      node.zpusobJednani ||
      '';

    const personName =
      node.jmenoCele ||
      node.nazevOsoby ||
      node.obchodniFirma ||
      [node.jmeno, node.prostredniJmeno, node.prijmeni].filter(Boolean).join(' ').trim();

    if (role || personName) {
      results.push({
        role: String(role || '').trim(),
        name: String(personName || '').trim(),
      });
    }
  }

  Object.entries(node).forEach(([key, value]) => {
    if (value && typeof value === 'object') {
      results.push(...collectStatutoryCandidates(value, path ? `${path}.${key}` : key));
    }
  });

  return results;
}

function dedupeCandidates(candidates) {
  const seen = new Set();

  return candidates.filter((candidate) => {
    const signature = `${candidate.role || ''}|${candidate.name || ''}`.toLowerCase();
    if (!signature || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function getRecommendedContact(company) {
  const normalizedIndustry = String(company.industry || '').toLowerCase();
  const normalizedLegalForm = String(company.legalForm || '').toLowerCase();

  if (company.statutoryPeople?.length) {
    const primary = company.statutoryPeople[0];
    if (primary.name && primary.role) {
      return {
        label: `${primary.name} (${primary.role})`,
        role: primary.role,
        personName: primary.name,
        source: 'ares-statutory',
      };
    }

    if (primary.role) {
      return {
        label: primary.role,
        role: primary.role,
        personName: '',
        source: 'ares-statutory',
      };
    }
  }

  if (/společenství vlastníků|bytov/i.test(normalizedIndustry)) {
    return {
      label: 'výbor SVJ nebo předseda společenství',
      role: 'výbor SVJ / předseda společenství',
      personName: '',
      source: 'heuristic',
    };
  }

  if (/sprav|nemovitost|ubytov|bytov/i.test(normalizedIndustry)) {
    return {
      label: 'správa objektu nebo vedení společnosti',
      role: 'správa objektu / vedení společnosti',
      personName: '',
      source: 'heuristic',
    };
  }

  if (/vyroba|prumysl|logistik|sklad|doprava|stav/i.test(normalizedIndustry)) {
    return {
      label: 'provozní ředitel nebo jednatel',
      role: 'provozní ředitel / jednatel',
      personName: '',
      source: 'heuristic',
    };
  }

  if (/akciov/i.test(normalizedLegalForm)) {
    return {
      label: 'člen představenstva nebo vedení společnosti',
      role: 'člen představenstva / vedení společnosti',
      personName: '',
      source: 'heuristic',
    };
  }

  if (/společnost s ručením omezeným|s\\.r\\.o/i.test(normalizedLegalForm)) {
    return {
      label: 'jednatel společnosti',
      role: 'jednatel',
      personName: '',
      source: 'heuristic',
    };
  }

  return {
    label: 'vedení společnosti',
    role: 'vedení společnosti',
    personName: '',
    source: 'fallback',
  };
}

function buildCompanyProfile(payload, ico) {
  const sidlo = payload?.sidlo || {};
  const addressParts = [
    sidlo?.nazevUlice,
    [sidlo?.cisloDomovni, sidlo?.cisloOrientacni ? `/${sidlo.cisloOrientacni}` : '']
      .filter(Boolean)
      .join(''),
    sidlo?.nazevObce,
    sidlo?.psc ? String(sidlo.psc) : '',
  ].filter(Boolean);

  return {
    ico,
    name:
      payload?.obchodniJmeno ||
      payload?.obchodniFirma ||
      payload?.nazev ||
      payload?.jmeno ||
      '',
    legalForm: payload?.pravniForma?.nazev || '',
    industry: payload?.czNace?.length ? payload.czNace.map((item) => item?.text || item?.nazev).filter(Boolean).join(', ') : '',
    address: addressParts.join(', '),
    statutoryPeople: dedupeCandidates(collectStatutoryCandidates(payload)).slice(0, 5),
  };
}

function dataUrlToFile(dataUrl, fileName = 'source-image.png') {
  const match = String(dataUrl || '').match(/^data:(.+?);base64,(.+)$/);

  if (!match) {
    throw new Error('Neplatná data obrázku.');
  }

  const mimeType = match[1];
  const base64 = match[2];
  const bytes = Buffer.from(base64, 'base64');

  return new File([bytes], fileName, { type: mimeType });
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(.+?);base64,(.+)$/);

  if (!match) {
    throw new Error('Neplatná data obrázku.');
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function ensureSupabaseConfigured() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Chybí SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY.');
  }
}

function getSupabaseHeaders(extra = {}) {
  return {
    apikey: supabaseServiceRoleKey,
    Authorization: `Bearer ${supabaseServiceRoleKey}`,
    ...extra,
  };
}

function buildSupabasePublicUrl(filePath) {
  return `${supabaseUrl}/storage/v1/object/public/${supabaseGalleryBucket}/${filePath}`;
}

function mapGalleryRecord(record) {
  return {
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
  };
}

app.post('/api/chat-assistant', async (req, res) => {
  try {
    const {
      systemPrompt,
      prompt,
      currentMainText = '',
      currentVisualPrompt = '',
      currentHashtags = '',
      currentFlyerTitle = '',
      currentFlyerText = '',
      userExplicitlyRequestsEdit = false,
      chatMode = 'chat',
      userRequestsHeading = false,
    } = req.body || {};

    if (!systemPrompt || !prompt) {
      return res.status(400).json({ error: 'Chybí prompt pro chat.' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Chybí OPENAI_API_KEY.' });
    }

    const model = process.env.OPENAI_CHAT_MODEL || 'gpt-4.1-mini';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: {
          type: 'json_object',
        },
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'OpenAI chat API chyba',
      });
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: 'OpenAI chat nevrátil obsah.' });
    }

    let payload = {};

    try {
      payload = JSON.parse(content);
    } catch {
      payload = {};
    }

    const reply =
      typeof payload.reply === 'string' && payload.reply.trim()
        ? payload.reply.trim()
        : userExplicitlyRequestsEdit
          ? 'Úpravu jsem zpracoval.'
          : chatMode === 'advice'
            ? 'Tady je moje doporučení.'
            : 'Tady je moje odpověď.';

    const normalizedUpdatedMainText =
      typeof payload.updatedMainText === 'string' && payload.updatedMainText.trim()
        ? payload.updatedMainText.trim()
        : currentMainText;
    const normalizedUpdatedVisualPrompt =
      typeof payload.updatedVisualPrompt === 'string'
        ? payload.updatedVisualPrompt.trim()
        : currentVisualPrompt;
    const normalizedUpdatedHashtags = Array.isArray(payload.updatedHashtags)
      ? payload.updatedHashtags.filter(Boolean)
      : String(currentHashtags || '')
          .split(/\s+/)
          .filter(Boolean);
    const normalizedUpdatedFlyerTitle =
      typeof payload.updatedFlyerTitle === 'string' && payload.updatedFlyerTitle.trim()
        ? payload.updatedFlyerTitle.trim()
        : currentFlyerTitle;
    const normalizedUpdatedFlyerText =
      typeof payload.updatedFlyerText === 'string' && payload.updatedFlyerText.trim()
        ? payload.updatedFlyerText.trim()
        : currentFlyerText;

    const hasMaterialChanges =
      normalizedUpdatedMainText !== currentMainText ||
      normalizedUpdatedVisualPrompt !== currentVisualPrompt ||
      normalizedUpdatedHashtags.join(' ') !== String(currentHashtags || '').trim() ||
      normalizedUpdatedFlyerTitle !== currentFlyerTitle ||
      normalizedUpdatedFlyerText !== currentFlyerText;

    const applyChanges = Boolean(userExplicitlyRequestsEdit && payload.applyChanges && hasMaterialChanges);

    return res.json({
      provider: 'OpenAI GPT',
      model,
      reply,
      applyChanges,
      updatedMainText: normalizedUpdatedMainText,
      updatedVisualPrompt: normalizedUpdatedVisualPrompt,
      updatedHashtags: normalizedUpdatedHashtags,
      updatedFlyerTitle: normalizedUpdatedFlyerTitle,
      updatedFlyerText: normalizedUpdatedFlyerText,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Neočekávaná chyba serveru.',
    });
  }
});

app.post('/api/flyer-assistant', async (req, res) => {
  try {
    const { systemPrompt, prompt } = req.body || {};

    if (!systemPrompt || !prompt) {
      return res.status(400).json({ error: 'Chybí prompt pro leták.' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Chybí OPENAI_API_KEY.' });
    }

    const model = process.env.OPENAI_FLYER_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-4.1-mini';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.55,
        response_format: {
          type: 'json_object',
        },
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'OpenAI flyer API chyba',
      });
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: 'OpenAI flyer API nevrátila obsah.' });
    }

    let payload = {};

    try {
      payload = JSON.parse(content);
    } catch {
      payload = {};
    }

    return res.json({
      provider: 'OpenAI GPT',
      model,
      headline: typeof payload.headline === 'string' ? payload.headline.trim() : '',
      subheadline: typeof payload.subheadline === 'string' ? payload.subheadline.trim() : '',
      benefits: Array.isArray(payload.benefits) ? payload.benefits.filter(Boolean) : [],
      proof: typeof payload.proof === 'string' ? payload.proof.trim() : '',
      cta: typeof payload.cta === 'string' ? payload.cta.trim() : '',
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Neočekávaná chyba serveru.',
    });
  }
});

app.post('/api/visual-assistant', async (req, res) => {
  try {
    const { systemPrompt, prompt } = req.body || {};

    if (!systemPrompt || !prompt) {
      return res.status(400).json({ error: 'Chybí prompt pro vizuál.' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Chybí OPENAI_API_KEY.' });
    }

    const model =
      process.env.OPENAI_VISUAL_ASSISTANT_MODEL ||
      process.env.OPENAI_CHAT_MODEL ||
      'gpt-4.1-mini';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        response_format: {
          type: 'json_object',
        },
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'OpenAI visual assistant API chyba',
      });
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: 'OpenAI visual assistant API nevrátila obsah.' });
    }

    let payload = {};

    try {
      payload = JSON.parse(content);
    } catch {
      payload = {};
    }

    return res.json({
      provider: 'OpenAI GPT',
      model,
      visualPrompt:
        typeof payload.visualPrompt === 'string' ? payload.visualPrompt.trim() : '',
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Neočekávaná chyba serveru.',
    });
  }
});

app.get('/api/gallery', async (_req, res) => {
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
      return res.status(response.status).json({
        error: payload?.message || 'Nepodařilo se načíst galerii.',
      });
    }

    return res.json({
      items: Array.isArray(payload) ? payload.map(mapGalleryRecord) : [],
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Nepodařilo se načíst galerii.',
    });
  }
});

app.post('/api/gallery/upload', async (req, res) => {
  try {
    ensureSupabaseConfigured();

    const {
      dataUrl,
      title = '',
      prompt = '',
      source = 'generated',
      tags = [],
    } = req.body || {};

    if (!dataUrl) {
      return res.status(400).json({ error: 'Chybí obrázek pro uložení.' });
    }

    const { mimeType, buffer } = decodeDataUrl(dataUrl);
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
      return res.status(uploadResponse.status).json({
        error: uploadPayload?.message || 'Nepodařilo se nahrát obrázek do úložiště.',
      });
    }

    const publicUrl = buildSupabasePublicUrl(filePath);

    const insertBody = [
      {
        title: String(title || '').trim(),
        prompt: String(prompt || '').trim(),
        source: String(source || 'generated').trim(),
        file_path: filePath,
        public_url: publicUrl,
        mime_type: mimeType,
        tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
      },
    ];

    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/${supabaseGalleryTable}`, {
      method: 'POST',
      headers: getSupabaseHeaders({
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }),
      body: JSON.stringify(insertBody),
    });

    const insertPayload = await insertResponse.json().catch(() => []);

    if (!insertResponse.ok) {
      return res.status(insertResponse.status).json({
        error: insertPayload?.message || 'Nepodařilo se uložit metadata obrázku.',
      });
    }

    const savedRecord = Array.isArray(insertPayload) ? insertPayload[0] : null;

    return res.status(201).json({
      item: savedRecord ? mapGalleryRecord(savedRecord) : null,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Nepodařilo se uložit obrázek do galerie.',
    });
  }
});

app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Chybí prompt.' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Chybí OPENAI_API_KEY.' });
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'OpenAI API chyba',
      });
    }

    const imageBase64 = data?.data?.[0]?.b64_json;

    if (!imageBase64) {
      return res.status(500).json({ error: 'OpenAI nevrátil obrázek.' });
    }

    const imageBuffer = Buffer.from(imageBase64, 'base64');

    res.setHeader('Content-Type', 'image/png');
    res.send(imageBuffer);
  } catch (err) {
    res.status(500).json({
      error: err.message || 'Neočekávaná chyba serveru.',
    });
  }
});

app.post('/api/edit-image', async (req, res) => {
  try {
    const { prompt, imageDataUrl, fileName } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Chybí prompt.' });
    }

    if (!imageDataUrl) {
      return res.status(400).json({ error: 'Chybí zdrojová fotka.' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Chybí OPENAI_API_KEY.' });
    }

    const formData = new FormData();
    formData.append('model', 'gpt-image-1');
    formData.append('prompt', prompt);
    formData.append('size', '1024x1024');
    formData.append('image', dataUrlToFile(imageDataUrl, fileName || 'source-image.png'));

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'OpenAI API chyba',
      });
    }

    const imageBase64 = data?.data?.[0]?.b64_json;

    if (!imageBase64) {
      return res.status(500).json({ error: 'OpenAI nevrátil obrázek.' });
    }

    const imageBuffer = Buffer.from(imageBase64, 'base64');

    res.setHeader('Content-Type', 'image/png');
    res.send(imageBuffer);
  } catch (err) {
    res.status(500).json({
      error: err.message || 'Neočekávaná chyba serveru.',
    });
  }
});

app.get('/api/company-by-ico/:ico', async (req, res) => {
  try {
    const ico = normalizeIco(req.params.ico);

    if (!ico || ico.length !== 8) {
      return res.status(400).json({ error: 'IČO musí mít 8 číslic.' });
    }

    const response = await fetch(
      `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const data = await response.json().catch(() => null);

    if (response.status === 404) {
      return res.status(404).json({ error: 'Firma s tímto IČO nebyla v ARES nalezena.' });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.message || 'ARES lookup se nepodařilo načíst.',
      });
    }

    const companyProfile = buildCompanyProfile(data, ico);

    if (!companyProfile.name) {
      return res.status(404).json({ error: 'Z ARES se nepodařilo získat název firmy.' });
    }

    companyProfile.recommendedContact = getRecommendedContact(companyProfile);

    return res.json(companyProfile);
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Nepodařilo se dohledat firmu podle IČO.',
    });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server běží na portu ${port}`);
});
