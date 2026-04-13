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
