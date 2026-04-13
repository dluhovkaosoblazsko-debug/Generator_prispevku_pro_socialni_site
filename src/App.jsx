import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import {
  Sparkles,
  Check,
  RefreshCw,
  Image as ImageIcon,
  MessageCircle,
  Lightbulb,
  Hash,
  Settings2,
  Target,
  Wand2,
  FileText,
  AlertCircle,
  ClipboardPaste,
  RotateCcw,
  ChevronRight,
  Download,
  History,
  Upload,
  X,
} from 'lucide-react';
import logoImageUrl from './assets/logo-chytra-pena.png';
import knowledgeBase from './data/knowledge-base.json';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const primaryModel = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
const fallbackModel = import.meta.env.VITE_GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash';

if (!apiKey) {
  console.warn('Missing VITE_GEMINI_API_KEY');
}

const brandContext = `Jsme Chytrá pěna Bohemia s.r.o., lídr na trhu se stříkanou PUR izolací v ČR.

Klíčové výhody a fakta:
- Úspora až 70 % nákladů na vytápění.
- Návratnost investice 5–8 let.
- Zateplení RD do 200 m² za 1 den.
- Bez tepelných mostů, dokonalé utěsnění konstrukce.
- Německá kvalita, životnost 30+ let.
- Záruka 5 let na práci.
- 9 000+ realizací.
- Pomoc s dotacemi Nová zelená úsporám.`;

const defaultPromptTemplates = [
  'Proč zateplit střechu ještě před další topnou sezonou',
  'Jak PUR izolace snižuje náklady na vytápění staršího domu',
  'Nejčastější chyby při zateplení podkroví',
  'Kdy se vyplatí PUR izolace u novostavby',
  'Co řeší majitelé domů po první zimě bez kvalitní izolace',
];

const audienceOptions = [
  'Majitelé starších rodinných domů',
  'Lidé plánující novostavbu',
  'SVJ a bytová družstva',
  'Firmy (haly a sklady)',
];

const platformOptions = ['Facebook', 'Instagram', 'LinkedIn'];
const toneOptions = [
  'Důraz na úspory a finance',
  'Odborný a důvěryhodný',
  'Lidský a vysvětlující',
  'Prodejní a energický',
];
const lengthOptions = [
  'Krátký (do 100 slov)',
  'Střední (150–200 slov)',
  'Dlouhý edukační',
];
const ctaOptions = [
  'Získat nezávaznou kalkulaci zdarma',
  'Napsat nám zprávu / Zavolat',
  'Přečíst si článek na blogu',
  'Poptat řešení dotací',
];

const companyContact = {
  web: 'www.chytrapena.cz',
  email: 'info@chytrapena.cz',
  phone: '+420 735 700 770',
};

const audienceBriefs = {
  'Majitelé starších rodinných domů': `
- Tito lidé řeší vysoké účty za vytápění, průvan, tepelné ztráty a obavy z drahé nebo špatné rekonstrukce.
- Důležitá témata: úspora, pohodlí, teplo domova, jistota správného rozhodnutí, jednoduchost realizace.
- Piš civilně, srozumitelně a prakticky.
- Používej konkrétní životní situace a běžné problémy.
- Omez technický žargon.
- CTA má působit bezpečně a jednoduše.
`,
  'Lidé plánující novostavbu': `
- Tito lidé chtějí udělat správné rozhodnutí hned na začátku a vyhnout se budoucím chybám.
- Důležitá témata: prevence chyb, kvalita řešení, dlouhodobá funkčnost, bez kompromisů.
- Piš věcně, ale stále srozumitelně.
- Zdůrazni výhodu správného řešení napoprvé.
- CTA má podporovat konzultaci nebo nezávazné ověření řešení.
`,
  'SVJ a bytová družstva': `
- Tito lidé řeší rozpočet, odpovědnost, schvalování a dlouhodobý přínos pro více vlastníků.
- Důležitá témata: provozní náklady, plánování, důvěryhodnost dodavatele, systematičnost.
- Piš profesionálněji, méně emotivně.
- Zdůrazni stabilitu, přehlednost a ekonomický dopad.
- CTA má působit profesionálně a seriózně.
`,
  'Firmy (haly a sklady)': `
- Tito lidé řeší provozní náklady, efektivitu, rychlost realizace a omezení provozních ztrát.
- Důležitá témata: výkon, návratnost, provoz, logistika, termín, efektivita.
- Piš stručně, věcně a obchodně.
- Zdůrazni dopad na provoz a náklady.
- CTA má být jasné, rychlé a orientované na obchodní jednání.
`,
};

const platformBriefs = {
  Facebook: `
- Styl: civilní, praktický, dobře čitelný.
- Vhodné jsou kratší odstavce a silný úvod.
- Text má být přístupný širokému publiku.
`,
  Instagram: `
- Styl: údernější, vizuálnější, emotivnější.
- Používej kratší řádky a svižnější rytmus.
- Text musí fungovat spolu s vizuálem.
`,
  LinkedIn: `
- Styl: profesionálnější, důvěryhodný, expertní.
- Piš věcněji, méně emotivně.
- Zdůrazni kompetenci, přínos a kvalitu řešení.
  `,
};

const companyPhotoModules = import.meta.glob('./assets/Foto/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
});

const companyPhotoLibrary = Object.entries(companyPhotoModules).map(([path, url]) => ({
  id: path,
  name: path.split('/').pop() || 'firemni-fotka',
  url,
}));

const flyerTemplates = [
  { id: 'classic', label: 'Klasický' },
  { id: 'split', label: 'Rozdělený' },
  { id: 'focus', label: 'Benefit' },
];

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Nepodařilo se načíst obrázek: ${src}`));
    image.src = src;
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Nepodařilo se načíst vybranou fotku.'));
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Nepodařilo se převést obrázek.'));
    reader.readAsDataURL(blob);
  });
}

function extractJsonPayload(text) {
  if (!text) return null;

  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fencedMatch ? fencedMatch[1].trim() : text.trim();

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeGeneratedPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const main = String(payload.mainText || payload.main || '').trim();
  const visual = String(payload.visualPrompt || payload.visual || '').trim();
  const hashtagsValue = Array.isArray(payload.hashtags)
    ? payload.hashtags.join(' ')
    : String(payload.hashtags || '').trim();

  return {
    main,
    visual,
    hashtags: hashtagsValue,
  };
}

function serializeGeneratedContent({ main, visual, hashtags }) {
  const sections = [];

  if (main) {
    sections.push(`[HLAVNÍ TEXT]\n${main}`);
  }

  if (visual) {
    sections.push(`[NÁVRH VIZUÁLU]\n${visual}`);
  }

  if (hashtags) {
    sections.push(`[HASHTAGY]\n${hashtags}`);
  }

  return sections.join('\n\n').trim();
}

function looksLikeEnglishVisual(text) {
  const normalized = String(text || '').toLowerCase();
  if (!normalized) return false;

  const englishSignals = [
    'showing ',
    'on one side',
    'cozy',
    'warm',
    'happy residents',
    'focus on',
    'drafty',
    'energy-efficient',
    'split image',
    'home interior',
    'savings',
  ];

  return englishSignals.some((signal) => normalized.includes(signal));
}

function normalizeIco(value) {
  return String(value || '').replace(/\D/g, '').trim();
}

function formatCompanyProfile(company) {
  if (!company?.name) return '';

  return [
    company.name,
    company.legalForm,
    company.industry,
    company.address,
    company.ico ? `IČO ${company.ico}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function formatRecommendedContact(company) {
  const recommended = company?.recommendedContact;
  if (!recommended?.label) return '';
  return recommended.label;
}

function wrapCanvasText(context, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawImageCover(context, image, x, y, width, height, focusX = 0.5, focusY = 0.5) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) return;

  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const scaledWidth = sourceWidth * scale;
  const scaledHeight = sourceHeight * scale;
  const overflowX = Math.max(0, scaledWidth - width);
  const overflowY = Math.max(0, scaledHeight - height);
  const drawX = x - overflowX * focusX;
  const drawY = y - overflowY * focusY;

  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, drawX, drawY, scaledWidth, scaledHeight);
  context.restore();
}

function drawWrappedCanvasText(context, text, x, y, maxWidth, lineHeight) {
  const paragraphs = String(text || '')
    .split('\n')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  let currentY = y;

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const lines = wrapCanvasText(context, paragraph, maxWidth);
    lines.forEach((line) => {
      context.fillText(line, x, currentY);
      currentY += lineHeight;
    });

    if (paragraphIndex < paragraphs.length - 1) {
      currentY += Math.round(lineHeight * 0.45);
    }
  });

  return currentY;
}

