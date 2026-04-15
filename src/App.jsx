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
const contentPrimaryModel = import.meta.env.VITE_GEMINI_CONTENT_MODEL || 'gemini-2.5-pro';
const contentFallbackModel = import.meta.env.VITE_GEMINI_CONTENT_FALLBACK_MODEL || primaryModel;

if (!apiKey) {
  console.warn('Missing VITE_GEMINI_API_KEY');
}

const brandContext = `Jsme Chytrá pěna Bohemia s.r.o., specialista na stříkanou PUR izolaci.

Klíčové výhody a firemní argumenty:
- Úspora až 70 % nákladů na vytápění používej jen jako firemní claim, ne jako univerzální slib.
- Návratnost investice 5–8 let uváděj jen orientačně a bez garance.
- Zateplení rodinného domu do 200 m² za 1 den podávej jako orientační firemní údaj.
- Silná témata značky: omezení tepelných mostů, utěsnění konstrukce, rychlost realizace a dlouhodobá funkčnost.
- Důvěryhodnost podpoř argumenty jako počet realizací, zkušenost, kvalita provedení a pomoc s dotacemi.
- Web firmy staví komunikaci také na německé kvalitě, více než 9 000 realizacích a širokém použití pro střechy, podkroví, podlahy, fasády i haly.
- Když si nejsi jistý přesností tvrzení, zvol raději opatrnější a poradenskou formulaci.`;

const compactBrandContext = `Chytrá pěna Bohemia s.r.o. je specialista na stříkanou PUR izolaci. Piš stručně, česky, prakticky a důvěryhodně. Opírej se hlavně o úspory, omezení tepelných mostů, rychlost realizace a zkušenost firmy.`;

