# ChytrĂˇ pÄ›na Social Hub

JednoduchĂˇ React + Vite aplikace pro generovĂˇnĂ­ pĹ™Ă­spÄ›vkĹŻ na sociĂˇlnĂ­ sĂ­tÄ› pĹ™es Gemini API a obrĂˇzkĹŻ pĹ™es OpenAI.

## ProÄŤ byla strĂˇnka bez stylĹŻ

PouĹľĂ­vali jste Tailwind CSS v4 pĹ™es `@import "tailwindcss";`, ale ve Vite konfiguraci chybÄ›l plugin `@tailwindcss/vite`.
Bez nÄ›j se utility tĹ™Ă­dy nezpracujĂ­, takĹľe se strĂˇnka zobrazĂ­ skoro jako ÄŤistĂ© HTML.

## OpravenĂ© spuĹˇtÄ›nĂ­

```bash
npm install
cp .env.example .env
npm run dev
```

## NastavenĂ­ API klĂ­ÄŤĹŻ

Do souboru `.env` vloĹľte:

```env
VITE_GEMINI_API_KEY=vas_api_klic
OPENAI_API_KEY=vas_openai_api_klic
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_QUALITY=medium
OPENAI_IMAGE_SIZE=1024x1024
```

Pro generovani obrazku se OpenAI klic pouziva pouze na serverove strane ve Vite middleware, takze se neposila do frontendu.

## PoznĂˇmka

Aplikace pouĹľĂ­vĂˇ Tailwind CSS v4 pĹ™es:
- `@import "tailwindcss";` v `src/index.css`
- plugin `@tailwindcss/vite` ve `vite.config.js`
