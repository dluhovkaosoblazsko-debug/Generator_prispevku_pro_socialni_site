import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

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