const defaultPromptTemplates = [
  `Majitel domu často odkládá zateplení střechy, i když mu přes ni uniká teplo a rostou náklady na vytápění.
Napiš příspěvek, který vysvětlí:
- proč se vyplatí řešit zateplení ještě před zimou
- jak poznat, že teplo uniká právě střechou nebo podkrovím
- jaké praktické dopady má odkládání o další sezónu
Zaměř se na úspory, komfort a jednoduchý další krok.`,

  `Mnoho lidí řeší v podkroví v zimě chlad a v létě přehřívání, ale neví přesně proč.
Napiš příspěvek, který srozumitelně vysvětlí:
- proč bývá podkroví tepelně nestabilní
- jakou roli hrají tepelné mosty a netěsnosti
- proč nestačí jen přidat další vrstvu staré izolace
Zaměř se na pochopení problému, běžný jazyk a důvěryhodné vysvětlení.`,

  `Lidé často vnímají PUR izolaci jen jako dražší variantu bez jasného srovnání.
Napiš příspěvek, který vysvětlí:
- jak PUR izolace pomáhá snižovat náklady na vytápění
- jaké má výhody oproti běžným řešením
- proč je důležitá nejen volba materiálu, ale i správná aplikace
Zaměř se na praktické přínosy, dlouhodobou funkčnost a důvěryhodnost.`,

  `Majitel domu nebo investor zvažuje, kdy dává PUR izolace smysl u novostavby nebo rekonstrukce.
Napiš příspěvek, který ukáže:
- kdy se PUR izolace vyplatí u novostavby
- co přináší zateplení domu v praxi
- jak rychle může proběhnout realizace
Zaměř se na prevenci budoucích chyb, rychlost řešení a dlouhodobý efekt.`,

  `Mnoho lidí začne problém s izolací řešit až po první zimě, kdy se projeví vysoké účty a nižší komfort.
Napiš příspěvek, který popíše:
- co lidé nejčastěji řeší po první zimě bez kvalitní izolace
- jak vypadá rozdíl před a po zateplení v komfortu a nákladech
- proč se vyplatí řešit problém včas, ne až když se naplno projeví
Zaměř se na reálné životní situace a srozumitelný dopad na domácnost.`,

  `Zateplení není jen o komfortu, ale může souviset i s financemi a dotacemi.
Napiš příspěvek, který vysvětlí:
- jakou roli hraje izolace při žádosti o dotaci
- proč není fér posuzovat cenu izolace bez kontextu úspor a návratnosti
- jak se rozhodovat prakticky a bez přehnaných očekávání
Zaměř se na rozumné rozhodování, ekonomický pohled a přirozené CTA.`,
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
- Důležitá témata: úspora, pohodlí, teplo domova, jistota správného rozhodnutí a jednoduchost realizace.
- Piš civilně, srozumitelně a prakticky.
- Používej konkrétní životní situace a běžné problémy.
- Omez technický žargon a převáděj technické pojmy do běžného jazyka.
`,
  'Lidé plánující novostavbu': `
- Tito lidé chtějí udělat správné rozhodnutí hned na začátku a vyhnout se budoucím chybám.
- Důležitá témata: prevence chyb, kvalita řešení, dlouhodobá funkčnost a správné rozhodnutí napoprvé.
- Piš věcně, ale stále srozumitelně.
- Zdůrazni výhodu správného řešení už ve fázi plánování nebo výstavby.
`,
  'SVJ a bytová družstva': `
- Tito lidé řeší rozpočet, odpovědnost, schvalování a dlouhodobý přínos pro více vlastníků.
- Důležitá témata: provozní náklady, plánování, důvěryhodnost dodavatele, systematičnost a dopad na obyvatele.
- Piš profesionálněji, méně emotivně.
- Zdůrazni stabilitu, přehlednost a ekonomický dopad.
`,
  'Firmy (haly a sklady)': `
- Tito lidé řeší provozní náklady, efektivitu, rychlost realizace a omezení provozních ztrát.
- Důležitá témata: výkon, návratnost, provoz, logistika, termín a efektivita.
- Piš stručně, věcně a obchodně.
- Zdůrazni dopad na provoz a náklady místo obecného marketingu.
`,
};

const platformBriefs = {
  Facebook: `
- Styl: civilní, praktický a dobře čitelný.
- Vhodné jsou kratší odstavce a silný úvod.
- Text má být přístupný širokému publiku.
`,
  Instagram: `
- Styl: údernější, vizuálnější a emotivnější.
- Používej kratší řádky a svižnější rytmus.
- Text musí dobře fungovat spolu s vizuálem.
`,
  LinkedIn: `
- Styl: profesionálnější, důvěryhodný a expertní.
- Piš věcněji, méně emotivně.
- Zdůrazni kompetenci, přínos a kvalitu řešení.
`,
};

const messagingExamples = {
  social: `
Příklad dobrého směru pro běžný příspěvek:
- Háček: pojmenuj častý problém čtenáře.
- Důsledek: ukaž, proč je problém drahý nebo nepříjemný.
- Řešení: vysvětli přínos PUR izolace srozumitelně a bez přehánění.
- Závěr: klidná výzva k dalšímu kroku.`,
  company: `
Příklad dobrého směru pro firemní oslovení:
- Oslov konkrétní firmu nebo její roli profesionálně a věcně.
- Ukaž, jak se téma propisuje do provozu, rozpočtu nebo správy objektu.
- Nabídni řešení bez agresivního nátlaku.
- Závěr směřuj ke konzultaci, ověření stavu nebo nezávaznému návrhu.`,
  flyer: `
Příklad dobrého směru pro leták:
- Krátký silný nadpis.
- 3 až 5 stručných benefitových vět.
- Minimum výplňových frází, maximum srozumitelnosti.
- Jedno jasné CTA a firemní kontakty.`
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
const customGalleryStorageKey = 'klara-custom-gallery';

const defaultOutputMeta = {
  content: {
    provider: '',
    model: '',
  },
  chat: {
    provider: '',
    model: '',
  },
};

const defaultFlyerStructure = {
  headline: '',
  subheadline: '',
  benefits: [],
  proof: '',
  cta: '',
};

const flyerTemplates = [
  { id: 'classic', label: 'Magazín' },
  { id: 'split', label: 'Promo' },
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

  const fencedMatch = text.match(/```json\s*([\s\S]*)```/i);
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
  if (!company.name) return '';

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
  const recommended = company.recommendedContact;
  if (!recommended.label) return '';
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

function drawRoundedRect(context, x, y, width, height, radius, fillStyle, strokeStyle = '', lineWidth = 0) {
  context.save();
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  if (fillStyle) {
    context.fillStyle = fillStyle;
    context.fill();
  }
  if (strokeStyle && lineWidth > 0) {
    context.strokeStyle = strokeStyle;
    context.lineWidth = lineWidth;
    context.stroke();
  }
  context.restore();
}

function splitFlyerCopy(text, fallbackCta = 'Získejte nezávaznou kalkulaci zdarma.') {
  const normalized = String(text || '')
    .replace(/\r/g, '')
    .trim();

  if (!normalized) {
    return {
      intro: '',
      bullets: [],
      cta: fallbackCta,
    };
  }

  const paragraphLines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let segments = [];

  if (paragraphLines.length >= 3) {
    segments = paragraphLines;
  } else {
    segments = normalized
      .split(/(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const intro = segments[0] || '';
  const bullets = segments.slice(1, 4);
  const cta = segments[4] || segments[segments.length - 1] || fallbackCta;

  return {
    intro,
    bullets: bullets.length ? bullets : segments.slice(0, 3),
    cta,
  };
}

function normalizeFlyerPayload(payload, fallbackCta = 'Získejte nezávaznou kalkulaci zdarma.') {
  if (!payload || typeof payload !== 'object') {
    return { ...defaultFlyerStructure, cta: fallbackCta };
  }

  const flyerSource = payload.flyer && typeof payload.flyer === 'object' ? payload.flyer : payload;

  const benefits = Array.isArray(flyerSource.benefits)
    ? flyerSource.benefits.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 3)
    : [];

  return {
    headline: String(flyerSource.headline || flyerSource.title || '').trim(),
    subheadline: String(flyerSource.subheadline || '').trim(),
    benefits,
    proof: String(flyerSource.proof || '').trim(),
    cta: String(flyerSource.cta || '').trim() || fallbackCta,
  };
}

function buildFlyerEditableText(structure) {
  const parts = [];

  if (structure.subheadline) {
    parts.push(structure.subheadline);
  }

  if (Array.isArray(structure.benefits) && structure.benefits.length) {
    parts.push(...structure.benefits);
  }

  if (structure.proof) {
    parts.push(structure.proof);
  }

  if (structure.cta) {
    parts.push(structure.cta);
  }

  return parts.filter(Boolean).join('\n');
}

function buildVisualBrief({
  visualPrompt,
  platform,
  targetAudience,
  imageMode,
  companyProfile,
  selectedVisualHints,
  selectedProducts,
  selectedProofPoints,
  selectedPainPoints,
  selectedNegativeHints,
}) {
  const audienceDirectives = {
    'Majitelé starších rodinných domů': [
      'scéna má působit civilně, důvěryhodně a jako reálný český rodinný dům',
      'zvýrazni komfort bydlení, teplo domova, kvalitu provedení a omezení tepelných ztrát',
      'vhodné jsou útulné, čisté a realistické záběry střechy, podkroví nebo detailu realizace',
    ],
    'Lidé plánující novostavbu': [
      'scéna má působit jako kvalitní novostavba nebo rozestavěný objekt s profesionálním provedením',
      'zdůrazni preciznost, správné řešení už od začátku a čistotu konstrukce',
      'vhodné jsou přesné detaily skladby, řemeslná kvalita a technická čistota bez vizuálního chaosu',
    ],
    'SVJ a bytová družstva': [
      'scéna má působit profesionálně a systematicky, vhodná pro správu bytových domů',
      'zobraz bytový dům, střechu domu, fasádu nebo technicky důvěryhodný detail realizace',
      'vizuál má komunikovat rozsah, stabilitu, spolehlivost a dlouhodobý přínos',
    ],
    'Firmy (haly a sklady)': [
      'scéna má působit věcně, obchodně a provozně relevantně',
      'zobraz halu, sklad, průmyslový objekt, střechu haly nebo technický detail izolace',
      'zdůrazni efektivitu, provozní kvalitu, rychlost realizace a omezení ztrát',
    ],
  };

  const platformDirectives = {
    Facebook: [
      'kompozice má být snadno čitelná i v feedu',
      'jeden hlavní motiv, jasný fokus, přirozené barvy',
    ],
    Instagram: [
      'vizuál má být výraznější, estetičtější a s čistou kompozicí',
      'ponech dost negativního prostoru pro případný headline v postprodukci',
    ],
    LinkedIn: [
      'vizuál má působit profesionálně, věcně a důvěryhodně',
      'méně emoce, více kvalita realizace, technická čistota a business relevance',
    ],
  };

  const companyDirectives = companyProfile?.name
    ? [
        `vizuál má odpovídat typu organizace: ${companyProfile.name}`,
        companyProfile.industry ? `obor firmy: ${companyProfile.industry}` : '',
        'nepůsobit jako generická reklama pro domácnosti, ale jako relevantní řešení pro daný typ objektu',
      ].filter(Boolean)
    : [];

  const blocks = [
    `Hlavní motiv: ${visualPrompt || ''}`,
    '',
    'Cílení podle publika:',
    ...(audienceDirectives[targetAudience] || []),
    '',
    'Cílení podle platformy:',
    ...(platformDirectives[platform] || []),
    '',
    ...(companyDirectives.length ? ['Firemní kontext:', ...companyDirectives, ''] : []),
    'Produktové vazby:',
    selectedProducts || '- bez konkrétní produktové vazby',
    '',
    'Vizuální hinty:',
    selectedVisualHints || '- bez doplňkových hintů',
    '',
    'Pain points, které může vizuál nepřímo naznačit:',
    selectedPainPoints || '- bez doplňkových pain points',
    '',
    'Důvěryhodnost / proof:',
    selectedProofPoints || '- bez proof points',
    '',
    'Čemu se vyhnout:',
    selectedNegativeHints || '- bez speciálních varování',
    '',
    `Režim obrázku: ${imageMode === 'edit' ? 'upravit reálnou fotku' : 'vygenerovat nový realistický vizuál'}`,
  ];

  return blocks.filter(Boolean).join('\n');
}

function drawFlyerBulletCards(context, bullets, x, startY, width, options = {}) {
  const accent = options.accent || '#79aa0a';
  const cardFill = options.cardFill || '#ffffff';
  const cardStroke = options.cardStroke || '#dce4cf';
  const textColor = options.textColor || '#1e293b';
  const iconFill = options.iconFill || 'rgba(121,170,10,0.15)';
  const maxItems = options.maxItems || 3;
  const list = bullets.filter(Boolean).slice(0, maxItems);

  let currentY = startY;

  list.forEach((bullet, index) => {
    context.font = '600 24px "Segoe UI", Arial, sans-serif';
    const lines = wrapCanvasText(context, bullet, width - 124);
    const textHeight = Math.max(1, lines.length) * 31;
    const cardHeight = Math.max(108, textHeight + 50);
    drawRoundedRect(context, x, currentY, width, cardHeight, 26, cardFill, cardStroke, 2);
    drawRoundedRect(context, x + 22, currentY + 24, 58, 58, 18, iconFill);
    context.fillStyle = accent;
    context.font = '700 28px "Segoe UI", Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText(String(index + 1), x + 51, currentY + 61);

    context.textAlign = 'left';
    context.fillStyle = textColor;
    context.font = '600 24px "Segoe UI", Arial, sans-serif';
    drawWrappedCanvasText(context, bullet, x + 102, currentY + 42, width - 124, 31);
    currentY += cardHeight + 18;
  });

  return currentY;
}

function drawFlyerCtaBand(context, text, x, y, width, accent = '#79aa0a') {
  drawRoundedRect(context, x, y, width, 110, 28, accent);
  context.fillStyle = '#ffffff';
  context.textAlign = 'left';
  context.font = '700 28px "Segoe UI", Arial, sans-serif';
  drawWrappedCanvasText(context, text, x + 30, y + 42, width - 60, 34);
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
    const audienceMatch = !entry.audiences.length || entry.audiences.includes(targetAudience);
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

function buildProductSection(entries) {
  const products = collectKnowledgeHints(entries, 'applicableProducts');
  if (!products.length) {
    return '- Znalostní databáze neurčila konkrétní produktovou vazbu.';
  }

  return products.map((product) => `- ${product}`).join('\n');
}

function buildCompactKnowledgeContext(entries) {
  if (!entries.length) {
    return '- Bez doplňkového znalostního bloku.';
  }

  return entries
    .slice(0, 3)
    .map((entry) => {
      const fact = entry.facts?.[0];
      return fact ? `- ${entry.title}: ${fact}` : `- ${entry.title}`;
    })
    .join('\n');
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
  const [outputMeta, setOutputMeta] = useState(defaultOutputMeta);
  const [revisionPrompt, setRevisionPrompt] = useState('');
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState('');
  const [flyerTitle, setFlyerTitle] = useState('');
  const [flyerText, setFlyerText] = useState('');
  const [flyerStructure, setFlyerStructure] = useState(defaultFlyerStructure);
  const [flyerImage, setFlyerImage] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  const [visualSuggestionLoading, setVisualSuggestionLoading] = useState(false);
  const [flyerLoading, setFlyerLoading] = useState(false);
  const [flyerTextLoading, setFlyerTextLoading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [imageMode, setImageMode] = useState('edit');
  const [logoPosition, setLogoPosition] = useState('bottom-right');
  const [flyerTemplate, setFlyerTemplate] = useState('classic');
  const [sourceImageDataUrl, setSourceImageDataUrl] = useState('');
  const [sourceImageName, setSourceImageName] = useState('');
  const [selectedCompanyPhotoId, setSelectedCompanyPhotoId] = useState('');
  const [customGalleryItems, setCustomGalleryItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [promptTemplates, setPromptTemplates] = useState(defaultPromptTemplates);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [companyGalleryOpen, setCompanyGalleryOpen] = useState(false);
  const [companyLookupLoading, setCompanyLookupLoading] = useState(false);
  const fileInputRef = useRef(null);
  const mainTextAreaRef = useRef(null);

  const parsed = useMemo(() => parseGeneratedContent(generatedContent), [generatedContent]);
  const companyGalleryItems = useMemo(
    () => [
      ...customGalleryItems,
      ...companyPhotoLibrary,
    ],
    [customGalleryItems]
  );

  useEffect(() => {
    if (!mainTextAreaRef.current) return;

    mainTextAreaRef.current.style.height = '0px';
    mainTextAreaRef.current.style.height = `${mainTextAreaRef.current.scrollHeight}px`;
  }, [parsed.main]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(customGalleryStorageKey);
      if (!raw) return;
      const parsedGallery = JSON.parse(raw);
      if (Array.isArray(parsedGallery)) {
        setCustomGalleryItems(parsedGallery);
      }
    } catch {
      // Ignore invalid local gallery data.
    }
  }, []);

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
      setOutputMeta(draft.outputMeta || defaultOutputMeta);
      setRevisionPrompt(draft.revisionPrompt || '');
      setChatMessages(Array.isArray(draft.chatMessages) ? draft.chatMessages : []);
      setChatInput(draft.chatInput || '');
      setGeneratedImage(draft.generatedImage || '');
      setFlyerTitle(draft.flyerTitle || '');
      setFlyerText(draft.flyerText || '');
      setFlyerStructure({ ...defaultFlyerStructure, ...(draft.flyerStructure || {}) });
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
      if (parsedSourceImage.dataUrl) {
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
      localStorage.setItem(customGalleryStorageKey, JSON.stringify(customGalleryItems));
    } catch {
      // Ignore localStorage write issues.
    }
  }, [customGalleryItems]);

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
          outputMeta,
          revisionPrompt,
          chatMessages,
          chatInput,
          generatedImage,
          flyerTitle,
          flyerText,
          flyerStructure,
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
    outputMeta,
    revisionPrompt,
    chatMessages,
    chatInput,
    generatedImage,
    flyerTitle,
    flyerText,
    flyerStructure,
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
  const selectedPainPoints = useMemo(
    () =>
      buildHintSection(
        selectedKnowledgeEntries,
        'painPoints',
        '- Nemáš žádné doplňkové pain points z databáze.'
      ),
    [selectedKnowledgeEntries]
  );
  const selectedBenefitClaims = useMemo(
    () =>
      buildHintSection(
        selectedKnowledgeEntries,
        'benefitClaims',
        '- Nemáš žádné doplňkové benefitové argumenty z databáze.'
      ),
    [selectedKnowledgeEntries]
  );
  const selectedProofPoints = useMemo(
    () =>
      buildHintSection(
        selectedKnowledgeEntries,
        'proofPoints',
        '- Nemáš žádné doplňkové důkazní body z databáze.'
      ),
    [selectedKnowledgeEntries]
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
  const selectedNegativeHints = useMemo(
    () =>
      buildHintSection(
        selectedKnowledgeEntries,
        'negativeHints',
        '- Nemáš žádná speciální varování z databáze.'
      ),
    [selectedKnowledgeEntries]
  );
  const selectedProducts = useMemo(
    () => buildProductSection(selectedKnowledgeEntries),
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
      if (navigator.clipboard.writeText) {
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
      setError('NepodaĹ™ilo se zkopĂ­rovat text do schrĂˇnky.');
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
      setError('IÄŚO musĂ­ mĂ­t 8 ÄŤĂ­slic.');
      setCompanyProfile(null);
      return null;
    }

    setCompanyLookupLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/company-by-ico/${normalizedIco}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'NepodaĹ™ilo se dohledat firmu podle IÄŚO.');
      }

      setCompanyProfile(data);
      return data;
    } catch (err) {
      setCompanyProfile(null);
      setError(err.message || 'NepodaĹ™ilo se dohledat firmu podle IÄŚO.');
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
              text: "ChytrĂˇ pÄ›na - NĂˇvrh pĹ™Ă­spÄ›vku",
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 300 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "TĂ©ma: ", bold: true }),
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
                new TextRun({ text: "CĂ­lovĂˇ skupina: ", bold: true }),
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
              text: "HlavnĂ­ text pĹ™Ă­spÄ›vku",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 150 },
            }),
            ...mainParagraphs,

            new Paragraph({
              text: "NĂˇvrh vizuĂˇlu",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 150 },
            }),
            new Paragraph({
              children: [new TextRun(parsed.visual || "Ĺ˝ĂˇdnĂ˝ vizuĂˇl navrĹľen.")],
              spacing: { after: 120 },
            }),

            new Paragraph({
              text: "Hashtagy",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 150 },
            }),
            new Paragraph({
              children: [new TextRun(parsed.hashtags || "Bez hashtagĹŻ.")],
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
      setError(`Chyba pĹ™i generovĂˇnĂ­ Word dokumentu: ${err.message}`);
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
        throw new Error('Canvas nenĂ­ k dispozici.');
      }

      context.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

      const outerPadding = Math.max(24, Math.round(canvas.width * 0.028));
      const badgeWidth = Math.max(240, Math.round(canvas.width * 0.24));
      const badgeHeight = Math.max(82, Math.round(canvas.height * 0.09));
      const positionMap = {
        'top-left': { x: outerPadding, y: outerPadding },
        'top-right': { x: canvas.width - badgeWidth - outerPadding, y: outerPadding },
        'bottom-left': { x: outerPadding, y: canvas.height - badgeHeight - outerPadding },
        'bottom-right': {
          x: canvas.width - badgeWidth - outerPadding,
          y: canvas.height - badgeHeight - outerPadding,
        },
      };
      const scoreArea = (x, y, width, height) => {
        const safeX = Math.max(0, Math.min(canvas.width - width, Math.round(x)));
        const safeY = Math.max(0, Math.min(canvas.height - height, Math.round(y)));
        const imageData = context.getImageData(safeX, safeY, Math.max(1, Math.round(width)), Math.max(1, Math.round(height))).data;
        let sum = 0;
        let sumSq = 0;

        for (let i = 0; i < imageData.length; i += 4) {
          const luminance = imageData[i] * 0.2126 + imageData[i + 1] * 0.7152 + imageData[i + 2] * 0.0722;
          sum += luminance;
          sumSq += luminance * luminance;
        }

        const count = imageData.length / 4 || 1;
        const mean = sum / count;
        const variance = Math.max(0, sumSq / count - mean * mean);
        const stdDev = Math.sqrt(variance);
        return stdDev;
      };

      const scoredPositions = Object.entries(positionMap).map(([key, value]) => ({
        key,
        ...value,
        score: scoreArea(value.x, value.y, badgeWidth, badgeHeight),
      }));

      const preferredPosition = scoredPositions.find((item) => item.key === logoPosition) || scoredPositions.find((item) => item.key === 'bottom-right');
      const quietestPosition = [...scoredPositions].sort((a, b) => a.score - b.score)[0];
      const resolvedPosition =
        preferredPosition && quietestPosition && preferredPosition.score > 52 && quietestPosition.score + 8 < preferredPosition.score
          ? quietestPosition
          : preferredPosition;
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
            reject(new Error('NepodaĹ™ilo se vytvoĹ™it vĂ˝slednĂ˝ obrĂˇzek.'));
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
      setError('ChybĂ­ API klĂ­ÄŤ. Zkontrolujte VITE_GEMINI_API_KEY v .env a restartujte dev server.');
      return null;
    }

    const useGlobalLoading = options.useGlobalLoading ?? true;

    if (useGlobalLoading) {
      setLoading(true);
    }
    setError('');

    const modelsToTry = options.modelsToTry || [primaryModel, fallbackModel];
    const maxAttempts = options.maxAttempts ?? 3;
    const initialRetryDelayMs = options.initialRetryDelayMs ?? 900;
    let lastError = 'NeznĂˇmĂˇ chyba';

    for (const currentModel of modelsToTry) {
      let delay = initialRetryDelayMs;

      for (let i = 0; i < maxAttempts; i += 1) {
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
                  topP: options.topP ?? 0.9,
                  ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
                  ...(options.expectJson ? { responseMimeType: 'application/json' } : {}),
                },
              }),
            }
          );

          const data = await response.json();

          if (!response.ok) {
            const apiMessage = data.error.message || `HTTP ${response.status}`;

            if (response.status === 503) {
              throw new Error(`Model ${currentModel} je momentĂˇlnÄ› pĹ™etĂ­ĹľenĂ˝.`);
            }

            if (response.status === 429) {
              throw new Error(`Model ${currentModel} narazil na limit poĹľadavkĹŻ.`);
            }

            throw new Error(apiMessage);
          }

          const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!resultText) {
            throw new Error(`Model ${currentModel} vrátil prázdnou odpověď.`);
          }

          if (useGlobalLoading) {
            setLoading(false);
          }
          return resultText;
        } catch (err) {
          lastError = err.message;

          const isLastAttemptForThisModel = i === maxAttempts - 1;
          if (!isLastAttemptForThisModel) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
          }
        }
      }
    }

    if (useGlobalLoading) {
      setLoading(false);
    }
    setError(`API chyba: ${lastError}`);
    return null;
  };

  const translateVisualPromptToCzech = async (visualPrompt) => {
    if (!visualPrompt.trim()) return '';

    const systemPrompt = `Jsi jazykovĂ˝ editor. TvĹŻj jedinĂ˝ Ăşkol je pĹ™evĂ©st zadanĂ˝ nĂˇvrh vizuĂˇlu do pĹ™irozenĂ© a struÄŤnĂ© ÄŤeĹˇtiny.

Pravidla:
- Zachovej vĂ˝znam, scĂ©nu i kompozici.
- NevymĂ˝Ĺˇlej novĂ© prvky.
- VraĹĄ pouze samotnĂ˝ ÄŤeskĂ˝ text bez uvozovek, bez markdownu a bez vysvÄ›tlenĂ­.
- VĂ˝sledek musĂ­ bĂ˝t vhodnĂ˝ jako zadĂˇnĂ­ pro generĂˇtor obrĂˇzku.`;

    const prompt = `PĹ™eveÄŹ do ÄŤeĹˇtiny tento nĂˇvrh vizuĂˇlu:

${visualPrompt}`;

    const translated = await generateWithGemini(prompt, systemPrompt, {
      temperature: 0.2,
    });

    return translated.trim() || visualPrompt;
  };

  const handleSuggestFlyerText = async () => {
    if (!parsed.main.trim()) return;

    setFlyerTextLoading(true);
    setError('');

    try {
      const systemPrompt = `Jsi seniorní reklamní copywriter a editor letáků pro značku Chytrá pěna.
Piš pouze česky.

Tvůj úkol:
- vytvořit nebo výrazně vylepšit text letáku tak, aby byl poutavější, obchodně silnější a lépe čitelný
- zachovat důvěryhodnost, praktičnost a relevanci k cílové skupině
- vrátit pouze čistý JSON bez markdownu a bez vysvětlení

Vrať přesně tuto strukturu:
{
  "headline": "krátký benefitový nadpis",
  "subheadline": "1 krátká vysvětlující věta",
  "benefits": ["bod 1", "bod 2", "bod 3"],
  "proof": "krátký důvěryhodný důkaz nebo argument",
  "cta": "krátká výzva k akci"
}

Pravidla:
- headline musí být výrazně benefitový, ne generický
- subheadline má rychle vysvětlit hlavní přínos
- benefits vrať přesně 3, krátké a dobře skenovatelné
- proof má dodat důvěryhodnost, ale bez přehánění
- cta má být krátké, konkrétní a akční
- text letáku musí být kratší, údernější a poutavější než běžný příspěvek
- nepiš odstavce jako článek
- nepoužívej hashtagy
- nevracej žádné další klíče`;

      const prompt = `Úkol:
Významně vylepši text letáku pro lepší marketingový dopad. Nestačí lehká parafráze. Výstup má být čitelnější, víc benefitový a vhodný pro leták.

Hlavní text příspěvku:
${parsed.main}

Aktuální nadpis letáku:
${flyerTitle || '-'}

Aktuální text letáku:
${flyerText || '-'}

Platforma:
${platform}

Cílová skupina:
${targetAudience}

CTA:
${cta}

Pain points:
${selectedPainPoints}

Benefity:
${selectedBenefitClaims}

Důkazní body:
${selectedProofPoints}

Produktové vazby:
${selectedProducts}

Čemu se vyhnout:
${selectedNegativeHints}

Kontakty firmy:
Web: ${companyContact.web}
Telefon: ${companyContact.phone}

Požadavek:
- headline nesmí být generický
- výstup musí být výrazně lepší než aktuální verze
- pokud je aktuální verze slabá, klidně ji kompletně přepracuj`;

      const response = await fetch('/api/flyer-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt,
          prompt,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Nepodařilo se přegenerovat text letáku.');
      }

      const structuredFlyer = normalizeFlyerPayload(payload, cta);
      setFlyerStructure(structuredFlyer);
      setFlyerTitle(structuredFlyer.headline);
      setFlyerText(buildFlyerEditableText(structuredFlyer));
      setOutputMeta((current) => ({
        ...current,
        chat: {
          provider: payload.provider || 'OpenAI GPT',
          model: payload.model || current.chat.model || 'gpt-4.1-mini',
        },
      }));
    } finally {
      setFlyerTextLoading(false);
    }
  };

  const handleSuggestVisualPrompt = async () => {
    const currentVisualPrompt = (parsed.visual || contentPrompt || '').trim();

    if (!currentVisualPrompt) {
      setImageError('Nejdřív je potřeba mít text doporučeného vizuálu nebo vyplněné téma.');
      return;
    }

    setVisualSuggestionLoading(true);
    setImageError('');

    try {
      const visualBrief = buildVisualBrief({
        visualPrompt: currentVisualPrompt,
        platform,
        targetAudience,
        imageMode,
        companyProfile,
        selectedVisualHints,
        selectedProducts,
        selectedProofPoints,
        selectedPainPoints,
        selectedNegativeHints,
      });

      const systemPrompt = `Jsi seniorní creative director a reklamní editor vizuálních zadání pro značku Chytrá pěna.
Piš pouze česky.

Tvůj úkol:
- navrhnout jinou, výrazně odlišnou a marketingově silnou variantu textu pro generování vizuálu
- zachovat realističnost, důvěryhodnost a relevanci k cílové skupině
- vrátit pouze čistý JSON bez markdownu a bez vysvětlení

Vrať přesně tuto strukturu:
{
  "visualPrompt": "nové stručné zadání vizuálu"
}

Pravidla:
- navrhni jiný úhel pohledu nebo jinou kompozici než v aktuální verzi
- zachovej realistickou fotografickou logiku, ne ilustraci a ne 3D render
- vizuál musí být vhodný pro sociální sítě a leták
- bez textu v obraze, bez loga, bez watermarku, bez ikon, bez čísel
- výstup musí být stručný, konkrétní a přímo použitelný pro generátor obrázku`;

      const prompt = `Úkol:
Navrhni jinou variantu textu doporučeného vizuálu.

Aktuální návrh vizuálu:
${currentVisualPrompt}

Hlavní text příspěvku:
${parsed.main || '-'}

Marketingový a vizuální brief:
${visualBrief}

Požadavek:
- výsledek musí být jiný než aktuální verze
- nesmí obsahovat text v obraze
- musí zůstat realistický a důvěryhodný
- vrať jen JSON`;

      const response = await fetch('/api/visual-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt,
          prompt,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Nepodařilo se přegenerovat text vizuálu.');
      }

      const nextVisualPrompt =
        typeof payload?.visualPrompt === 'string' ? payload.visualPrompt.trim() : '';

      if (!nextVisualPrompt) {
        throw new Error('GPT nevrátil nový text vizuálu.');
      }

      const visualChanged = nextVisualPrompt !== currentVisualPrompt;
      handleVisualPromptChange(nextVisualPrompt);
      setOutputMeta((current) => ({
        ...current,
        chat: {
          provider: payload.provider || 'OpenAI GPT',
          model: payload.model || current.chat.model || 'gpt-4.1-mini',
        },
      }));

      if (visualChanged) {
        setGeneratedImage('');
        setFlyerImage('');
        setImageError('');
      }
    } catch (err) {
      setImageError(err.message || 'Nepodařilo se přegenerovat text vizuálu.');
    } finally {
      setVisualSuggestionLoading(false);
    }
  };

  const handleGenerateFlyer = async () => {
    if (!generatedImage) {
      setError('Nejdřív je potřeba mít vygenerovaný obrázek.');
      return;
    }

    const flyerHeading = flyerTitle.trim() || flyerStructure.headline || contentPrompt.trim() || 'Chytrá pěna';
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
      const flyerParts = splitFlyerCopy(flyerCopy, cta);
      const flyerSubheadline = flyerStructure.subheadline || flyerParts.intro || flyerCopy;
      const benefitItems = flyerStructure.benefits.length ? flyerStructure.benefits : flyerParts.bullets.length ? flyerParts.bullets : [flyerCopy];
      const proofText = flyerStructure.proof || '';
      const ctaText = flyerStructure.cta || flyerParts.cta || cta;

      if (flyerTemplate === 'classic') {
        drawRoundedRect(context, 42, 42, canvas.width - 84, canvas.height - 84, 42, '#eef3df', '#cad5b7', 3);
        drawRoundedRect(context, 70, 70, canvas.width - 140, 122, 30, '#79aa0a');
        context.textAlign = 'right';
        context.fillStyle = '#ffffff';
        context.font = '800 44px "Segoe UI", Arial, sans-serif';
        context.fillText(flyerHeading, canvas.width - 100, 128);
        context.font = '500 24px "Segoe UI", Arial, sans-serif';
        context.fillText('Chytrá pěna Bohemia s.r.o.', canvas.width - 100, 166);

        const heroX = 70;
        const heroY = 228;
        const heroWidth = canvas.width - 140;
        const heroHeight = 560;
        drawRoundedRect(context, heroX, heroY, heroWidth, heroHeight, 34, '#ffffff');
        drawImageCover(context, heroImage, heroX, heroY, heroWidth, heroHeight, 0.5, 0.4);
        drawRoundedRect(context, heroX + 38, heroY + 34, 420, 176, 28, 'rgba(15,23,42,0.74)');
        context.textAlign = 'left';
        context.fillStyle = '#ffffff';
        context.font = '800 50px "Segoe UI", Arial, sans-serif';
        let currentY = drawWrappedCanvasText(context, flyerHeading, heroX + 72, heroY + 98, 350, 58);
        context.fillStyle = '#dbeafe';
        context.font = '600 24px "Segoe UI", Arial, sans-serif';
        drawWrappedCanvasText(context, flyerSubheadline, heroX + 72, currentY + 10, 324, 32);

        drawRoundedRect(context, 90, 748, canvas.width - 180, 460, 34, '#ffffff', '#d5dcc8', 2);
        context.fillStyle = '#79aa0a';
        context.font = '700 24px "Segoe UI", Arial, sans-serif';
        context.fillText('Proč to řešit právě teď', 130, 810);
        currentY = drawFlyerBulletCards(context, benefitItems, 120, 840, canvas.width - 240, {
          accent: '#79aa0a',
          cardFill: '#f8fbf1',
          cardStroke: '#dce4cf',
          maxItems: 3,
        });

        if (proofText) {
          drawRoundedRect(context, 120, currentY + 6, canvas.width - 240, 96, 26, '#eff6e2', '#dce4cf', 2);
          context.fillStyle = '#365314';
          context.font = '700 22px "Segoe UI", Arial, sans-serif';
          drawWrappedCanvasText(context, proofText, 150, currentY + 42, canvas.width - 300, 28);
          currentY += 114;
        }

        drawFlyerCtaBand(context, ctaText, 120, currentY + 8, canvas.width - 240, '#79aa0a');

        drawRoundedRect(context, 120, 1446, canvas.width - 240, 164, 28, '#132033');
        context.fillStyle = '#ffffff';
        context.font = '700 24px "Segoe UI", Arial, sans-serif';
        context.fillText('Kontaktujte nás', 154, 1506);
        context.font = '600 22px "Segoe UI", Arial, sans-serif';
        context.fillStyle = '#d5e2f0';
        context.fillText(`Telefon: ${companyContact.phone}`, 154, 1556);
        context.fillText(`Web: ${companyContact.web}`, 154, 1594);

        const footerLogoWidth = 220;
        const footerLogoHeight =
          (logoImage.naturalHeight / logoImage.naturalWidth) * footerLogoWidth;
        context.drawImage(
          logoImage,
          canvas.width - 154 - footerLogoWidth,
          1512,
          footerLogoWidth,
          footerLogoHeight
        );
      } else if (flyerTemplate === 'split') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        drawRoundedRect(context, 44, 44, canvas.width - 88, canvas.height - 88, 40, '#ffffff', '#dbe3cd', 3);
        context.fillStyle = '#79aa0a';
        context.fillRect(0, 0, canvas.width, 124);
        drawImageCover(context, heroImage, 70, 124, 560, canvas.height - 194, 0.45, 0.5);
        context.drawImage(logoImage, 74, 24, logoWidth, logoHeight);

        context.fillStyle = '#f8fafc';
        context.fillRect(650, 124, 520, canvas.height - 194);

        let currentY = 220;
        const textX = 708;
        const textWidth = 404;
        context.fillStyle = '#14213d';
        context.font = '800 50px "Segoe UI", Arial, sans-serif';
        currentY = drawWrappedCanvasText(context, flyerHeading, textX, currentY, textWidth, 58);
        context.fillStyle = '#4b5563';
        context.font = '600 24px "Segoe UI", Arial, sans-serif';
        currentY = drawWrappedCanvasText(context, flyerSubheadline, textX, currentY + 22, textWidth, 34);
        currentY += 24;
        currentY = drawFlyerBulletCards(context, benefitItems, textX, currentY, textWidth, {
          accent: '#79aa0a',
          cardFill: '#ffffff',
          cardStroke: '#dde5d1',
          maxItems: 3,
        });
        if (proofText) {
          drawRoundedRect(context, textX, currentY + 8, textWidth, 94, 24, '#edf4de', '#dbe3cd', 2);
          context.fillStyle = '#365314';
          context.font = '700 21px "Segoe UI", Arial, sans-serif';
          drawWrappedCanvasText(context, proofText, textX + 24, currentY + 42, textWidth - 48, 27);
          currentY += 114;
        }
        drawFlyerCtaBand(context, ctaText, textX, currentY + 10, textWidth, '#79aa0a');

        drawRoundedRect(context, textX, 1450, textWidth, 170, 28, '#eef4df', '#dce4cf', 2);
        context.fillStyle = '#0f172a';
        context.font = '700 24px "Segoe UI", Arial, sans-serif';
        context.fillText(companyContact.phone, textX + 28, 1514);
        context.font = '600 21px "Segoe UI", Arial, sans-serif';
        context.fillStyle = '#475569';
        context.fillText(companyContact.web, textX + 28, 1552);
      } else {
        context.fillStyle = '#eef4df';
        context.fillRect(0, 0, canvas.width, canvas.height);
        drawRoundedRect(context, 50, 50, canvas.width - 100, canvas.height - 100, 40, '#edf4de', '#ced9bd', 3);
        context.fillStyle = '#79aa0a';
        context.fillRect(70, 70, canvas.width - 140, 180);
        context.fillStyle = '#ffffff';
        context.textAlign = 'right';
        context.font = '800 42px "Segoe UI", Arial, sans-serif';
        context.fillText(flyerHeading, canvas.width - 110, 145);
        context.font = '500 24px "Segoe UI", Arial, sans-serif';
        context.fillText('Chytrá pěna Bohemia s.r.o.', canvas.width - 110, 188);

        drawImageCover(context, heroImage, 70, 300, canvas.width - 140, 470, 0.5, 0.4);
        context.strokeStyle = '#c8d5b2';
        context.lineWidth = 3;
        context.strokeRect(70, 300, canvas.width - 140, 470);

        drawRoundedRect(context, 740, 330, 400, 118, 26, 'rgba(255,255,255,0.92)');
        context.textAlign = 'left';
        context.fillStyle = '#14213d';
        context.font = '700 26px "Segoe UI", Arial, sans-serif';
        context.fillText('Proč se ozvat právě teď', 770, 382);
        context.fillStyle = '#475569';
        context.font = '600 18px "Segoe UI", Arial, sans-serif';
        drawWrappedCanvasText(context, flyerSubheadline, 770, 414, 340, 24);

        let currentY = 842;
        const textX = 100;
        const textWidth = canvas.width - 200;
        context.textAlign = 'left';
        context.fillStyle = '#14213d';
        context.font = '800 44px "Segoe UI", Arial, sans-serif';
        currentY = drawWrappedCanvasText(context, flyerHeading, textX, currentY, textWidth, 52);
        currentY += 22;
        currentY = drawFlyerBulletCards(context, benefitItems, textX, currentY, textWidth, {
          accent: '#79aa0a',
          cardFill: '#ffffff',
          cardStroke: '#d5dcc8',
          maxItems: 3,
        });
        if (proofText) {
          drawRoundedRect(context, textX, currentY + 8, textWidth, 96, 24, '#f9fbf4', '#d5dcc8', 2);
          context.fillStyle = '#365314';
          context.font = '700 22px "Segoe UI", Arial, sans-serif';
          drawWrappedCanvasText(context, proofText, textX + 24, currentY + 42, textWidth - 48, 28);
          currentY += 116;
        }
        drawFlyerCtaBand(context, ctaText, textX, currentY + 8, textWidth, '#79aa0a');

        drawRoundedRect(context, 70, 1470, canvas.width - 140, 144, 26, '#ffffff', '#d5dcc8', 2);
        context.fillStyle = '#0f172a';
        context.font = '700 24px "Segoe UI", Arial, sans-serif';
        context.fillText(`Telefon: ${companyContact.phone}`, 110, 1532);
        context.fillText(`Web: ${companyContact.web}`, 110, 1570);

        const footerLogoWidth = 220;
        const footerLogoHeight =
          (logoImage.naturalHeight / logoImage.naturalWidth) * footerLogoWidth;
        context.drawImage(
          logoImage,
          canvas.width - 110 - footerLogoWidth,
          1498,
          footerLogoWidth,
          footerLogoHeight
        );
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
      const visualBrief = buildVisualBrief({
        visualPrompt,
        platform,
        targetAudience,
        imageMode,
        companyProfile,
        selectedVisualHints,
        selectedProducts,
        selectedProofPoints,
        selectedPainPoints,
        selectedNegativeHints,
      });

      const endpoint = imageMode === 'edit' ? '/api/edit-image' : '/api/generate-image';
      const requestBody =
        imageMode === 'edit'
          ? {
              imageDataUrl: sourceImageDataUrl,
              fileName: sourceImageName || 'firemni-fotka.png',
              prompt: `Uprav přiloženou reálnou fotografii pro marketingový vizuál značky Chytrá pěna.

Zachovej skutečnou scénu, konstrukci, proporce a věrohodnost.
Nevytvářej ilustraci ani render. Výsledek musí působit jako reálná profesionální fotografie.

MARKETINGOVÝ A VIZUÁLNÍ BRIEF:
${visualBrief}

POVINNÁ PRAVIDLA:
- zvýrazni hlavní objekt a odstraň vizuální chaos
- zlepši světlo, lokální kontrast, barevnost a čistotu kompozice
- vizuál má působit důvěryhodně, profesionálně a relevantně pro zadané publikum
- pokud je relevantní, ukaž detail kvalitního provedení izolace nebo konstrukce
- ponech přirozený prostor pro pozdější umístění loga nebo titulku
- obrázek nesmí obsahovat žádný čitelný text nikde v obraze
- bez textu v obrázku, bez nápisů, bez titulků, bez loga, bez watermarku, bez ikon, bez písmen, bez slov a bez čísel`,
            }
          : {
              prompt: `Vytvoř realistický marketingový vizuál pro značku Chytrá pěna.

Výstup musí působit jako skutečná profesionální fotografie vhodná pro sociální sítě a leták.
Ne ilustrace, ne 3D render, ne stockově přehnaná scéna.

MARKETINGOVÝ A VIZUÁLNÍ BRIEF:
${visualBrief}

POVINNÁ PRAVIDLA:
- jeden jasný hlavní motiv
- čistá profesionální kompozice
- realistické světlo a materiály
- důvěryhodné české prostředí, pokud dává smysl
- vizuál má odpovídat typu objektu a cílové skupině
- obrázek nesmí obsahovat žádný čitelný text nikde v obraze
- bez textu v obrázku, bez nápisů, bez titulků, bez loga, bez watermarku, bez ikon, bez písmen, bez slov a bez čísel`,
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
      setImageError(`ObrĂˇzek se nepodaĹ™ilo vytvoĹ™it: ${err.message}`);
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
    setOutputMeta(item.outputMeta || defaultOutputMeta);
    setRevisionPrompt('');
    setChatMessages([]);
    setChatInput('');
    setGeneratedImage('');
    setFlyerTitle(item.flyerTitle || '');
    setFlyerText(item.flyerText || '');
    setFlyerStructure({ ...defaultFlyerStructure, ...(item.flyerStructure || {}) });
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

    const contentMode = resolvedCompanyProfile?.name ? 'personalized-company-offer' : 'social-post';
    const resolvedContactLabel =
      resolvedCompanyProfile?.recommendedContact?.label || 'vedení společnosti';

    const companyPromptBlock = resolvedCompanyProfile?.name
      ? `Přímé cílení na konkrétní firmu:
- IČO: ${resolvedCompanyProfile.ico}
- Název firmy: ${resolvedCompanyProfile.name}
- Právní forma: ${resolvedCompanyProfile.legalForm || 'neuvedeno'}
- Obor / NACE: ${resolvedCompanyProfile.industry || 'neuvedeno'}
- Sídlo: ${resolvedCompanyProfile.address || 'neuvedeno'}
- Doporučená role k oslovení: ${resolvedContactLabel}

Speciální režim psaní:
- Nejde o obecný post pro široké publikum.
- Piš text tak, jako by firma Chytrá pěna oslovovala přímo tuto konkrétní firmu s nabídkou služeb.
- Zaměř se na potřeby firmy, provoz, správu objektu, úspory, komfort nebo efektivitu podle tématu a typu organizace.
- Text má působit jako personalizovaná nabídka nebo obchodní oslovení, ne jako obecná reklama.
- Přirozeně můžeš použít formulace typu "pro váš objekt", "ve vašem provozu", "pro správu budovy", "pro vaši organizaci", pokud to dává smysl.
- Nevymýšlej si konkrétní interní problémy firmy, pouze rozumně odvozuj možné potřeby z názvu nebo oboru, pokud jsou zřejmé.`
      : `Přímé cílení na konkrétní firmu:
- ne`;

    const systemPrompt = `Jsi seniorní copywriter pro značku Chytrá pěna Bohemia s.r.o.
Piš pouze česky.

HLAVNÍ PRIORITY (od nejdůležitější):
1. Faktická opatrnost a důvěryhodnost
2. Relevance k tématu, cílové skupině a platformě
3. Praktická užitečnost a srozumitelnost
4. Přesvědčivost bez přehánění
5. Přesné dodržení JSON formátu

CO MÁŠ VYTVOŘIT:
- Pokud je zadaná konkrétní firma: personalizované obchodní oslovení / nabídku služeb.
- Pokud firma zadaná není: marketingový příspěvek pro sociální sítě.

KONTEXT ZNAČKY:
${useBrandContext ? brandContext : '- Používej pouze informace ze zadání.'}

ZNALOSTNÍ DATABÁZE:
${buildKnowledgeContext(selectedKnowledgeEntries)}

MARKETINGOVÝ BRIEFING PRO CÍLOVOU SKUPINU:
${audienceBriefs[targetAudience] || ''}

PRAVIDLA PRO PLATFORMU:
${platformBriefs[platform] || ''}

FIREMNÍ CÍLENÍ PODLE IČO:
${companyPromptBlock}

HLAVNÍ PAIN POINTS:
${selectedPainPoints}

DOPORUČENÉ BENEFITOVÉ ARGUMENTY:
${selectedBenefitClaims}

DŮKAZNÍ BODY:
${selectedProofPoints}

PRODUKTOVÉ VAZBY:
${selectedProducts}

TÓNOVÁ VODÍTKA:
${selectedToneHints}

VODÍTKA PRO CTA:
${selectedCtaHints}

VODÍTKA PRO VIZUÁL:
${selectedVisualHints}

ČEMU SE VYHNOUT:
${selectedNegativeHints}

PŘÍKLAD SMĚRU PSANÍ:
${resolvedCompanyProfile?.name ? messagingExamples.company : messagingExamples.social}

PARAMETRY VÝSTUPU:
- Režim: ${contentMode}
- Platforma: ${platform}
- Tón: ${tone}
- Cílová skupina: ${targetAudience}
- Délka: ${postLength}
- CTA: ${cta}
- Návrh vizuálu: ${includeVisual ? 'ano' : 'ne'}
- Hashtagy: ${includeHashtags ? 'ano' : 'ne'}
- ${includeEmojis ? 'Emoji můžeš použít střídmě a jen pokud se hodí k platformě.' : 'Nepoužívej emoji.'}
- ${strictClaims ? 'Drž se pouze ověřených tvrzení.' : 'Můžeš psát kreativněji, ale stále relevantně.'}

OBECNÁ PRAVIDLA:
- Používej jen informace ze zadání a z poskytnutého kontextu.
- Pokud si nejsi jistý faktem, nepřidávej ho. Nahraď ho opatrnou formulací.
- Nevymýšlej čísla, garance, srovnání, technické sliby ani interní problémy klienta.
- Nepoužívej prázdné reklamní fráze.
- Neopakuj jednu myšlenku více způsoby.
- Piš konkrétně, stručně a přirozeně.
- CTA má být přirozené, ne agresivní.

PRAVIDLA PRO HLAVNÍ TEXT:
- "mainText" musí začínat krátkým nadpisem na samostatném prvním řádku.
- Začni nadpisem a následně silným háčkem nebo přesným pojmenováním problému.
- Pak ukaž praktický dopad problému.
- Poté nabídni řešení a vysvětli jeho přínos.
- Nakonec uzavři text jasnou, přirozenou výzvou k akci.
- Zachovej strukturu: háček -> problém/důsledek -> řešení/přínos -> důvěryhodnost -> CTA.
- Text musí odpovídat zadané délce.

PRAVIDLA PRO DÉLKU:
- Krátký: 60 až 90 slov
- Střední: 120 až 180 slov
- Dlouhý: 180 až 260 slov

PRAVIDLA PRO FIREMNÍ OSLOVENÍ:
- Piš profesionálně, věcně a konkrétně.
- Vycházej jen z názvu firmy, oboru a role k oslovení.
- Nepředstírej znalost interní situace firmy.
- Nepředpokládej konkrétní typ budovy, technologie ani problém firmy, pokud to nevyplývá z dat.
- Přínosy formuluj vzhledem k provozu, správě objektu, nákladům nebo komfortu, jen pokud to dává smysl.

PRAVIDLA PRO VIZUÁL:
- Pokud je vyžadován, napiš stručné zadání pro realistický marketingový vizuál.
- "visualPrompt" musí být napsaný česky.
- Bez textu v obrázku, bez titulků, bez loga, bez watermarku.

PRAVIDLA PRO HASHTAGY:
- Pokud jsou vyžadovány, vrať přesně 5 relevantních hashtagů.
- Hashtagy mají být přirozené, čitelné a tematicky relevantní.

VRAŤ POUZE ČISTÝ JSON:
{
  "mainText": "finální text",
  "visualPrompt": "stručné zadání vizuálu",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "flyer": {
    "headline": "krátký benefitový nadpis",
    "subheadline": "1 krátká vysvětlující věta",
    "benefits": ["bod 1", "bod 2", "bod 3"],
    "proof": "krátký důvěryhodný důkaz nebo argument",
    "cta": "krátká výzva k akci"
  }
}

PRAVIDLA PRO JSON:
- "mainText" je vždy povinný neprázdný string.
- Pokud není vizuál požadován, vrať "visualPrompt": "".
- Pokud hashtagy nejsou požadovány, vrať "hashtags": [].
- Pokud jsou hashtagy požadovány, vrať pole přesně 5 hashtagů.
- "flyer" vrať vždy jako vyplněný objekt pro letákovou verzi stejného sdělení.
- Letáková verze musí být kratší, údernější a víc benefitová než hlavní text.
- Nevkládej žádné další klíče.`;

    const prompt = `TYP VÝSTUPU:
${resolvedCompanyProfile?.name ? 'personalizované obchodní oslovení' : 'příspěvek na sociální sítě'}

TÉMA:
${contentPrompt}

PARAMETRY:
- Platforma: ${platform}
- Tón: ${tone}
- Cílová skupina: ${targetAudience}
- Délka: ${postLength}
- CTA: ${cta}
- Emoji: ${includeEmojis ? 'ano, střídmě' : 'ne'}
- Návrh vizuálu: ${includeVisual ? 'ano' : 'ne'}
- Hashtagy: ${includeHashtags ? 'ano' : 'ne'}
- Pouze ověřená tvrzení: ${strictClaims ? 'ano' : 'ne'}

PRAVIDLA DÉLKY:
- Krátký: 60 až 90 slov
- Střední: 120 až 180 slov
- Dlouhý: 180 až 260 slov

KONTEXT ZNAČKY:
${useBrandContext ? brandContext : '- Používej pouze informace ze zadání.'}

ZNALOSTNÍ DATABÁZE:
${buildKnowledgeContext(selectedKnowledgeEntries)}

BRIEFING PRO CÍLOVKU:
${audienceBriefs[targetAudience] || '-'}

PRAVIDLA PLATFORMY:
${platformBriefs[platform] || '-'}

FIREMNÍ CÍLENÍ:
${companyPromptBlock}

PAIN POINTS:
${selectedPainPoints}

BENEFITY:
${selectedBenefitClaims}

DŮKAZNÍ BODY:
${selectedProofPoints}

PRODUKTOVÉ VAZBY:
${selectedProducts}

TÓNOVÁ VODÍTKA:
${selectedToneHints}

VODÍTKA PRO CTA:
${selectedCtaHints}

VODÍTKA PRO VIZUÁL:
${selectedVisualHints}

ČEMU SE VYHNOUT:
${selectedNegativeHints}

SMĚR PSANÍ:
${resolvedCompanyProfile?.name ? messagingExamples.company : messagingExamples.social}

DŮLEŽITÉ:
- Závěr textu má přirozeně směřovat k CTA: "${cta}".
- Pokud chybí jistota, preferuj opatrnější formulaci.
- Nepředpokládej konkrétní problém, budovu ani technologii firmy, pokud to nevyplývá z dat.
- Současně připrav i samostatnou, kratší a poutavější verzi pro leták.
- Nevysvětluj postup.
- Vrať jen JSON.`;

    const result = await generateWithGemini(prompt, systemPrompt, {
      expectJson: true,
      temperature: 0.45,
      modelsToTry: [contentPrimaryModel, contentFallbackModel],
    });
    if (result) {
      const rawPayload = extractJsonPayload(result);
      const structuredPayload =
        normalizeGeneratedPayload(rawPayload) ||
        normalizeGeneratedPayload(parseGeneratedContent(result)) || {
          main: result.trim(),
          visual: '',
          hashtags: '',
        };
      const nextFlyerStructure = rawPayload
        ? normalizeFlyerPayload(rawPayload, cta)
        : normalizeFlyerPayload({}, cta);

      if (includeVisual && looksLikeEnglishVisual(structuredPayload.visual)) {
        structuredPayload.visual = await translateVisualPromptToCzech(structuredPayload.visual);
      }

      const serializedContent = serializeGeneratedContent(structuredPayload);
      setGeneratedContent(serializedContent);
      setOutputMeta((current) => ({
        ...current,
        content: {
          provider: 'Google Gemini',
          model: contentPrimaryModel,
        },
      }));
      setRevisionPrompt('');
      setChatMessages([
        {
          id: `${Date.now()}-assistant-welcome`,
          role: 'assistant',
          content: 'Výstup je hotový. Klidně mi napiš, co chceš upravit, zkrátit nebo vysvětlit.',
        },
      ]);
      setChatInput('');
      setGeneratedImage('');
      setFlyerTitle(nextFlyerStructure.headline || structuredPayload.main.split('\n')[0] || '');
      setFlyerText(buildFlyerEditableText(nextFlyerStructure));
      setFlyerStructure(nextFlyerStructure);
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
          flyerTitle: nextFlyerStructure.headline || structuredPayload.main.split('\n')[0] || '',
          flyerText: buildFlyerEditableText(nextFlyerStructure),
          flyerStructure: nextFlyerStructure,
          outputMeta: {
            ...defaultOutputMeta,
            content: {
              provider: 'Google Gemini',
              model: contentPrimaryModel,
            },
          },
        },
        ...current,
      ]);
    }
  };

  const handleReviseContent = async () => {
    if (!generatedContent.trim() || !revisionPrompt.trim()) return;

    let resolvedCompanyProfile = companyProfile;
    if (normalizedCompanyIco && !resolvedCompanyProfile?.name) {
      resolvedCompanyProfile = await lookupCompanyByIco(normalizedCompanyIco);
      if (!resolvedCompanyProfile) {
        return;
      }
    }

    setRevisionLoading(true);
    setError('');

    try {
      const systemPrompt = `Jsi seniorní copywriter a editor pro značku Chytrá pěna.
Piš pouze česky.

Tvůj úkol:
- výrazně vylepšit hlavní text podle pokynu uživatele
- pokud uživatel nepožaduje změnu vizuálu nebo hashtagů, zachovej je
- vrátit pouze čistý JSON bez markdownu a bez vysvětlení

Kontext značky:
${useBrandContext ? compactBrandContext : '- Používej pouze informace ze zadání.'}

Znalostní databáze:
${buildCompactKnowledgeContext(selectedKnowledgeEntries)}

Marketingový briefing pro cílovou skupinu:
${audienceBriefs[targetAudience] || ''}

Pravidla pro platformu:
${platformBriefs[platform] || ''}

Hlavní pain points:
${selectedPainPoints}

Doporučené benefitové argumenty:
${selectedBenefitClaims}

Důkazní body:
${selectedProofPoints}

Produktové vazby:
${selectedProducts}

Čemu se vyhnout:
${selectedNegativeHints}

Parametry:
- Platforma: ${platform}
- Tón: ${tone}
- Cílová skupina: ${targetAudience}
- Délka: ${postLength}
- CTA: ${cta}
- Přímé cílení na firmu: ${resolvedCompanyProfile?.name ? 'ano' : 'ne'}
${resolvedCompanyProfile?.name ? `- Název firmy: ${resolvedCompanyProfile.name}
- Doporučená role k oslovení: ${resolvedCompanyProfile?.recommendedContact?.label || 'vedení společnosti'}` : ''}

Pravidla:
- Hlavní priorita je vylepšit hlavní text.
- Pokud uživatel výslovně nezmiňuje vizuál nebo hashtagy, zachovej je beze změny.
- Udělej text čitelnější, přesvědčivější a praktičtější.
- Zachovej důvěryhodnost a nepřeháněj.
- ${strictClaims ? 'Drž se pouze ověřených tvrzení.' : 'Můžeš psát kreativněji, ale stále relevantně.'}
- ${includeEmojis ? 'Emoji používej střídmě a jen pokud to dává smysl.' : 'Nepoužívej emoji.'}

Vrať přesně tuto strukturu:
{
  "reply": "stručné potvrzení, co jsi zlepšil",
  "applyChanges": true,
  "updatedMainText": "nový hlavní text",
  "updatedVisualPrompt": "zachovaný nebo změněný vizuál",
  "updatedHashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}`;

      const prompt = `Původní zadání:
${contentPrompt}

Dodatečný pokyn k úpravě:
${revisionPrompt}

Aktuální hlavní text:
${parsed.main || '-'}

Aktuální návrh vizuálu:
${parsed.visual || '-'}

Aktuální hashtagy:
${parsed.hashtags || '-'}

Uprav výstup podle dodatečného pokynu uživatele a opravdu proveď změnu hlavního textu.`;

      const response = await fetch('/api/chat-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt,
          prompt,
          currentMainText: parsed.main,
          currentVisualPrompt: parsed.visual,
          currentHashtags: parsed.hashtags,
          currentFlyerTitle: flyerTitle,
          currentFlyerText: flyerText,
          userExplicitlyRequestsEdit: true,
          chatMode: 'edit',
          userRequestsHeading: /\b(nadpis|titulek|headline)\b/i.test(revisionPrompt),
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Nepodařilo se vylepšit hlavní text.');
      }

      if (!payload?.applyChanges || !payload?.updatedMainText?.trim()) {
        throw new Error('GPT zatím nevrátil skutečně upravený hlavní text.');
      }

      const nextVisualPrompt =
        includeVisual
          ? typeof payload.updatedVisualPrompt === 'string'
            ? payload.updatedVisualPrompt.trim()
            : parsed.visual
          : '';
      const nextHashtags =
        includeHashtags && Array.isArray(payload.updatedHashtags)
          ? payload.updatedHashtags.filter(Boolean).join(' ')
          : includeHashtags
            ? parsed.hashtags
            : '';

      const structuredPayload = {
        main: payload.updatedMainText.trim(),
        visual: nextVisualPrompt,
        hashtags: nextHashtags,
      };

      if (includeVisual && looksLikeEnglishVisual(structuredPayload.visual)) {
        structuredPayload.visual = await translateVisualPromptToCzech(structuredPayload.visual);
      }

      const previousVisual = parsed.visual || '';
      const nextSerializedContent = serializeGeneratedContent(structuredPayload);
      const visualActuallyChanged = structuredPayload.visual.trim() !== previousVisual.trim();

      setGeneratedContent(nextSerializedContent);
      setOutputMeta((current) => ({
        ...current,
        chat: {
          provider: payload.provider || 'OpenAI GPT',
          model: payload.model || current.chat.model || 'gpt-4.1-mini',
        },
      }));
      setRevisionPrompt('');
      if (visualActuallyChanged) {
        setGeneratedImage('');
        setFlyerImage('');
        setImageError('');
      }
      setFlyerStructure(defaultFlyerStructure);
    } finally {
      setRevisionLoading(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!generatedContent.trim() || !chatInput.trim()) return;

    let resolvedCompanyProfile = companyProfile;
    if (normalizedCompanyIco && !resolvedCompanyProfile?.name) {
      resolvedCompanyProfile = await lookupCompanyByIco(normalizedCompanyIco);
      if (!resolvedCompanyProfile) {
        return;
      }
    }

    const userMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: chatInput.trim(),
    };

    const normalizedUserMessage = userMessage.content.trim().toLowerCase();
    const explicitEditIntentPattern =
      /\b(uprav|upravit|přepiš|prepis|přeformuluj|zreviduj|zkr[aá]t|prodluž|rozšiř|dop[lňn]|zm[eě]ň|předělej|pouprav|proveď|proved|zapracuj|přidej|pridej|odeber|udělej|uprav to|přepiš to|rozpracuj|zjednoduš|zpřesni|zvyrazni|zvýrazni|přitvrď|zjemni)\b/i;
    const advisoryIntentPattern =
      /\b(navrhni|doporuč|doporučení|co bys zlepšil|co zlepšit|vylepšení|zhodnoť|okomentuj|posuď|názor)\b/i;
    const questionLikePattern =
      /\?|\b(proč|jak|co|můžeš vysvětlit|vysvětli mi|jaký je tvůj názor|co myslíš)\b/i;
    const contentInstructionPattern =
      /\b(text|článek|clanek|příspěvek|prispevek|nadpis|titulek|cta|úvod|uvod|závěr|zaver|odstavec|hashtagy|vizuál|vizual)\b/i;

    const userExplicitlyRequestsEdit =
      explicitEditIntentPattern.test(userMessage.content) ||
      (!questionLikePattern.test(userMessage.content) &&
        contentInstructionPattern.test(userMessage.content) &&
        !advisoryIntentPattern.test(userMessage.content));

    const userRequestsAdvice =
      advisoryIntentPattern.test(userMessage.content) && !explicitEditIntentPattern.test(userMessage.content);
    const chatMode = userExplicitlyRequestsEdit ? 'edit' : userRequestsAdvice ? 'advice' : 'chat';
    const userRequestsHeading = /\b(nadpis|titulek|headline)\b/i.test(userMessage.content);

    const nextMessages = [...chatMessages, userMessage];

    setChatMessages(nextMessages);
    setChatInput('');
    setChatLoading(true);
    setError('');

    try {
      const systemPrompt = `Jsi AI asistent uvnitř aplikace Chytrá pěna Social Hub.

Tvoje role:
- vedeš krátkou, praktickou konverzaci v češtině
- odpovídáš na dotazy k aktuálně vygenerovanému obsahu
- pokud uživatel chce text upravit, můžeš rovnou vrátit upravenou verzi
- pokud uživatel nechce nic přepisovat, jen stručně odpověz a obsah nech beze změny

Kontext značky:
${useBrandContext ? compactBrandContext : '- Používej pouze informace ze zadání.'}

Znalostní databáze:
${buildCompactKnowledgeContext(selectedKnowledgeEntries)}

Marketingový briefing pro cílovou skupinu:
${audienceBriefs[targetAudience] || ''}

Pravidla pro platformu:
${platformBriefs[platform] || ''}

Parametry:
- Platforma: ${platform}
- Tón: ${tone}
- Cílová skupina: ${targetAudience}
- Délka: ${postLength}
- CTA: ${cta}
- Přímé cílení na firmu: ${resolvedCompanyProfile?.name ? 'ano' : 'ne'}
${resolvedCompanyProfile?.name ? `- Název firmy: ${resolvedCompanyProfile.name}
- Doporučená role k oslovení: ${resolvedCompanyProfile?.recommendedContact?.label || 'vedení společnosti'}` : ''}

Pravidla:
- Odpovídej stručně, přirozeně a prakticky.
- Nevymýšlej neověřená čísla ani technické sliby.
- Aktuální režim konverzace: ${chatMode}
- Ve výchozím stavu jen odpovídej a nic nepřepisuj.
- "applyChanges": true nastav jen tehdy, když uživatel výslovně žádá přepsání nebo změnu textu, např. uprav, přepiš, zkrať, prodluž, změň, doplň, přidej, odeber, přeformuluj.
- Pokud je dotaz jen poradenský, vysvětlující nebo hodnoticí, nech "applyChanges": false.
- Pokud je režim "advice", dej návrh nebo seznam doporučení a rozhodně nepiš, že už byl text upraven.
- Pokud uživatel žádá úpravu textu, promítni ji do "updatedMainText".
- Pokud vracíš "applyChanges": true, musí být "updatedMainText" skutečně přepracovaný a viditelně odlišný od původního textu.
- Nestačí jen potvrdit změnu slovně; vrať opravdu novou verzi textu.
- Pokud uživatel žádá přidání nadpisu nebo titulku, vlož krátký samostatný nadpis přímo na začátek "updatedMainText".
- Pokud uživatel výslovně neřeší vizuál nebo hashtagy, nech je co nejblíž původní verzi.
- ${strictClaims ? 'Drž se pouze ověřených tvrzení.' : 'Můžeš psát kreativněji, ale stále relevantně.'}

Vrať pouze čistý JSON v této struktuře:
{
  "reply": "stručná odpověď pro uživatele",
  "applyChanges": true,
  "updatedMainText": "upravený nebo původní text",
  "updatedVisualPrompt": "upravený nebo původní návrh vizuálu",
  "updatedHashtags": ["#tag1", "#tag2"],
  "updatedFlyerTitle": "volitelné",
  "updatedFlyerText": "volitelné"
}

Pravidla pro JSON:
- "reply" je vždy povinný string.
- Pokud se obsah nemá změnit, vrať "applyChanges": false.
- Pokud je "applyChanges": false, ostatní aktualizační pole můžeš vrátit prázdná.
- Pokud se má změnit obsah, "updatedMainText" musí být vyplněný.
- "updatedVisualPrompt" vrať jako string.
- "updatedHashtags" vrať jako pole.
- Nevkládej žádné další klíče.`;

      const prompt = `Původní zadání:
${contentPrompt}

Aktuální hlavní text:
${parsed.main || '-'}

Aktuální návrh vizuálu:
${parsed.visual || '-'}

Aktuální hashtagy:
${parsed.hashtags || '-'}

Aktuální nadpis letáku:
${flyerTitle || '-'}

Aktuální text letáku:
${flyerText || '-'}

Dosavadní konverzace:
${nextMessages.slice(-6).map((message) => `${message.role === 'user' ? 'Uživatel' : 'AI'}: ${message.content}`).join('\n')}

Speciální požadavky:
- Uživatel chce přidat nadpis: ${userRequestsHeading ? 'ano' : 'ne'}

Zpracuj poslední uživatelskou zprávu.`;

      const response = await fetch('/api/chat-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt,
          prompt,
          currentMainText: parsed.main,
          currentVisualPrompt: parsed.visual,
          currentHashtags: parsed.hashtags,
          currentFlyerTitle: flyerTitle,
          currentFlyerText: flyerText,
          userExplicitlyRequestsEdit,
          chatMode,
          userRequestsHeading,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setChatMessages([
          ...nextMessages,
          {
            id: `${Date.now()}-assistant-error`,
            role: 'assistant',
            content:
              payload?.error ||
              'Teď jsem neodpověděl korektně. Zkus to prosím ještě jednou, případně pokyn zkrať.',
          },
        ]);
        return;
      }

      const replyText = typeof payload.reply === 'string' && payload.reply.trim()
        ? payload.reply.trim()
        : userExplicitlyRequestsEdit
          ? 'Úpravu jsem zpracoval.'
          : chatMode === 'advice'
            ? 'Tady je moje doporučení.'
            : 'Tady je moje odpověď.';
      const shouldApplyChanges = userExplicitlyRequestsEdit && Boolean(payload.applyChanges);
      const mainTextActuallyChanged =
        typeof payload.updatedMainText === 'string' && payload.updatedMainText.trim() !== parsed.main;
      const finalShouldApplyChanges =
        shouldApplyChanges && (!userRequestsHeading || mainTextActuallyChanged);
      const effectiveReplyText =
        userExplicitlyRequestsEdit && !finalShouldApplyChanges
          ? 'Návrh na úpravu jsem vyhodnotil, ale zatím nevznikla konkrétní změna textu. Zkus prosím přesněji popsat, co chceš přepsat.'
          : replyText;

      setOutputMeta((current) => ({
        ...current,
        chat: {
          provider: 'OpenAI GPT',
          model: payload.model || 'OpenAI chat',
        },
      }));

      if (finalShouldApplyChanges) {
        const nextStructuredPayload = {
          main: typeof payload.updatedMainText === 'string' && payload.updatedMainText.trim()
            ? payload.updatedMainText.trim()
            : parsed.main,
          visual: typeof payload.updatedVisualPrompt === 'string'
            ? payload.updatedVisualPrompt.trim()
            : parsed.visual,
          hashtags: Array.isArray(payload.updatedHashtags)
            ? payload.updatedHashtags.filter(Boolean).join(' ')
            : parsed.hashtags,
        };

        if (!includeVisual) {
          nextStructuredPayload.visual = '';
        } else if (looksLikeEnglishVisual(nextStructuredPayload.visual)) {
          nextStructuredPayload.visual = await translateVisualPromptToCzech(nextStructuredPayload.visual);
        }

        if (!includeHashtags) {
          nextStructuredPayload.hashtags = '';
        }

        const visualActuallyChanged =
          nextStructuredPayload.visual.trim() !== (parsed.visual || '').trim();

        setGeneratedContent(serializeGeneratedContent(nextStructuredPayload));
        setOutputMeta((current) => ({
          ...current,
          content: {
            provider: 'OpenAI GPT',
            model: payload.model || current.chat.model || 'OpenAI chat',
          },
        }));
        if (visualActuallyChanged) {
          setGeneratedImage('');
          setFlyerImage('');
          setImageError('');
        }
        setFlyerStructure((current) => ({
          ...current,
          ...(typeof payload.updatedFlyerTitle === 'string' && payload.updatedFlyerTitle.trim()
            ? { headline: payload.updatedFlyerTitle.trim() }
            : {}),
          ...(typeof payload.updatedFlyerText === 'string' && payload.updatedFlyerText.trim()
            ? { subheadline: payload.updatedFlyerText.trim() }
            : {}),
        }));
        if (typeof payload.updatedFlyerTitle === 'string' && payload.updatedFlyerTitle.trim()) {
          setFlyerTitle(payload.updatedFlyerTitle.trim());
        }

        if (typeof payload.updatedFlyerText === 'string' && payload.updatedFlyerText.trim()) {
          setFlyerText(payload.updatedFlyerText.trim());
        }
      }

      setChatMessages([
        ...nextMessages,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: effectiveReplyText,
        },
      ]);
    } catch {
      setChatMessages([
        ...nextMessages,
        {
          id: `${Date.now()}-assistant-error`,
          role: 'assistant',
          content: 'Odpověď se nepodařilo dokončit. Zkus prosím kratší pokyn nebo dotaz zopakuj.',
        },
      ]);
    } finally {
      setChatLoading(false);
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

  const handleVisualPromptChange = (value) => {
    const updatedContent = serializeGeneratedContent({
      main: parsed.main,
      visual: value,
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
    fileInputRef.current.click();
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
      const dataUrl = photo.dataUrl
        ? photo.dataUrl
        : await (async () => {
            const response = await fetch(photo.url);
            const blob = await response.blob();
            const file = new File([blob], photo.name, { type: blob.type || 'image/jpeg' });
            return fileToDataUrl(file);
          })();
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

  const handleSaveGeneratedImageToGallery = () => {
    if (!generatedImage) return;

    const itemId = `custom-${Date.now()}`;
    const itemName = `ai-vizual-${new Date().toISOString().slice(0, 10)}-${customGalleryItems.length + 1}.png`;
    const nextItem = {
      id: itemId,
      name: itemName,
      url: generatedImage,
      dataUrl: generatedImage,
      source: 'generated',
      createdAt: new Date().toISOString(),
    };

    setCustomGalleryItems((current) => [nextItem, ...current].slice(0, 60));
    setSelectedCompanyPhotoId(itemId);
    setSourceImageDataUrl(generatedImage);
    setSourceImageName(itemName);
    setImageMode('edit');
    setCompanyGalleryOpen(true);
    setImageError('');
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
    setRevisionPrompt('');
    setChatMessages([]);
    setChatInput('');
    setGeneratedImage('');
    setFlyerTitle('');
    setFlyerText('');
    setFlyerStructure(defaultFlyerStructure);
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
                    placeholder="Např. Proč zateplit střechu právě teď a co tím majitel domu reálně získá"
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
                        ?
                        'border-lime-400 bg-gradient-to-br from-lime-50 to-[#eef8d8] text-lime-900 shadow-[0_10px_22px_rgba(122,169,10,0.14)]'
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
                        ?
                        'border-lime-400 bg-gradient-to-br from-lime-50 to-[#eef8d8] text-lime-900 shadow-[0_10px_22px_rgba(122,169,10,0.14)]'
                        : 'border-[#d0d9c4] bg-[#fffefb] text-slate-600 hover:border-lime-300 hover:bg-[#fcfdf8]'
                    )}
                  >
                    <div className="font-semibold">AI generace od nuly</div>
                    <div className="mt-1 text-xs">Použije pouze textový popis bez podkladové fotky.</div>
                  </button>
                </div>

                {imageMode === 'edit' && (
                  <div className="mt-4 rounded-[22px] border-2 border-[#c7d3b8] border-l-[5px] border-l-[#8fbb1a] bg-white p-4 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
                    {companyGalleryItems.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Firemní galerie</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Vyber fotku ze složky `src/assets/Foto` nebo uložený AI obrázek a použij ji jako základ pro AI úpravu.
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
                            {companyGalleryItems.map((photo) => (
                              <button
                                key={photo.id}
                                type="button"
                                onClick={() => handleSelectCompanyPhoto(photo)}
                                className={classNames(
                                  'overflow-hidden rounded-2xl border text-left transition',
                                  selectedCompanyPhotoId === photo.id
                                    ?
                                    'border-lime-300 bg-lime-50 ring-2 ring-lime-200'
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
                                  {'source' in photo && photo.source === 'generated' && (
                                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-lime-700">
                                      Uložený AI obrázek
                                    </p>
                                  )}
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
                            ?
                            'border-lime-200 bg-lime-50 text-lime-700'
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
                          {item.outputMeta?.content?.provider && (
                            <p className="mt-1 text-xs text-slate-400">
                              {item.outputMeta.content.provider} · {item.outputMeta.content.model}
                            </p>
                          )}
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
                {(outputMeta.content.provider || outputMeta.chat.provider) && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {outputMeta.content.provider && (
                      <span className="rounded-full border border-slate-600/80 bg-slate-900/35 px-3 py-1 text-slate-200">
                        Text: {outputMeta.content.provider} · {outputMeta.content.model}
                      </span>
                    )}
                    {outputMeta.chat.provider && (
                      <span className="rounded-full border border-slate-600/80 bg-slate-900/35 px-3 py-1 text-slate-200">
                        Chat: {outputMeta.chat.provider} · {outputMeta.chat.model}
                      </span>
                    )}
                  </div>
                )}
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
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Chat s AI
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Můžeš se doptat, chtít úpravy textu nebo si nechat vysvětlit, proč je výstup napsaný právě tak.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleReviseContent}
                          disabled={revisionLoading || !revisionPrompt.trim()}
                          className="shrink-0 rounded-xl border border-slate-700/90 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {revisionLoading
                            ? 'Vylepšuji návrh hlavního textu…'
                            : 'Vylepšit návrh hlavního textu'}
                        </button>
                      </div>

                      {chatMessages.length > 0 && (
                        <div className="mt-3 space-y-3 rounded-xl border border-slate-700/90 bg-[#0b1220] p-3">
                          {chatMessages.map((message) => (
                            <div
                              key={message.id}
                              className={classNames(
                                'max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-6',
                                message.role === 'user'
                                  ? 'ml-auto bg-lime-500/18 text-lime-50'
                                  : 'bg-slate-800 text-slate-200'
                              )}
                            >
                              {message.content}
                            </div>
                          ))}
                        </div>
                      )}

                      <textarea
                        value={chatInput}
                        onChange={(e) => {
                          setChatInput(e.target.value);
                          setRevisionPrompt(e.target.value);
                        }}
                        placeholder="Např. zkrať to na polovinu, udělej text víc pro SVJ, vysvětli mi proč je CTA takto formulované…"
                        className="mt-3 min-h-[96px] w-full rounded-xl border border-slate-700/90 bg-[#0b1220] p-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-lime-400 focus:ring-4 focus:ring-lime-500/10"
                      />

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={handleSendChatMessage}
                          disabled={chatLoading || !chatInput.trim()}
                          className="rounded-xl border border-lime-300/35 bg-lime-500/18 px-3 py-2 text-xs font-semibold text-lime-50 transition hover:bg-lime-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {chatLoading ? 'Odpovídám…' : 'Poslat AI'}
                        </button>
                      </div>
                    </div>

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
                            type="button"
                            onClick={handleSuggestVisualPrompt}
                            disabled={visualSuggestionLoading}
                            className="rounded-lg border border-lime-300/30 bg-lime-500/12 px-2.5 py-1.5 text-xs font-medium text-lime-50 hover:bg-lime-500/24 disabled:opacity-50"
                          >
                            {visualSuggestionLoading ? 'Navrhuji…' : 'Přegenerovat vizuál'}
                          </button>
                          <button
                            onClick={handleGenerateImage}
                            disabled={imageLoading || visualSuggestionLoading}
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
                      <textarea
                        value={parsed.visual}
                        onChange={(e) => handleVisualPromptChange(e.target.value)}
                        className="min-h-[140px] w-full resize-y rounded-xl border border-lime-300/20 bg-[#0b1220] p-3 text-sm leading-7 text-lime-50 outline-none transition placeholder:text-lime-100/40 focus:border-lime-300/40 focus:ring-4 focus:ring-lime-500/10"
                        placeholder="Sem můžeš ručně upravit doporučený vizuál."
                      />

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
                          <div className="flex justify-end border-t border-lime-300/20 bg-[#0f172a]/30 px-3 py-2">
                            <button
                              type="button"
                              onClick={handleSaveGeneratedImageToGallery}
                              className="rounded-lg border border-lime-300/35 bg-lime-500/18 px-2.5 py-1.5 text-xs font-medium text-lime-50 transition hover:bg-lime-500/30"
                            >
                              Uložit obrázek
                            </button>
                          </div>
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
                            {flyerTextLoading ? 'Navrhuji…' : 'Přegenerovat text letáku'}
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
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setFlyerTitle(nextValue);
                            setFlyerStructure((current) => ({
                              ...current,
                              headline: nextValue,
                            }));
                          }}
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
                                  ?
                                  'border-lime-300/35 bg-lime-500/22 text-lime-50'
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
                        onChange={(e) => {
                          setFlyerText(e.target.value);
                          setFlyerStructure((current) => ({
                            ...current,
                            subheadline: '',
                            benefits: [],
                            proof: '',
                            cta: current.cta,
                          }));
                        }}
                        placeholder="Sem můžeš ručně upravit nebo nechat AI navrhnout text letáku."
                        className="min-h-[160px] w-full rounded-xl border border-slate-700/90 bg-[#0b1220] p-3 text-sm leading-7 text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-lime-400 focus:ring-4 focus:ring-lime-500/10"
                      />

                      <div className="mt-4 rounded-xl border border-lime-300/20 bg-slate-950/20 p-3 text-xs leading-6 text-lime-50/85">
                        Letáková verze se teď vytváří automaticky spolu s hlavním textem. Tady ji můžeš jen ručně doladit nebo nechat znovu přegenerovat.
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
          ?
          'border-lime-300 bg-lime-50 shadow-[0_12px_24px_rgba(122,169,10,0.12)]'
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

