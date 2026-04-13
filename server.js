import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { InferenceClient } from '@huggingface/inference';

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const hfToken = process.env.VITE_HF_API_KEY;

if (!hfToken) {
  console.warn('Missing VITE_HF_API_KEY');
}

const client = new InferenceClient(hfToken);

app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const imageBlob = await client.textToImage({
      model: 'black-forest-labs/FLUX.1-dev',
      inputs: prompt,
    });

    const buffer = Buffer.from(await imageBlob.arrayBuffer());

    res.setHeader('Content-Type', imageBlob.type || 'image/png');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({
      error: err.message || 'Image generation failed',
    });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});