function evaluateGeneratedContent({ main, visual, hashtags }, options) {
  const issues = [];
  const normalizedMain = (main || '').trim();
  const hashtagList = (hashtags || '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const paragraphs = normalizedMain
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const words = normalizedMain ? normalizedMain.split(/\s+/).length : 0;
  const hookCandidates = paragraphs[0] || normalizedMain;
  const ctaNormalized = (options.cta || '').toLowerCase();

  if (!normalizedMain) {
    issues.push('Hlavní text chybí.');
  }

  if (normalizedMain && hookCandidates.length < 45) {
    issues.push('Úvod je velmi krátký a nemusí dostatečně zaujmout.');
  }

  if (
    normalizedMain &&
    ctaNormalized &&
    !normalizedMain.toLowerCase().includes(ctaNormalized.slice(0, Math.max(10, ctaNormalized.length - 8)))
  ) {
    issues.push('Text nepůsobí, že opravdu končí zvolenou výzvou k akci.');
  }

  if (options.includeVisual && !visual.trim()) {
    issues.push('Chybí návrh vizuálu.');
  }

  if (options.includeHashtags && hashtagList.length !== 5) {
    issues.push('Hashtagů není přesně 5.');
  }

  if (options.strictClaims && /\b(100 %|garantovan|nejlepší|bezkonkurenční)\b/i.test(normalizedMain)) {
    issues.push('Text obsahuje silné marketingové tvrzení, které může být potřeba ověřit.');
  }

  if (options.postLength.startsWith('Krátký') && words > 110) {
    issues.push('Krátká varianta je příliš dlouhá.');
  }

  if (options.postLength.startsWith('Střední') && (words < 100 || words > 210)) {
    issues.push('Střední varianta je mimo doporučený rozsah.');
  }

  if (options.postLength.startsWith('Dlouhý') && words < 170) {
    issues.push('Dlouhá varianta je zatím spíš stručná.');
  }

  return {
    score: Math.max(0, 100 - issues.length * 12),
    issues,
  };
}

function parseGeneratedContent(text) {
  if (!text) {
    return { main: '', visual: '', hashtags: '' };
  }

  const mainMatch = text.match(/\[HLAVNÍ TEXT\]\s*:?[\s\S]*?(?=\[NÁVRH VIZUÁLU\]|\[HASHTAGY\]|$)/i);
  const visualMatch = text.match(/\[NÁVRH VIZUÁLU\]\s*:?[\s\S]*?(?=\[HASHTAGY\]|$)/i);
  const hashtagsMatch = text.match(/\[HASHTAGY\]\s*:?[\s\S]*$/i);

  let main = text.trim();
  let visual = '';
  let hashtags = '';

  if (mainMatch) {
    main = mainMatch[0].replace(/\[HLAVNÍ TEXT\]\s*:?/i, '').trim();
  }

  if (visualMatch) {
    visual = visualMatch[0].replace(/\[NÁVRH VIZUÁLU\]\s*:?/i, '').trim();
  }

  if (hashtagsMatch) {
    hashtags = hashtagsMatch[0].replace(/\[HASHTAGY\]\s*:?/i, '').trim();
  }

  return { main, visual, hashtags };
}

function getLengthRule(postLength) {
  if (postLength.startsWith('Krátký')) {
    return '60 až 90 slov, maximálně 3 krátké odstavce.';
  }
  if (postLength.startsWith('Střední')) {
    return '120 až 180 slov, 3 až 5 kratších odstavců.';
  }
  return '180 až 260 slov, edukativní, ale stále čtivý text.';
}

function getRelevantKnowledgeEntries(contentPrompt, targetAudience) {
  const normalizedPrompt = (contentPrompt || '').toLowerCase();

  return knowledgeBase.filter((entry) => {
    const audienceMatch = !entry.audiences?.length || entry.audiences.includes(targetAudience);
    const keywordMatch =
      !normalizedPrompt ||
      entry.keywords.some((keyword) => normalizedPrompt.includes(keyword.toLowerCase()));

    return audienceMatch && keywordMatch;
  });
}

function buildKnowledgeContext(entries) {
  if (!entries.length) {
    return '- Nebyl vybrán žádný doplňkový znalostní blok.';
  }

  return entries
    .map(
      (entry) =>
        `${entry.title}:\n${entry.facts.map((fact) => `- ${fact}`).join('\n')}`
    )
    .join('\n\n');
}

function collectKnowledgeHints(entries, key) {
  const uniqueHints = new Set();

  entries.forEach((entry) => {
    (entry[key] || []).forEach((hint) => {
      if (hint) {
        uniqueHints.add(hint);
      }
    });
  });

  return Array.from(uniqueHints);
}

function buildHintSection(entries, key, fallbackText) {
  const hints = collectKnowledgeHints(entries, key);
  if (!hints.length) {
    return fallbackText;
  }

  return hints.map((hint) => `- ${hint}`).join('\n');
}

export default function App() {
  const historyStorageKey = 'klara-post-history';
  const promptTemplatesStorageKey = 'klara-prompt-templates';
  const sourceImageStorageKey = 'klara-source-image';
  const logoPositionStorageKey = 'klara-logo-position';
  const draftStorageKey = 'klara-current-draft';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [useBrandContext, setUseBrandContext] = useState(true);
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [includeVisual, setIncludeVisual] = useState(true);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [strictClaims, setStrictClaims] = useState(true);

  const [contentPrompt, setContentPrompt] = useState('');
  const [companyIco, setCompanyIco] = useState('');
  const [companyProfile, setCompanyProfile] = useState(null);
  const [platform, setPlatform] = useState('Facebook');
  const [tone, setTone] = useState('Důraz na úspory a finance');
  const [targetAudience, setTargetAudience] = useState('Majitelé starších rodinných domů');
  const [postLength, setPostLength] = useState('Střední (150–200 slov)');
  const [cta, setCta] = useState('Získat nezávaznou kalkulaci zdarma');
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedImage, setGeneratedImage] = useState('');
  const [flyerTitle, setFlyerTitle] = useState('');
  const [flyerText, setFlyerText] = useState('');
  const [flyerImage, setFlyerImage] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  const [flyerLoading, setFlyerLoading] = useState(false);
  const [flyerTextLoading, setFlyerTextLoading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [imageMode, setImageMode] = useState('edit');
  const [logoPosition, setLogoPosition] = useState('bottom-right');
  const [flyerTemplate, setFlyerTemplate] = useState('classic');
  const [sourceImageDataUrl, setSourceImageDataUrl] = useState('');
  const [sourceImageName, setSourceImageName] = useState('');
  const [selectedCompanyPhotoId, setSelectedCompanyPhotoId] = useState('');
  const [historyItems, setHistoryItems] = useState([]);
  const [promptTemplates, setPromptTemplates] = useState(defaultPromptTemplates);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [companyGalleryOpen, setCompanyGalleryOpen] = useState(false);
  const [companyLookupLoading, setCompanyLookupLoading] = useState(false);
  const fileInputRef = useRef(null);
  const mainTextAreaRef = useRef(null);

  const parsed = useMemo(() => parseGeneratedContent(generatedContent), [generatedContent]);

  useEffect(() => {
    if (!mainTextAreaRef.current) return;

    mainTextAreaRef.current.style.height = '0px';
    mainTextAreaRef.current.style.height = `${mainTextAreaRef.current.scrollHeight}px`;
  }, [parsed.main]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(promptTemplatesStorageKey);
      if (!raw) return;
      const parsedTemplates = JSON.parse(raw);
      if (Array.isArray(parsedTemplates) && parsedTemplates.length > 0) {
        setPromptTemplates(parsedTemplates.filter((item) => typeof item === 'string' && item.trim()).slice(0, 12));
      }
    } catch {
      // Ignore invalid local templates.
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) return;
      const draft = JSON.parse(raw);

      setContentPrompt(draft.contentPrompt || '');
      setCompanyIco(draft.companyIco || '');
      setCompanyProfile(draft.companyProfile || null);
      setPlatform(draft.platform || 'Facebook');
      setTone(draft.tone || 'Důraz na úspory a finance');
      setTargetAudience(draft.targetAudience || 'Majitelé starších rodinných domů');
      setPostLength(draft.postLength || 'Střední (150–200 slov)');
      setCta(draft.cta || 'Získat nezávaznou kalkulaci zdarma');
      setUseBrandContext(draft.useBrandContext ?? true);
      setUseKnowledgeBase(draft.useKnowledgeBase ?? true);
      setIncludeEmojis(draft.includeEmojis ?? true);
      setIncludeVisual(draft.includeVisual ?? true);
      setIncludeHashtags(draft.includeHashtags ?? true);
      setStrictClaims(draft.strictClaims ?? true);
      setGeneratedContent(draft.generatedContent || '');
      setGeneratedImage(draft.generatedImage || '');
      setFlyerTitle(draft.flyerTitle || '');
      setFlyerText(draft.flyerText || '');
      setFlyerImage(draft.flyerImage || '');
      setImageMode(draft.imageMode || 'edit');
      setLogoPosition(draft.logoPosition || 'bottom-right');
      setFlyerTemplate(draft.flyerTemplate || 'classic');
      setSourceImageDataUrl(draft.sourceImageDataUrl || '');
      setSourceImageName(draft.sourceImageName || '');
      setSelectedCompanyPhotoId(draft.selectedCompanyPhotoId || '');
    } catch {
      // Ignore invalid local draft.
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(sourceImageStorageKey);
      if (!raw) return;
      const parsedSourceImage = JSON.parse(raw);
      if (parsedSourceImage?.dataUrl) {
        setSourceImageDataUrl(parsedSourceImage.dataUrl);
        setSourceImageName(parsedSourceImage.name || 'firemni-fotka');
      }
    } catch {
      // Ignore invalid local image data.
    }
  }, []);

  useEffect(() => {
    try {
      const savedLogoPosition = localStorage.getItem(logoPositionStorageKey);
      if (savedLogoPosition) {
        setLogoPosition(savedLogoPosition);
      }
    } catch {
      // Ignore invalid local logo position.
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(historyStorageKey);
      if (!raw) return;
      const parsedHistory = JSON.parse(raw);
      if (Array.isArray(parsedHistory)) {
        setHistoryItems(parsedHistory);
      }
    } catch {
      // Ignore invalid local history.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(historyItems.slice(0, 12)));
    } catch {
      // Ignore localStorage write issues.
    }
  }, [historyItems]);

  useEffect(() => {
    try {
      localStorage.setItem(promptTemplatesStorageKey, JSON.stringify(promptTemplates.slice(0, 12)));
    } catch {
      // Ignore localStorage write issues.
    }
  }, [promptTemplates]);

  useEffect(() => {
    try {
      if (sourceImageDataUrl) {
        localStorage.setItem(
          sourceImageStorageKey,
          JSON.stringify({ dataUrl: sourceImageDataUrl, name: sourceImageName })
        );
      } else {
        localStorage.removeItem(sourceImageStorageKey);
      }
    } catch {
      // Ignore localStorage write issues.
    }
  }, [sourceImageDataUrl, sourceImageName]);

  useEffect(() => {
    try {
      localStorage.setItem(logoPositionStorageKey, logoPosition);
    } catch {
      // Ignore localStorage write issues.
    }
  }, [logoPosition]);

  useEffect(() => {
    try {
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          contentPrompt,
          companyIco,
          companyProfile,
          platform,
          tone,
          targetAudience,
          postLength,
          cta,
          useBrandContext,
          useKnowledgeBase,
          includeEmojis,
          includeVisual,
          includeHashtags,
          strictClaims,
          generatedContent,
          generatedImage,
          flyerTitle,
          flyerText,
          flyerImage,
          imageMode,
          logoPosition,
          flyerTemplate,
          sourceImageDataUrl,
          sourceImageName,
          selectedCompanyPhotoId,
        })
      );
    } catch {
      // Ignore localStorage write issues.
    }
  }, [
    contentPrompt,
    companyIco,
    companyProfile,
    platform,
    tone,
    targetAudience,
    postLength,
    cta,
    useBrandContext,
    useKnowledgeBase,
    includeEmojis,
    includeVisual,
    includeHashtags,
    strictClaims,
    generatedContent,
    generatedImage,
    flyerTitle,
    flyerText,
    flyerImage,
    imageMode,
    logoPosition,
    flyerTemplate,
    sourceImageDataUrl,
    sourceImageName,
    selectedCompanyPhotoId,
  ]);

  const estimatedWords = useMemo(() => {
    if (!contentPrompt.trim()) return 0;
    return contentPrompt.trim().split(/\s+/).length;
  }, [contentPrompt]);

  const normalizedCompanyIco = useMemo(() => normalizeIco(companyIco), [companyIco]);
  const companyModeActive = Boolean(companyProfile?.name && normalizedCompanyIco.length === 8);

  const selectedKnowledgeEntries = useMemo(
    () => (useKnowledgeBase ? getRelevantKnowledgeEntries(contentPrompt, targetAudience) : []),
    [contentPrompt, targetAudience, useKnowledgeBase]
  );
  const selectedToneHints = useMemo(
    () =>
      buildHintSection(
        selectedKnowledgeEntries,
        'toneHints',
        '- Nemáš žádné doplňkové pokyny ke stylu z databáze.'
      ),
    [selectedKnowledgeEntries]
  );
  const selectedCtaHints = useMemo(
    () =>
      buildHintSection(
        selectedKnowledgeEntries,
        'ctaHints',
        '- Nemáš žádné doplňkové pokyny k CTA z databáze.'
      ),
    [selectedKnowledgeEntries]
  );
  const selectedVisualHints = useMemo(
    () =>
      buildHintSection(
        selectedKnowledgeEntries,
        'visualHints',
        '- Nemáš žádné doplňkové pokyny k vizuálu z databáze.'
      ),
    [selectedKnowledgeEntries]
  );

  const isDisabled = loading || !contentPrompt.trim();
  const fullContentWithContact = useMemo(() => {
    if (!generatedContent.trim()) return '';

    return `${generatedContent}

[KONTAKT]
Web: ${companyContact.web}
E-mail: ${companyContact.email}
Telefon: ${companyContact.phone}`.trim();
  }, [generatedContent]);

  const copyToClipboard = async (text) => {
    if (!text) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Nepodařilo se zkopírovat text do schránky.');
    }
  };

  const handleCompanyIcoChange = (value) => {
    setCompanyIco(normalizeIco(value).slice(0, 8));
    setCompanyProfile(null);
  };

  const lookupCompanyByIco = async (icoValue = companyIco) => {
    const normalizedIco = normalizeIco(icoValue);

    if (!normalizedIco) {
      setCompanyProfile(null);
      return null;
    }

    if (normalizedIco.length !== 8) {
      setError('IČO musí mít 8 číslic.');
      setCompanyProfile(null);
      return null;
    }

    setCompanyLookupLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/company-by-ico/${normalizedIco}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Nepodařilo se dohledat firmu podle IČO.');
      }

      setCompanyProfile(data);
      return data;
    } catch (err) {
      setCompanyProfile(null);
      setError(err.message || 'Nepodařilo se dohledat firmu podle IČO.');
      return null;
    } finally {
      setCompanyLookupLoading(false);
    }
  };

  const handleExportDocx = async () => {
    if (!generatedContent.trim()) return;

    const mainParagraphs = parsed.main.split('\n').map((line) => {
      return new Paragraph({
        children: [new TextRun(line)],
        spacing: { after: 120 },
      });
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: "Chytrá pěna - Návrh příspěvku",
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 300 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Téma: ", bold: true }),
                new TextRun(contentPrompt),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Platforma: ", bold: true }),
                new TextRun(platform),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Cílová skupina: ", bold: true }),
                new TextRun(targetAudience),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Datum exportu: ", bold: true }),
                new TextRun(new Date().toLocaleString('cs-CZ')),
              ],
              spacing: { after: 400 },
            }),
            
            new Paragraph({
              text: "Hlavní text příspěvku",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 150 },
            }),
            ...mainParagraphs,

            new Paragraph({
              text: "Návrh vizuálu",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 150 },
            }),
            new Paragraph({
              children: [new TextRun(parsed.visual || "Žádný vizuál navržen.")],
              spacing: { after: 120 },
            }),

            new Paragraph({
              text: "Hashtagy",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 150 },
            }),
            new Paragraph({
              children: [new TextRun(parsed.hashtags || "Bez hashtagů.")],
              spacing: { after: 120 },
            }),

            new Paragraph({
              text: "Kontakt",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 150 },
            }),
            new Paragraph({ children: [new TextRun(`Web: ${companyContact.web}`)] }),
            new Paragraph({ children: [new TextRun(`E-mail: ${companyContact.email}`)] }),
            new Paragraph({ children: [new TextRun(`Telefon: ${companyContact.phone}`)] }),
          ],
        },
      ],
    });

    try {
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `chytra-pena-prispevek-${new Date().toISOString().slice(0, 10)}.docx`);
    } catch (err) {
      setError(`Chyba při generování Word dokumentu: ${err.message}`);
    }
  };

  const applyLogoOverlay = async (blob) => {
    const baseImageUrl = URL.createObjectURL(blob);

    try {
      const [baseImage, officialLogo] = await Promise.all([
        loadImage(baseImageUrl),
        loadImage(logoImageUrl),
      ]);

      const canvas = document.createElement('canvas');
      canvas.width = baseImage.naturalWidth;
      canvas.height = baseImage.naturalHeight;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas není k dispozici.');
      }

      context.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

      const outerPadding = Math.max(24, Math.round(canvas.width * 0.028));
      const badgeWidth = Math.max(340, Math.round(canvas.width * 0.34));
      const badgeHeight = Math.max(98, Math.round(canvas.height * 0.12));
      const positionMap = {
        'top-left': { x: outerPadding, y: outerPadding },
        'top-right': { x: canvas.width - badgeWidth - outerPadding, y: outerPadding },
        'bottom-left': { x: outerPadding, y: canvas.height - badgeHeight - outerPadding },
        'bottom-right': {
          x: canvas.width - badgeWidth - outerPadding,
          y: canvas.height - badgeHeight - outerPadding,
        },
      };
      const resolvedPosition = positionMap[logoPosition] || positionMap['bottom-right'];
      const badgeX = resolvedPosition.x;
      const badgeY = resolvedPosition.y;
      const badgeRadius = Math.round(badgeHeight * 0.26);
      const innerPaddingX = Math.round(badgeWidth * 0.06);
      const innerPaddingY = Math.round(badgeHeight * 0.14);
      const logoMaxWidth = badgeWidth - innerPaddingX * 2;
      const logoMaxHeight = badgeHeight - innerPaddingY * 2;
      const logoScale = Math.min(
        logoMaxWidth / officialLogo.naturalWidth,
        logoMaxHeight / officialLogo.naturalHeight
      );
      const logoWidth = officialLogo.naturalWidth * logoScale;
      const logoHeight = officialLogo.naturalHeight * logoScale;
      const logoX = badgeX + (badgeWidth - logoWidth) / 2;
      const logoY = badgeY + (badgeHeight - logoHeight) / 2;

      context.save();
      context.fillStyle = 'rgba(255, 255, 255, 0.96)';
      context.shadowColor = 'rgba(15, 23, 42, 0.28)';
      context.shadowBlur = 22;
      context.shadowOffsetY = 10;
      context.beginPath();
      context.moveTo(badgeX + badgeRadius, badgeY);
      context.lineTo(badgeX + badgeWidth - badgeRadius, badgeY);
      context.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + badgeRadius);
      context.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - badgeRadius);
      context.quadraticCurveTo(
        badgeX + badgeWidth,
        badgeY + badgeHeight,
        badgeX + badgeWidth - badgeRadius,
        badgeY + badgeHeight
      );
      context.lineTo(badgeX + badgeRadius, badgeY + badgeHeight);
      context.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - badgeRadius);
      context.lineTo(badgeX, badgeY + badgeRadius);
      context.quadraticCurveTo(badgeX, badgeY, badgeX + badgeRadius, badgeY);
      context.closePath();
      context.fill();
      context.restore();

      context.drawImage(officialLogo, logoX, logoY, logoWidth, logoHeight);

      const brandedBlob = await new Promise((resolve, reject) => {
        canvas.toBlob((value) => {
          if (value) {
            resolve(value);
          } else {
            reject(new Error('Nepodařilo se vytvořit výsledný obrázek.'));
          }
        }, 'image/png');
      });

      return await blobToDataUrl(brandedBlob);
    } finally {
      URL.revokeObjectURL(baseImageUrl);
    }
  };

  const generateWithGemini = async (prompt, systemPrompt, options = {}) => {
    if (!apiKey) {
      setError('Chybí API klíč. Zkontrolujte VITE_GEMINI_API_KEY v .env a restartujte dev server.');
      return null;
    }

    setLoading(true);
    setError('');

    const modelsToTry = [primaryModel, fallbackModel];
    let lastError = 'Neznámá chyba';

    for (const currentModel of modelsToTry) {
      let delay = 900;

      for (let i = 0; i < 3; i += 1) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{ text: systemPrompt }],
                },
                contents: [
                  {
                    parts: [{ text: prompt }],
                  },
                ],
                generationConfig: {
                  temperature: options.temperature ?? 0.5,
                  topP: 0.9,
                  ...(options.expectJson ? { responseMimeType: 'application/json' } : {}),
                },
              }),
            }
          );

          const data = await response.json();

          if (!response.ok) {
            const apiMessage = data?.error?.message || `HTTP ${response.status}`;

            if (response.status === 503) {
              throw new Error(`Model ${currentModel} je momentálně přetížený.`);
            }

            if (response.status === 429) {
              throw new Error(`Model ${currentModel} narazil na limit požadavků.`);
            }

            throw new Error(apiMessage);
          }

          const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!resultText) {
            throw new Error(`Model ${currentModel} vrátil prázdnou odpověď.`);
          }

          setLoading(false);
          return resultText;
        } catch (err) {
          lastError = err.message;

          const isLastAttemptForThisModel = i === 2;
          if (!isLastAttemptForThisModel) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
          }
        }
      }
    }

    setLoading(false);
    setError(`API chyba: ${lastError}`);
    return null;
  };

  const translateVisualPromptToCzech = async (visualPrompt) => {
    if (!visualPrompt.trim()) return '';

    const systemPrompt = `Jsi jazykový editor. Tvůj jediný úkol je převést zadaný návrh vizuálu do přirozené a stručné češtiny.

Pravidla:
- Zachovej význam, scénu i kompozici.
- Nevymýšlej nové prvky.
- Vrať pouze samotný český text bez uvozovek, bez markdownu a bez vysvětlení.
- Výsledek musí být vhodný jako zadání pro generátor obrázku.`;

    const prompt = `Převeď do češtiny tento návrh vizuálu:

${visualPrompt}`;

    const translated = await generateWithGemini(prompt, systemPrompt, {
      temperature: 0.2,
    });

    return translated?.trim() || visualPrompt;
  };

  const handleSuggestFlyerText = async () => {
    if (!parsed.main.trim()) return;

    setFlyerTextLoading(true);
    setError('');

    try {
      const systemPrompt = `Jsi seniorní copywriter pro firmu Chytrá pěna.

Tvým úkolem je vytvořit krátký text na leták v češtině.

Vrať pouze čistý JSON bez markdownu a bez vysvětlení v tomto tvaru:
{
  "title": "krátký silný nadpis",
  "body": "stručný text letáku"
}

Pravidla:
- Vycházej pouze z dodaného hlavního textu a firemních kontaktů.
- Nadpis má být krátký a úderný.
- Tělo textu má být vhodné na jednostránkový leták.
- Použij 3 až 5 krátkých benefitových vět nebo krátkých odstavců.
- Zakonči krátkou výzvou k akci.
- Nepiš hashtagy.
- Výstup musí být celý česky.`;

      const prompt = `Vytvoř text letáku z tohoto podkladu:

Hlavní text:
${parsed.main}

CTA:
${cta}

Kontakty firmy:
Web: ${companyContact.web}
E-mail: ${companyContact.email}
Telefon: ${companyContact.phone}`;

      const result = await generateWithGemini(prompt, systemPrompt, {
        temperature: 0.4,
        expectJson: true,
      });

      if (result) {
        const payload = extractJsonPayload(result);
        if (payload?.title || payload?.body) {
          setFlyerTitle(String(payload.title || '').trim());
          setFlyerText(String(payload.body || '').trim());
        } else {
          setFlyerText(result.trim());
        }
      }
    } finally {
      setFlyerTextLoading(false);
    }
  };

  const handleGenerateFlyer = async () => {
    if (!generatedImage) {
      setError('Nejdřív je potřeba mít vygenerovaný obrázek.');
      return;
    }

    const flyerHeading = flyerTitle.trim() || contentPrompt.trim() || 'Chytrá pěna';
    const flyerCopy = flyerText.trim() || parsed.main.trim();
    if (!flyerCopy) {
      setError('Nejdřív je potřeba mít text pro leták.');
      return;
    }

    setFlyerLoading(true);
    setError('');

    try {
      const [heroImage, logoImage] = await Promise.all([
        loadImage(generatedImage),
        loadImage(logoImageUrl),
      ]);

      const canvas = document.createElement('canvas');
      canvas.width = 1240;
      canvas.height = 1754;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas není k dispozici.');
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.fillStyle = '#f7f6f1';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const logoWidth = 280;
      const logoHeight = (logoImage.naturalHeight / logoImage.naturalWidth) * logoWidth;

      if (flyerTemplate === 'classic') {
        context.fillStyle = '#79aa0a';
        context.fillRect(0, 0, canvas.width, 136);
        context.drawImage(logoImage, 70, 28, logoWidth, logoHeight);

        context.fillStyle = '#ffffff';
        context.font = '700 46px "Segoe UI", Arial, sans-serif';
        context.textAlign = 'right';
        context.fillText('Firemní leták', canvas.width - 70, 62);
        context.font = '500 24px "Segoe UI", Arial, sans-serif';
        context.fillText('Chytrá pěna Bohemia s.r.o.', canvas.width - 70, 100);

        const heroY = 184;
        const heroHeight = 670;
        drawImageCover(context, heroImage, 70, heroY, canvas.width - 140, heroHeight, 0.5, 0.42);
        context.strokeStyle = '#cad3bb';
        context.lineWidth = 3;
        context.strokeRect(70, heroY, canvas.width - 140, heroHeight);

        const textCardY = heroY + heroHeight - 60;
        context.fillStyle = '#ffffff';
        context.shadowColor = 'rgba(15, 23, 42, 0.12)';
        context.shadowBlur = 24;
        context.shadowOffsetY = 10;
        context.fillRect(90, textCardY, canvas.width - 180, 610);
        context.shadowColor = 'transparent';
        context.strokeStyle = '#d5dcc8';
        context.lineWidth = 2;
        context.strokeRect(90, textCardY, canvas.width - 180, 610);

        const textX = 140;
        const textWidth = canvas.width - 280;
        let currentY = textCardY + 78;

        context.fillStyle = '#14213d';
        context.textAlign = 'left';
        context.font = '700 38px "Segoe UI", Arial, sans-serif';
        currentY = drawWrappedCanvasText(context, flyerHeading, textX, currentY, textWidth, 48);

        currentY += 28;
        context.font = '500 28px "Segoe UI", Arial, sans-serif';
        context.fillStyle = '#334155';
        currentY = drawWrappedCanvasText(context, flyerCopy, textX, currentY, textWidth, 40);

        currentY += 36;
        context.fillStyle = '#79aa0a';
        context.fillRect(textX, currentY, textWidth, 2);
        currentY += 42;

        context.fillStyle = '#0f172a';
        context.font = '700 26px "Segoe UI", Arial, sans-serif';
        context.fillText('Kontaktujte nás', textX, currentY);
        currentY += 46;

        context.fillStyle = '#334155';
        context.font = '600 24px "Segoe UI", Arial, sans-serif';
        context.fillText(`Web: ${companyContact.web}`, textX, currentY);
        currentY += 38;
        context.fillText(`E-mail: ${companyContact.email}`, textX, currentY);
        currentY += 38;
        context.fillText(`Telefon: ${companyContact.phone}`, textX, currentY);
      } else if (flyerTemplate === 'split') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#79aa0a';
        context.fillRect(0, 0, canvas.width, 118);
        drawImageCover(context, heroImage, 0, 118, 620, canvas.height - 118, 0.45, 0.5);
        context.drawImage(logoImage, 70, 26, logoWidth, logoHeight);

        context.fillStyle = '#f8fafc';
        context.fillRect(620, 118, 620, canvas.height - 118);

        let currentY = 210;
        const textX = 680;
        const textWidth = 480;
        context.fillStyle = '#14213d';
        context.font = '700 46px "Segoe UI", Arial, sans-serif';
        currentY = drawWrappedCanvasText(context, flyerHeading, textX, currentY, textWidth, 56);
        currentY += 20;
        context.fillStyle = '#334155';
        context.font = '500 26px "Segoe UI", Arial, sans-serif';
        currentY = drawWrappedCanvasText(context, flyerCopy, textX, currentY, textWidth, 38);
        currentY += 40;
        context.fillStyle = '#79aa0a';
        context.fillRect(textX, currentY, 180, 6);
        currentY += 54;
        context.fillStyle = '#0f172a';
        context.font = '700 24px "Segoe UI", Arial, sans-serif';
        context.fillText(companyContact.web, textX, currentY);
        currentY += 38;
        context.font = '600 22px "Segoe UI", Arial, sans-serif';
        context.fillStyle = '#475569';
        context.fillText(companyContact.email, textX, currentY);
        currentY += 34;
        context.fillText(companyContact.phone, textX, currentY);
      } else {
        context.fillStyle = '#eef4df';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#79aa0a';
        context.fillRect(70, 70, canvas.width - 140, 180);
        context.drawImage(logoImage, 110, 98, logoWidth, logoHeight);
        context.fillStyle = '#ffffff';
        context.textAlign = 'right';
        context.font = '700 48px "Segoe UI", Arial, sans-serif';
        context.fillText('Leták', canvas.width - 110, 145);
        context.font = '500 24px "Segoe UI", Arial, sans-serif';
        context.fillText('Chytrá pěna Bohemia s.r.o.', canvas.width - 110, 188);

        drawImageCover(context, heroImage, 70, 300, canvas.width - 140, 520, 0.5, 0.4);
        context.strokeStyle = '#c8d5b2';
        context.lineWidth = 3;
        context.strokeRect(70, 300, canvas.width - 140, 520);

        let currentY = 910;
        const textX = 100;
        const textWidth = canvas.width - 200;
        context.textAlign = 'left';
        context.fillStyle = '#14213d';
        context.font = '700 42px "Segoe UI", Arial, sans-serif';
        currentY = drawWrappedCanvasText(context, flyerHeading, textX, currentY, textWidth, 52);
        currentY += 24;
        context.fillStyle = '#334155';
        context.font = '500 27px "Segoe UI", Arial, sans-serif';
        currentY = drawWrappedCanvasText(context, flyerCopy, textX, currentY, textWidth, 39);
        currentY += 36;

        context.fillStyle = '#ffffff';
        context.fillRect(70, 1460, canvas.width - 140, 170);
        context.strokeStyle = '#d5dcc8';
        context.lineWidth = 2;
        context.strokeRect(70, 1460, canvas.width - 140, 170);

        context.fillStyle = '#0f172a';
        context.font = '700 24px "Segoe UI", Arial, sans-serif';
        context.fillText(`Web: ${companyContact.web}`, 110, 1530);
        context.fillText(`E-mail: ${companyContact.email}`, 110, 1572);
        context.fillText(`Telefon: ${companyContact.phone}`, 110, 1614);
      }

      const flyerDataUrl = canvas.toDataURL('image/png');
      setFlyerImage(flyerDataUrl);
    } catch (err) {
      setError(`Nepodařilo se vytvořit leták: ${err.message}`);
    } finally {
      setFlyerLoading(false);
    }
  };

  const handleDownloadFlyer = () => {
    if (!flyerImage) return;

    const link = document.createElement('a');
    link.href = flyerImage;
    link.download = `chytra-pena-letak-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
  };

  const handleGenerateImage = async () => {
    const visualPrompt = parsed.visual || contentPrompt;

    if (!visualPrompt.trim()) {
      setImageError('Nejdřív je potřeba mít návrh vizuálu nebo aspoň vyplněné téma příspěvku.');
      return;
    }

    if (imageMode === 'edit' && !sourceImageDataUrl) {
      setImageError('Pro režim reálné fotky nejdřív nahrajte firemní fotografii.');
      return;
    }

    setImageLoading(true);
    setImageError('');

    try {
      const endpoint = imageMode === 'edit' ? '/api/edit-image' : '/api/generate-image';
      const requestBody =
        imageMode === 'edit'
          ? {
              imageDataUrl: sourceImageDataUrl,
              fileName: sourceImageName || 'firemni-fotka.png',
              prompt: `Uprav přiloženou reálnou fotografii pro marketingový příspěvek firmy Chytrá pěna. Zachovej hlavní scénu, konstrukci, proporce i věrohodnost. Vylepši světlo, čistotu kompozice, barevnost a celkový profesionální dojem pro sociální sítě. Bez jakéhokoli textu v obrázku, bez nápisů, bez titulků, bez typografie, bez loga, bez watermarku, bez písmen a bez čísel. ${visualPrompt}`,
            }
          : {
              prompt: `Realistický marketingový vizuál pro firmu Chytrá pěna. Profesionální fotografie vhodná pro sociální sítě. Bez jakéhokoli textu v obrázku, bez nápisů, bez titulků, bez typografie, bez loga, bez watermarku, bez písmen a bez čísel. ${visualPrompt}`,
            };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.includes('application/json')
          ? await response.json()
          : await response.text();
        const message =
          typeof payload === 'string'
            ? payload
            : payload?.error || payload?.message;

        if (response.status === 401) {
          throw new Error('OpenAI API klíč je neplatný nebo chybí. Zkontrolujte OPENAI_API_KEY v .env a restartujte dev server.');
        }

        if (response.status === 429) {
          throw new Error('Byl překročen limit OpenAI API nebo došel kredit. Zkontrolujte billing a limity u OpenAI.');
        }

        if (response.status === 400) {
          throw new Error(message || 'OpenAI odmítlo požadavek. Zkuste upravit prompt nebo nastavení obrázku.');
        }

        throw new Error(message || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const imageUrl = await applyLogoOverlay(blob);

      setGeneratedImage(imageUrl);
    } catch (err) {
      setImageError(`Obrázek se nepodařilo vytvořit: ${err.message}`);
    } finally {
      setImageLoading(false);
    }
  };

  const handleRestoreHistoryItem = (item) => {
    setContentPrompt(item.contentPrompt || '');
    setCompanyIco(item.companyIco || '');
    setCompanyProfile(item.companyProfile || null);
    setPlatform(item.platform || 'Facebook');
    setTone(item.tone || 'Důraz na úspory a finance');
    setTargetAudience(item.targetAudience || 'Majitelé starších rodinných domů');
    setPostLength(item.postLength || 'Střední (150–200 slov)');
    setCta(item.cta || 'Získat nezávaznou kalkulaci zdarma');
    setGeneratedContent(item.generatedContent || '');
    setGeneratedImage('');
    setFlyerTitle('');
    setFlyerText('');
    setFlyerImage('');
    setImageError('');
  };

  const handleGenerateContent = async () => {
    if (!contentPrompt.trim()) return;

    let resolvedCompanyProfile = companyProfile;
    if (normalizedCompanyIco) {
      resolvedCompanyProfile = await lookupCompanyByIco(normalizedCompanyIco);
      if (!resolvedCompanyProfile) {
        return;
      }
    }

    const companyPromptBlock = resolvedCompanyProfile?.name
      ? `Přímé cílení na konkrétní firmu:
- IČO: ${resolvedCompanyProfile.ico}
- Název firmy: ${resolvedCompanyProfile.name}
- Právní forma: ${resolvedCompanyProfile.legalForm || 'neuvedeno'}
- Obor / NACE: ${resolvedCompanyProfile.industry || 'neuvedeno'}
- Sídlo: ${resolvedCompanyProfile.address || 'neuvedeno'}

Speciální režim psaní:
- Nejde o obecný post pro široké publikum.
- Piš text tak, jako by firma Chytrá pěna oslovovala přímo tuto konkrétní firmu s nabídkou služeb.
- Zaměř se na potřeby firmy, provoz, úspory, komfort nebo efektivitu podle tématu a podle typu společnosti.
- Text má působit jako personalizovaná nabídka nebo obchodní oslovení, ne jako obecná reklama.
- Přirozeně můžeš použít formulace typu "pro vaši firmu", "ve vašem provozu", "vaše hala", "váš objekt", pokud to dává smysl.
- Nevymýšlej si konkrétní interní problémy firmy, pouze rozumně odvozuj možné potřeby z názvu nebo oboru, pokud jsou zřejmé.`
      : `Přímé cílení na konkrétní firmu:
- ne`;

    const systemPrompt = `Jsi seniorní copywriter pro firmu Chytrá pěna.

Tvoje role:
Píšeš česky kvalitní marketingové příspěvky pro sociální sítě o zateplení, úsporách energií a PUR izolaci.

Kontext značky:
${useBrandContext ? brandContext : '- Používej pouze informace ze zadání.'}

Znalostní databáze:
${buildKnowledgeContext(selectedKnowledgeEntries)}

Parametry:
- Platforma: ${platform}
- Tón: ${tone}
- Cílová skupina: ${targetAudience}
- Délka: ${postLength}
- CTA: ${cta}

Firemní cílení podle IČO:
${companyPromptBlock}

Marketingový briefing pro cílovou skupinu:
${audienceBriefs[targetAudience] || ''}

Pravidla pro platformu:
${platformBriefs[platform] || ''}

Tónové vodítko z databáze:
${selectedToneHints}

Vodítka pro CTA z databáze:
${selectedCtaHints}

Vodítka pro vizuál z databáze:
${selectedVisualHints}

Pravidla psaní:
- Piš přirozeně, srozumitelně a bez výplňových frází.
- Text musí být konkrétní a užitečný pro cílovou skupinu.
- Začni silným háčkem nebo problémem.
- Použij logiku PAS: problém -> důsledek -> řešení.
- Neopakuj stejnou myšlenku různými slovy.
- Nepiš obecné reklamní fráze bez obsahu.
- Nevymýšlej konkrétní čísla, srovnání ani technické sliby, pokud nejsou v zadání nebo v kontextu.
- ${strictClaims ? 'Drž se pouze ověřených tvrzení.' : 'Můžeš psát kreativněji, ale stále relevantně.'}
- ${includeEmojis ? 'Emoji používej střídmě a jen pokud se hodí k platformě.' : 'Nepoužívej emoji.'}

Pravidla podle délky:
- ${getLengthRule(postLength)}

Výstup vrať pouze jako čistý JSON objekt bez markdownu, bez vysvětlení a bez doprovodného textu.

Použij přesně tuto strukturu:
{
  "mainText": "finální text příspěvku",
  "visualPrompt": "stručné zadání pro generátor obrázku",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}

Pravidla pro JSON:
- "mainText" je vždy povinný neprázdný string.
- Pokud není vyžadován návrh vizuálu, vrať "visualPrompt": "".
- Pokud je vyžadován návrh vizuálu, "visualPrompt" musí být vždy napsaný česky.
- Pokud nejsou vyžadovány hashtagy, vrať "hashtags": [].
- Pokud jsou hashtagy vyžadovány, vrať přesně 5 relevantních hashtagů.
- Nevkládej do JSON žádné další klíče.
- Zachovej češtinu a přirozené formulace.`;

    const prompt = `Téma příspěvku: ${contentPrompt}

${resolvedCompanyProfile?.name ? `Zadané IČO firmy: ${resolvedCompanyProfile.ico}
Název firmy: ${resolvedCompanyProfile.name}` : 'IČO firmy není zadáno.'}

Vytvoř příspěvek pro zadanou cílovou skupinu.
Zaměř se na praktický přínos pro čtenáře.
Zakonči text konkrétní výzvou k akci: ${cta}

Návrh vizuálu: ${includeVisual ? 'ano' : 'ne'}
Hashtagy: ${includeHashtags ? 'ano' : 'ne'}`;

    const resolvedContactLabel =
      resolvedCompanyProfile?.recommendedContact?.label || 'vedení společnosti';

    const promptWithCompanyContacting = resolvedCompanyProfile?.name
      ? `${prompt}

Doporučená osoba / funkce k oslovení: ${resolvedContactLabel}
Přizpůsob text tak, aby působil jako nabídka služeb pro tuto firmu a tuto roli.`
      : prompt;

    const result = await generateWithGemini(promptWithCompanyContacting, systemPrompt, {
      expectJson: true,
      temperature: 0.45,
    });
    if (result) {
      const structuredPayload =
        normalizeGeneratedPayload(extractJsonPayload(result)) ||
        normalizeGeneratedPayload(parseGeneratedContent(result)) || {
          main: result.trim(),
          visual: '',
          hashtags: '',
        };

      if (includeVisual && looksLikeEnglishVisual(structuredPayload.visual)) {
        structuredPayload.visual = await translateVisualPromptToCzech(structuredPayload.visual);
      }

      const serializedContent = serializeGeneratedContent(structuredPayload);
      setGeneratedContent(serializedContent);
      setGeneratedImage('');
      setFlyerText('');
      setFlyerImage('');
      setImageError('');
      setHistoryItems((current) => [
        {
          id: `${Date.now()}`,
          createdAt: new Date().toISOString(),
          contentPrompt,
          companyIco: normalizedCompanyIco,
          companyProfile: resolvedCompanyProfile,
          platform,
          tone,
          targetAudience,
          postLength,
          cta,
          generatedContent: serializedContent,
        },
        ...current,
      ]);
    }
  };

  const handleMainTextChange = (value) => {
    const updatedContent = serializeGeneratedContent({
      main: value,
      visual: parsed.visual,
      hashtags: parsed.hashtags,
    });

    setGeneratedContent(updatedContent);
  };

  const handleTemplateChange = (index, value) => {
    setPromptTemplates((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item))
    );
  };

  const handleAddTemplate = () => {
    setPromptTemplates((current) => [...current, 'Nová rychlá šablona']);
    setTemplateEditorOpen(true);
  };

  const handleRemoveTemplate = (index) => {
    setPromptTemplates((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleResetTemplates = () => {
    setPromptTemplates(defaultPromptTemplates);
  };

  const handleOpenSourceImagePicker = () => {
    fileInputRef.current?.click();
  };

  const handleSourceImageSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      setSourceImageDataUrl(dataUrl);
      setSourceImageName(file.name);
      setSelectedCompanyPhotoId('');
      setImageMode('edit');
      setCompanyGalleryOpen(false);
      setImageError('');
    } catch (err) {
      setImageError(err.message || 'Nepodařilo se načíst vybranou fotku.');
    } finally {
      event.target.value = '';
    }
  };

  const handleClearSourceImage = () => {
    setSourceImageDataUrl('');
    setSourceImageName('');
    setSelectedCompanyPhotoId('');
  };

  const handleSelectCompanyPhoto = async (photo) => {
    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const file = new File([blob], photo.name, { type: blob.type || 'image/jpeg' });
      const dataUrl = await fileToDataUrl(file);
      setSourceImageDataUrl(dataUrl);
      setSourceImageName(photo.name);
      setSelectedCompanyPhotoId(photo.id);
      setImageMode('edit');
      setCompanyGalleryOpen(false);
      setImageError('');
    } catch {
      setImageError('Nepodařilo se načíst firemní fotku z galerie.');
    }
  };

  const handleReset = () => {
    setContentPrompt('');
    setCompanyIco('');
    setCompanyProfile(null);
    setPlatform('Facebook');
    setTone('Důraz na úspory a finance');
    setTargetAudience('Majitelé starších rodinných domů');
    setPostLength('Střední (150–200 slov)');
    setCta('Získat nezávaznou kalkulaci zdarma');
    setUseBrandContext(true);
    setUseKnowledgeBase(true);
    setIncludeEmojis(true);
    setIncludeVisual(true);
    setIncludeHashtags(true);
    setStrictClaims(true);
    setGeneratedContent('');
    setGeneratedImage('');
    setFlyerTitle('');
    setFlyerText('');
    setFlyerImage('');
    setImageError('');
    setError('');
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // Ignore localStorage write issues.
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f8f5ea_0%,#f2efe4_48%,#ebe7d9_100%)] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-[#628b06] bg-gradient-to-r from-[#739f08] via-[#7cab0a] to-[#6b9608] shadow-[0_10px_28px_rgba(77,101,19,0.18)]">
        <div className="mx-auto grid h-28 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
              <img
                src={logoImageUrl}
                alt="Chytrá pěna"
                className="h-12 w-auto sm:h-14"
              />
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-xl font-extrabold tracking-tight text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)] sm:text-2xl">Generátor příspěvků pro sociální sítě</h1>
            <p className="mt-1 text-sm font-medium text-lime-50/95">Chytrá pěna Bohemia s.r.o.</p>
          </div>

          <div />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[480px_minmax(0,1fr)]">
          <section className="space-y-5">
            <div className="rounded-[28px] border-2 border-[#98ad79] bg-[#f7f7ee] p-5 shadow-[0_22px_48px_rgba(15,23,42,0.10)]">
              <div className="mb-5 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-lime-50 to-[#f4f8e8] px-4 py-3 ring-1 ring-[#d7e1c6]">
                <div className="rounded-xl bg-lime-100 p-2 text-lime-700">
                  <Lightbulb className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold">Zadání příspěvku</h2>
              </div>

              <div className="space-y-5">
                <div className="rounded-[22px] border-2 border-[#c7d3b8] border-l-[5px] border-l-[#8fbb1a] bg-white p-4 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-lime-500" />
                      <h3 className="text-sm font-semibold text-slate-900">Rychlé šablony zadání</h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setTemplateEditorOpen((current) => !current)}
                      className="rounded-full border border-[#cad3bc] bg-[#fbfaf6] px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-lime-300 hover:bg-lime-50 hover:text-lime-700"
                    >
                      {templateEditorOpen ? 'Skrýt správu' : 'Spravovat šablony'}
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {promptTemplates.filter((item) => item.trim()).map((item, index) => (
                      <button
                        key={`${item}-${index}`}
                        onClick={() => setContentPrompt(item)}
                        className="rounded-full border border-[#d3dbc8] bg-[#fcfcf9] px-3 py-1.5 text-left text-xs font-medium leading-5 text-slate-700 transition hover:border-lime-300 hover:bg-lime-50 hover:text-lime-700"
                      >
                        {item}
                      </button>
                    ))}
                  </div>

                  {templateEditorOpen && (
                    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                      {promptTemplates.map((item, index) => (
                        <div key={`editor-${index}`} className="flex gap-2">
                          <input
                            value={item}
                            onChange={(e) => handleTemplateChange(index, e.target.value)}
                            className="min-w-0 flex-1 rounded-xl border border-[#d3dbc8] bg-[#fffefb] px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-lime-300 focus:ring-4 focus:ring-lime-100"
                            placeholder="Text rychlé šablony"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveTemplate(index)}
                            className="rounded-xl border border-[#d3dbc8] bg-[#fffefb] px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-red-200 hover:text-red-600"
                          >
                            Smazat
                          </button>
                        </div>
                      ))}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleAddTemplate}
                          className="rounded-xl border border-[#d3dbc8] bg-[#fffefb] px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-lime-300 hover:bg-lime-50 hover:text-lime-700"
                        >
                          Přidat šablonu
                        </button>
                        <button
                          type="button"
                          onClick={handleResetTemplates}
                          className="rounded-xl border border-[#d3dbc8] bg-[#fffefb] px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Obnovit výchozí
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-[22px] border-2 border-[#c7d3b8] border-l-[5px] border-l-[#8fbb1a] bg-white p-4 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Téma / hlavní myšlenka
                    </label>
                    <span className="text-xs text-slate-400">{estimatedWords} slov</span>
                  </div>
                  <textarea
                    className="h-28 w-full resize-none rounded-2xl border border-[#d0d9c4] bg-[#fffefb] p-4 text-sm outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition placeholder:text-slate-400 focus:border-lime-300 focus:ring-4 focus:ring-lime-100"
                    placeholder="Např. Proč zateplit střechu právě teď a co tím majitel domu reálně získá?"
                    value={contentPrompt}
                    onChange={(e) => setContentPrompt(e.target.value)}
                  />
                </div>

                <div className="rounded-[22px] border-2 border-[#c7d3b8] border-l-[5px] border-l-[#8fbb1a] bg-white p-4 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
                  <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#f7faee] px-3 py-2 ring-1 ring-[#e3ebd6]">
                    <div className="h-2.5 w-2.5 rounded-full bg-lime-500" />
                    <p className="text-sm font-bold text-slate-900">Cílení a formát</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FieldSelect label="Cílovka" value={targetAudience} onChange={setTargetAudience} options={audienceOptions} />
                    <FieldSelect label="Platforma" value={platform} onChange={setPlatform} options={platformOptions} />
                    <FieldSelect label="Tón" value={tone} onChange={setTone} options={toneOptions} />
                    <FieldSelect label="Délka" value={postLength} onChange={setPostLength} options={lengthOptions} />
                  </div>

                  <div className="mt-3">
                    <FieldSelect label="Výzva k akci (CTA)" value={cta} onChange={setCta} options={ctaOptions} />
                  </div>
                </div>

                <div className="rounded-[22px] border-2 border-[#c7d3b8] border-l-[5px] border-l-[#8fbb1a] bg-white p-4 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
                  <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#f7faee] px-3 py-2 ring-1 ring-[#e3ebd6]">
                    <div className="h-2.5 w-2.5 rounded-full bg-lime-500" />
                    <p className="text-sm font-bold text-slate-900">Firemní cílení podle IČO</p>
                  </div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    IČO firmy
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={companyIco}
                      onChange={(e) => handleCompanyIcoChange(e.target.value)}
                      inputMode="numeric"
                      maxLength={8}
                      placeholder="Např. 12345678"
                      className="min-w-0 flex-1 rounded-2xl border border-[#d0d9c4] bg-[#fffefb] px-3 py-3 text-sm text-slate-800 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition placeholder:text-slate-400 focus:border-lime-300 focus:ring-4 focus:ring-lime-100"
                    />
                    <button
                      type="button"
                      onClick={() => lookupCompanyByIco()}
                      disabled={companyLookupLoading || !normalizedCompanyIco}
                      className="rounded-2xl border border-[#d0d9c4] bg-[#fffefb] px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-lime-300 hover:bg-lime-50 hover:text-lime-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {companyLookupLoading ? 'Načítám…' : 'Dohledat'}
                    </button>
                  </div>
                  {companyModeActive && (
                    <>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      Dohledaná firma: <span className="font-semibold text-slate-700">{formatCompanyProfile(companyProfile)}</span>
                    </p>
                    <p className="text-xs leading-5 text-slate-500">
                      Doporučená osoba / funkce k oslovení:{' '}
                      <span className="font-semibold text-slate-700">
                        {formatRecommendedContact(companyProfile) || 'vedení společnosti'}
                      </span>
                    </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border-2 border-[#98ad79] bg-[#f7f7ee] p-5 shadow-[0_22px_48px_rgba(15,23,42,0.10)]">
              <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-lime-50 to-[#f4f8e8] px-4 py-3 ring-1 ring-[#d7e1c6]">
                <div className="rounded-xl bg-lime-100 p-2 text-lime-700">
                  <Settings2 className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold">Nastavení výstupu</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleCard
                  checked={useBrandContext}
                  onChange={setUseBrandContext}
                  title="Používat firemní data"
                  description="Zapojí fakta o úsporách, kvalitě, realizacích a dotacích."
                />
                <ToggleCard
                  checked={useKnowledgeBase}
                  onChange={setUseKnowledgeBase}
                  title="Použít znalostní databázi"
                  description="Doplní do promptu relevantní ověřené poznatky podle tématu a cílovky."
                />
                <ToggleCard
                  checked={strictClaims}
                  onChange={setStrictClaims}
                  title="Držet se ověřených tvrzení"
                  description="Omezí vymýšlení čísel a marketingových přehánění."
                />
                <ToggleCard
                  checked={includeEmojis}
                  onChange={setIncludeEmojis}
                  title="Použít emoji"
                  description="Vhodné hlavně pro Facebook a Instagram."
                />
                <div className="sm:col-span-2">
                  <ToggleCard
                    checked={includeVisual}
                    onChange={setIncludeVisual}
                    title="Navrhnout vizuál"
                    description="Přidá konkrétní doporučení k fotce nebo grafice."
                  />
                </div>
                <div className="sm:col-span-2">
                  <ToggleCard
                    checked={includeHashtags}
                    onChange={setIncludeHashtags}
                    title="Přidat hashtagy"
                    description="Na konci výstupu doplní 5 relevantních hashtagů."
                  />
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border-2 border-[#c7d3b8] border-l-[5px] border-l-[#8fbb1a] bg-white p-4 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Režim obrázku</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Pro věrnější výstupy doporučuju reálnou fotku s AI úpravou.
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setImageMode('edit')}
                    className={classNames(
                      'rounded-2xl border px-4 py-3 text-left transition',
                      imageMode === 'edit'
                        ? 'border-lime-400 bg-gradient-to-br from-lime-50 to-[#eef8d8] text-lime-900 shadow-[0_10px_22px_rgba(122,169,10,0.14)]'
                        : 'border-[#d0d9c4] bg-[#fffefb] text-slate-600 hover:border-lime-300 hover:bg-[#fcfdf8]'
                    )}
                  >
                    <div className="font-semibold">Reálná fotka + AI úprava</div>
                    <div className="mt-1 text-xs">Zachová skutečnou realizaci a jen ji vizuálně doladí.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImageMode('generate')}
                    className={classNames(
                      'rounded-2xl border px-4 py-3 text-left transition',
                      imageMode === 'generate'
                        ? 'border-lime-400 bg-gradient-to-br from-lime-50 to-[#eef8d8] text-lime-900 shadow-[0_10px_22px_rgba(122,169,10,0.14)]'
                        : 'border-[#d0d9c4] bg-[#fffefb] text-slate-600 hover:border-lime-300 hover:bg-[#fcfdf8]'
                    )}
                  >
                    <div className="font-semibold">AI generace od nuly</div>
                    <div className="mt-1 text-xs">Použije pouze textový popis bez podkladové fotky.</div>
                  </button>
                </div>

                {imageMode === 'edit' && (
                  <div className="mt-4 rounded-[22px] border-2 border-[#c7d3b8] border-l-[5px] border-l-[#8fbb1a] bg-white p-4 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
                    {companyPhotoLibrary.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Firemní galerie</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Vyber fotku ze složky `src/assets/Foto` a použij ji jako základ pro AI úpravu.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCompanyGalleryOpen((current) => !current)}
                            className="rounded-xl border border-[#d3dbc8] bg-[#fbfaf6] px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-lime-300 hover:bg-lime-50 hover:text-lime-700"
                          >
                            {companyGalleryOpen ? 'Skrýt galerii' : 'Otevřít galerii'}
                          </button>
                        </div>

                        {companyGalleryOpen && (
                          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {companyPhotoLibrary.map((photo) => (
                              <button
                                key={photo.id}
                                type="button"
                                onClick={() => handleSelectCompanyPhoto(photo)}
                                className={classNames(
                                  'overflow-hidden rounded-2xl border text-left transition',
                                  selectedCompanyPhotoId === photo.id
                                    ? 'border-lime-300 bg-lime-50 ring-2 ring-lime-200'
                                    : 'border-[#d0d9c4] bg-white hover:border-lime-300'
                                )}
                              >
                                <img
                                  src={photo.url}
                                  alt={photo.name}
                                  className="h-24 w-full object-cover"
                                />
                                <div className="border-t border-[#d0d9c4] bg-white px-3 py-2">
                                  <p className="truncate text-xs font-semibold text-slate-700">{photo.name}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Podkladová firemní fotka</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Nahraj reálnou fotku realizace, kterou má AI upravit pro sociální sítě.
                        </p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleSourceImageSelected}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={handleOpenSourceImagePicker}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#d0d9c4] bg-[#fbfaf6] px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-lime-300 hover:bg-lime-50 hover:text-lime-700"
                      >
                        <Upload className="h-4 w-4" />
                        {sourceImageDataUrl ? 'Vyměnit fotku' : 'Nahrát fotku'}
                      </button>
                    </div>

                    {sourceImageDataUrl ? (
                      <div className="mt-4 flex gap-4 rounded-2xl border border-[#d0d9c4] bg-[#fbfaf6] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                        <img
                          src={sourceImageDataUrl}
                          alt="Vybraná firemní fotka"
                          className="h-24 w-24 rounded-xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{sourceImageName}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Tato fotka bude použita jako reálný základ a AI upraví hlavně světlo, kompozici a marketingový dojem.
                          </p>
                          <button
                            type="button"
                            onClick={handleClearSourceImage}
                            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-red-600"
                          >
                            <X className="h-3.5 w-3.5" />
                            Odebrat fotku
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-[#d0d9c4] bg-[#fbfaf6] p-4 text-sm text-slate-500">
                        Zatím není vybraná žádná firemní fotka.
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 rounded-[22px] border-2 border-[#c7d3b8] border-l-[5px] border-l-[#8fbb1a] bg-white p-4 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Pozice loga</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Brand badge se vkládá až po vygenerování obrázku, zcela nezávisle na AI.
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ['top-left', 'Vlevo nahoře'],
                      ['top-right', 'Vpravo nahoře'],
                      ['bottom-left', 'Vlevo dole'],
                      ['bottom-right', 'Vpravo dole'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLogoPosition(value)}
                        className={classNames(
                          'rounded-xl border px-3 py-2 text-xs font-semibold transition',
                          logoPosition === value
                            ? 'border-lime-200 bg-lime-50 text-lime-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-lime-200'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                disabled={isDisabled}
                onClick={handleGenerateContent}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#7aa90a] to-[#6d9808] px-5 py-3.5 font-bold text-white shadow-[0_14px_30px_rgba(122,169,10,0.28)] transition hover:from-[#6f9d08] hover:to-[#648b07] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                Vygenerovat příspěvek
              </button>

              <button
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#d2d9c8] bg-[#fbfaf6] px-5 py-3.5 font-semibold text-slate-700 transition hover:bg-white"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-700 shadow-[0_10px_24px_rgba(239,68,68,0.08)]">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="rounded-[28px] border border-[#aebe97] bg-[#f8f8f1] p-5 shadow-[0_20px_44px_rgba(15,23,42,0.09)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-lime-500" />
                  <h2 className="text-lg font-bold">Historie návrhů</h2>
                </div>
                {historyItems.length > 0 && (
                  <span className="rounded-full border border-[#d7ded0] bg-[#f7f7f2] px-3 py-1 text-xs font-semibold text-slate-500">
                    {Math.min(historyItems.length, 12)} položek
                  </span>
                )}
              </div>

              {historyItems.length > 0 ? (
                <div className="space-y-3">
                  {historyItems.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleRestoreHistoryItem(item)}
                      className="w-full rounded-2xl border border-[#d7ded0] bg-white/85 p-4 text-left shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition hover:border-lime-300 hover:bg-[#fcfdf8]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.contentPrompt}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.targetAudience} · {item.platform}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-slate-400">
                          {new Date(item.createdAt).toLocaleDateString('cs-CZ')}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                        {parseGeneratedContent(item.generatedContent).main || 'Bez náhledu textu.'}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#d7ded0] bg-[#fbfaf6] p-4 text-sm text-slate-500">
                  Po prvním úspěšném generování se sem uloží poslední návrhy pro rychlé vrácení.
                </div>
              )}
            </div>
          </section>

          <section className="flex min-h-[640px] flex-col rounded-[30px] border border-[#4f6178] bg-gradient-to-b from-[#58697f] via-[#4d5f76] to-[#42546a] shadow-[0_24px_54px_rgba(15,23,42,0.24)]">
            <div className="flex items-center justify-between border-b border-slate-700/80 bg-slate-900/12 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-300/70">Výstup pro sítě</p>
                <p className="mt-1 text-sm text-slate-200/85">Hotový text, návrh vizuálu a hashtagy</p>
              </div>

              {generatedContent && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleExportDocx}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700/90 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 hover:text-white"
                  >
                    <Download className="h-4 w-4" />
                    Export DOCX
                  </button>
                  <button
                    onClick={() => copyToClipboard(fullContentWithContact)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700/90 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 hover:text-white"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <ClipboardPaste className="h-4 w-4" />}
                    {copied ? 'Zkopírováno' : 'Kopírovat vše'}
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto p-6">
              {loading ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className="rounded-full border border-lime-400/30 bg-lime-500/12 p-4 shadow-[0_10px_24px_rgba(122,169,10,0.12)]">
                    <RefreshCw className="h-8 w-8 animate-spin text-lime-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-200">Generuji příspěvek za Chytrou pěnu…</p>
                    <p className="mt-1 text-sm text-slate-500">Ladím strukturu, tón i CTA.</p>
                  </div>
                </div>
              ) : generatedContent ? (
                <div className="space-y-5">
                  <ContentCard
                    icon={<FileText className="h-4 w-4" />}
                    title="Hlavní text"
                    tone="default"
                    actions={<MiniCopyButton text={parsed.main} onCopy={copyToClipboard} label="Kopírovat text" />}
                  >
                    <textarea
                      ref={mainTextAreaRef}
                      value={parsed.main}
                      onChange={(e) => handleMainTextChange(e.target.value)}
                      className="min-h-[240px] w-full overflow-hidden rounded-xl border border-slate-700/90 bg-[#0b1220] p-3 text-sm leading-7 text-slate-100 outline-none transition focus:border-lime-400 focus:ring-4 focus:ring-lime-500/10"
                    />

                    <div className="mt-4 rounded-xl border border-slate-700/90 bg-[#0f172a]/82 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kontakt</p>
                      <div className="mt-2 space-y-1 text-sm text-slate-300">
                        <p>Web: {companyContact.web}</p>
                        <p>E-mail: {companyContact.email}</p>
                        <p>Telefon: {companyContact.phone}</p>
                      </div>
                    </div>
                  </ContentCard>

                  {parsed.visual && (
                    <ContentCard
                      icon={<ImageIcon className="h-4 w-4" />}
                      title="Doporučený vizuál"
                      tone="brand"
                      actions={
                        <div className="flex flex-wrap gap-2">
                          <MiniCopyButton
                            text={parsed.visual}
                            onCopy={copyToClipboard}
                            label="Kopírovat vizuál"
                          />
                          <button
                            onClick={handleGenerateImage}
                            disabled={imageLoading}
                            className="rounded-lg border border-lime-300/30 bg-lime-500/20 px-2.5 py-1.5 text-xs font-medium text-lime-50 hover:bg-lime-500/30 disabled:opacity-50"
                          >
                            {imageLoading
                              ? 'Zpracovávám…'
                              : imageMode === 'edit'
                                ? 'Upravit reálnou fotku'
                                : 'Vytvořit obrázek'}
                          </button>
                        </div>
                      }
                    >
                      <p className="text-sm leading-7 text-lime-50">{parsed.visual}</p>

                      {imageMode === 'edit' && sourceImageDataUrl && (
                        <div className="mt-4 rounded-xl border border-lime-300/25 bg-[#0f172a]/26 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-lime-100/80">
                            Podkladová fotka
                          </p>
                          <div className="mt-3 flex gap-3">
                            <img
                              src={sourceImageDataUrl}
                              alt="Podkladová firemní fotka"
                              className="h-20 w-20 rounded-xl object-cover"
                            />
                            <div className="text-xs leading-5 text-lime-50/85">
                              <p className="font-semibold text-lime-50">{sourceImageName || 'Vybraná fotka'}</p>
                              <p className="mt-1">
                                AI zachová hlavní scénu a upraví hlavně světlo, kompozici a prezentaci pro sociální sítě.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {imageError && (
                        <p className="mt-3 text-xs text-red-200">{imageError}</p>
                      )}

                      {generatedImage && (
                        <div className="mt-4 overflow-hidden rounded-xl border border-lime-300/20">
                          <img
                            src={generatedImage}
                            alt="AI návrh obrázku"
                            className="h-auto w-full"
                          />
                        </div>
                      )}
                    </ContentCard>
                  )}

                  {parsed.hashtags && (
                    <ContentCard
                      icon={<Hash className="h-4 w-4" />}
                      title="Hashtagy"
                      tone="slate"
                      actions={<MiniCopyButton text={parsed.hashtags} onCopy={copyToClipboard} label="Kopírovat hashtagy" />}
                    >
                      <div className="flex flex-wrap gap-2">
                        {parsed.hashtags
                          .split(/\s+/)
                          .filter(Boolean)
                          .map((tag, index) => (
                            <span
                              key={`${tag}-${index}`}
                              className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200"
                            >
                              {tag}
                            </span>
                          ))}
                      </div>
                    </ContentCard>
                  )}

                  {(generatedImage || flyerImage) && (
                    <ContentCard
                      icon={<Download className="h-4 w-4" />}
                      title="Leták"
                      tone="brand"
                      actions={
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleSuggestFlyerText}
                            disabled={flyerTextLoading}
                            className="rounded-lg border border-lime-300/35 bg-lime-500/22 px-2.5 py-1.5 text-xs font-medium text-lime-50 hover:bg-lime-500/34 disabled:opacity-50"
                          >
                            {flyerTextLoading ? 'Navrhuji…' : 'Navrhnout text letáku'}
                          </button>
                          <button
                            type="button"
                            onClick={handleGenerateFlyer}
                            disabled={flyerLoading || !generatedImage}
                            className="rounded-lg border border-lime-300/35 bg-lime-500/22 px-2.5 py-1.5 text-xs font-medium text-lime-50 hover:bg-lime-500/34 disabled:opacity-50"
                          >
                            {flyerLoading ? 'Generuji…' : 'Vygenerovat leták'}
                          </button>
                          {flyerImage && (
                            <button
                              type="button"
                              onClick={handleDownloadFlyer}
                              className="rounded-lg border border-slate-700/90 bg-slate-950/82 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
                            >
                              Stáhnout leták
                            </button>
                          )}
                        </div>
                      }
                    >
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                        <input
                          value={flyerTitle}
                          onChange={(e) => setFlyerTitle(e.target.value)}
                          placeholder="Nadpis letáku"
                          className="rounded-xl border border-slate-700/90 bg-[#0b1220] px-3 py-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-lime-400 focus:ring-4 focus:ring-lime-500/10"
                        />

                        <div className="grid grid-cols-3 gap-2">
                          {flyerTemplates.map((template) => (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => setFlyerTemplate(template.id)}
                              className={classNames(
                                'rounded-xl border px-2 py-2 text-xs font-semibold transition',
                                flyerTemplate === template.id
                                  ? 'border-lime-300/35 bg-lime-500/22 text-lime-50'
                                  : 'border-slate-700/90 bg-slate-950/82 text-slate-300 hover:border-slate-500 hover:text-white'
                              )}
                            >
                              {template.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <textarea
                        value={flyerText}
                        onChange={(e) => setFlyerText(e.target.value)}
                        placeholder="Sem můžeš ručně upravit nebo nechat AI navrhnout text letáku."
                        className="min-h-[160px] w-full rounded-xl border border-slate-700/90 bg-[#0b1220] p-3 text-sm leading-7 text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-lime-400 focus:ring-4 focus:ring-lime-500/10"
                      />

                      <div className="mt-4 rounded-xl border border-lime-300/20 bg-slate-950/20 p-3 text-xs leading-6 text-lime-50/85">
                        Leták se skládá z vygenerované fotografie, textu výše a firemních kontaktů. Nejlépe funguje s krátkým nadpisem a několika stručnými benefitovými větami.
                      </div>

                      {flyerImage && (
                        <div className="mt-4 overflow-hidden rounded-xl border border-lime-300/20">
                          <img
                            src={flyerImage}
                            alt="Náhled letáku"
                            className="h-auto w-full"
                          />
                        </div>
                      )}
                    </ContentCard>
                  )}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="rounded-full border border-slate-800 bg-slate-900 p-5">
                    <MessageCircle className="h-10 w-10 text-slate-700" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-200">Zatím není co zobrazit</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Vyplňte vlevo téma, zvolte parametry a spusťte generování. Výstup se zobrazí přehledně po sekcích.
                  </p>
                  <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-400">
                    <ChevronRight className="h-4 w-4 text-lime-400" />
                    Začněte zadáním tématu
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-[#d6ddd0] bg-[#fffefb] px-3 py-3 text-sm text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition focus:border-lime-300 focus:ring-4 focus:ring-lime-100"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleCard({ checked, onChange, title, description }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={classNames(
        'w-full rounded-[20px] border px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition',
        checked
          ? 'border-lime-300 bg-lime-50 shadow-[0_12px_24px_rgba(122,169,10,0.12)]'
          : 'border-[#ccd5c0] bg-white hover:border-lime-300 hover:bg-[#fcfdf8]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="pr-2">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
        </div>
        <div
          className={classNames(
            'mt-0.5 h-6 w-11 rounded-full p-1 shadow-inner transition',
            checked ? 'bg-lime-500' : 'bg-slate-300'
          )}
        >
          <div
            className={classNames(
              'h-4 w-4 rounded-full bg-white transition',
              checked ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </div>
      </div>
    </button>
  );
}

function ContentCard({ icon, title, tone = 'default', children, actions }) {
  const toneClasses = {
    default: 'border-slate-700/90 bg-slate-900/96 shadow-[0_14px_30px_rgba(15,23,42,0.16)]',
    brand: 'border-lime-300/20 bg-gradient-to-br from-lime-500/16 to-slate-900/28 shadow-[0_14px_30px_rgba(15,23,42,0.14)]',
    slate: 'border-slate-700/90 bg-slate-900/86 shadow-[0_14px_30px_rgba(15,23,42,0.14)]',
  };

  return (
    <div className={classNames('rounded-2xl border p-4 backdrop-blur-sm', toneClasses[tone])}>
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/8 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <div className="rounded-lg border border-white/8 bg-white/10 p-1.5 text-lime-400">{icon}</div>
          {title}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function MiniCopyButton({ text, onCopy, label }) {
  return (
    <button
      onClick={() => onCopy(text)}
      className="rounded-lg border border-slate-700/90 bg-slate-950/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 hover:text-white"
    >
      {label}
    </button>
  );
}
