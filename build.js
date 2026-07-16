const fs   = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const fontkit = require('fontkit');

const POSTS_DIR = path.join(__dirname, 'posts');
const BLOG_DIR  = path.join(__dirname, 'blog');
const SITE      = 'https://laura-schunke.de';
const TODAY     = new Date().toISOString().slice(0, 10);

// Titel-Font für die auto-generierten Thumbnails (als Vektor-Pfade gerendert)
const TITLE_FONT = fontkit.openSync(path.join(__dirname, 'fonts/playfair-600-latin.woff2'));

// ── Fallback-Bilder (rotieren für Posts ohne eigenes image:) ──────────────────
// Neutrale Portrait-/Natur-Motive, keine themen-gebundenen Landingpage-Bilder.
const FALLBACK_IMAGES = [
  '/images/psychotherapie-schwabach-blog.jpg',
  '/images/laura-schunke-entspannt-natur.jpg',
  '/images/therapeutin-schwabach-natur.jpg',
  '/images/psychotherapeutin-schwabach-abendlicht.jpg',
  '/images/laura-schunke-therapeutin-portrait.jpg',
  '/images/heilpraktikerin-schwabach-sitzend.jpg',
  '/images/heilpraktikerin-psychotherapie-schwabach-portrait.jpg',
  '/images/laura-schunke-psychotherapie-schwabach.jpg',
];

// ── Slug aus Dateiname ────────────────────────────────────────────────────────
function slugFromFile(filename) {
  return filename
    .replace(/\.md$/, '')
    .replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

// ── Datum-Hilfsfunktionen ─────────────────────────────────────────────────────
function toDate(val) {
  return val instanceof Date ? val : new Date(val + 'T12:00:00');
}
function formatDate(val) {
  return toDate(val).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
}
function isoDate(val) {
  return toDate(val).toISOString().slice(0, 10);
}

// ── Titel-Thumbnail (SVG, Text als Vektor-Pfade) ──────────────────────────────
// Ast-Symbol (viewBox 0 0 26 30), einfärbbar
function ast(c) {
  return `
    <line x1="13" y1="28" x2="13" y2="5" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M13 22 C19 20 24 13 21 7 C15 9 12 17 13 22Z" fill="${c}"/>
    <path d="M13 15 C7 13 3 7 6 2 C11 4 14 11 13 15Z" fill="${c}" fill-opacity="0.6"/>
    <circle cx="13" cy="4" r="2.5" fill="${c}" fill-opacity="0.35"/>`;
}

// Breite eines Textes in px bei gegebener Schriftgröße (inkl. optischem Kerning)
function measureWidth(text, fontSize, letterSpacing = 0) {
  const scale = fontSize / TITLE_FONT.unitsPerEm;
  const run = TITLE_FONT.layout(text);
  let pen = 0;
  for (let i = 0; i < run.glyphs.length; i++) pen += run.positions[i].xAdvance + letterSpacing / scale;
  if (run.glyphs.length) pen -= letterSpacing / scale; // kein Spacing hinter dem letzten Zeichen
  return pen * scale;
}

// Text als <path>-Outlines rendern (y-Flip, Baseline bei `baseline`)
function textToPaths(text, fontSize, originX, baseline, fill, letterSpacing = 0) {
  const scale = fontSize / TITLE_FONT.unitsPerEm;
  const run = TITLE_FONT.layout(text);
  let penX = 0;
  let out = '';
  for (let i = 0; i < run.glyphs.length; i++) {
    const g = run.glyphs[i];
    const pos = run.positions[i];
    const d = g.path.toSVG();
    if (d) {
      const tx = originX + (penX + pos.xOffset) * scale;
      const ty = baseline - pos.yOffset * scale;
      out += `<path d="${d}" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" fill="${fill}"/>`;
    }
    penX += pos.xAdvance + letterSpacing / scale;
  }
  return out;
}

// Wörter greedy in Zeilen umbrechen, so dass jede Zeile <= maxWidth
function wrapLines(text, fontSize, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (measureWidth(test, fontSize) <= maxWidth || !cur) cur = test;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Zeilen gleichmäßiger verteilen (verhindert Waisen-Zeilen wie ein einzelnes „und"):
// schmalste Breite suchen, die noch dieselbe Zeilenzahl ergibt → ausbalanciert.
function balancedLines(text, fontSize, maxWidth) {
  const base = wrapLines(text, fontSize, maxWidth);
  const n = base.length;
  if (n <= 1) return base;
  let lo = 60, hi = maxWidth, best = base;
  for (let it = 0; it < 16; it++) {
    const mid = (lo + hi) / 2;
    const w = wrapLines(text, fontSize, mid);
    if (w.length <= n) { best = w; hi = mid; } else { lo = mid; }
  }
  return best;
}

// Größte Schriftgröße wählen, bei der Titel in <= maxLines passt
function fitTitle(title, maxWidth, maxLines, sizes) {
  let best = null;
  for (const size of sizes) {
    const lines = wrapLines(title, size, maxWidth);
    const widest = Math.max(...lines.map(l => measureWidth(l, size)));
    best = { size, lines }; // merken (kleinste als Fallback)
    if (lines.length <= maxLines && widest <= maxWidth) return { size, lines };
  }
  return best; // nichts passte perfekt → kleinste Stufe
}

function renderThumb(title) {
  const W = 1200, H = 675;
  const X = 110;                 // linker Textrand
  const MAXW = 684;              // Textbreite (Rest = Ast-Wasserzeichen)
  const CY = 372;                // vertikale Mitte des Titelblocks
  const { size } = fitTitle(title, MAXW, 4, [88, 80, 72, 64, 58, 52, 46, 40, 35]);
  const lines = balancedLines(title, size, MAXW);
  const lh = size * 1.16;
  const blockH = lines.length * lh;
  const firstBaseline = CY - blockH / 2 + size * 0.80;
  const lastBaseline = firstBaseline + (lines.length - 1) * lh;

  const titlePaths = lines.map((line, i) =>
    textToPaths(line, size, X, firstBaseline + i * lh, '#FCFAF5')
  ).join('');

  // Header-Cluster (kleiner Ast + „BLOG") dicht, aber ohne Überlappung über dem Titel
  const eyebrowBaseline = firstBaseline - size * 0.72 - 30;
  const eyebrow = textToPaths('BLOG', 23, X + 2, eyebrowBaseline, '#F5F0E8CC', 7);
  const astScale = 1.9;
  const astY = eyebrowBaseline - 87;   // Ast-Unterkante ~28px über der „BLOG"-Grundlinie
  const accentY = lastBaseline + 30;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title.replace(/"/g, '&quot;')} – Blog">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7FA383"/>
      <stop offset="1" stop-color="#5E8262"/>
    </linearGradient>
    <clipPath id="frame"><rect width="${W}" height="${H}"/></clipPath>
  </defs>
  <g clip-path="url(#frame)">
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <g opacity="0.16" transform="translate(690,25) scale(20)">${ast('#FFFFFF')}</g>
    <g transform="translate(${X - 2},${astY}) scale(${astScale})">${ast('#F5F0E8')}</g>
    ${eyebrow}
    ${titlePaths}
    <rect x="${X + 2}" y="${accentY}" width="110" height="5" rx="2.5" fill="#FCFAF5" opacity="0.9"/>
  </g>
</svg>`;
}

// ── HTML für einen Post ───────────────────────────────────────────────────────
function renderPost({ slug, title, date, excerpt, seo_desc, image, body }) {
  const canonical  = `${SITE}/blog/${slug}/`;
  const metaDesc   = seo_desc || excerpt || '';
  const imgUrl     = image
    ? (image.startsWith('http') ? image : `${SITE}${image}`)
    : `${SITE}/images/psychotherapie-schwabach-blog.jpg`;
  const dateStr    = date ? isoDate(date) : TODAY;
  const dateFormatted = formatDate(dateStr);
  const htmlBody   = marked.parse(body || '');

  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: metaDesc,
    datePublished: dateStr,
    dateModified: dateStr,
    author: {
      '@type': 'Person',
      name: 'Laura Schunke',
      jobTitle: 'Heilpraktikerin für Psychotherapie',
      url: SITE,
      hasCredential: {
        '@type': 'EducationalOccupationalCredential',
        name: 'Heilerlaubnis für Psychotherapie',
        recognizedBy: { '@type': 'GovernmentOrganization', name: 'Gesundheitsamt Nürnberg' }
      }
    },
    publisher: {
      '@type': 'Organization',
      name: 'Laura Schunke – Heilpraktikerin für Psychotherapie',
      url: SITE,
      logo: { '@type': 'ImageObject', url: `${SITE}/images/laura-schunke-psychotherapie-schwabach.jpg` }
    },
    image: imgUrl,
    url: canonical,
    mainEntityOfPage: canonical
  });

  const breadcrumb = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Startseite', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog/` },
      { '@type': 'ListItem', position: 3, name: title, item: canonical }
    ]
  });

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} – Nürnberg, Schwabach &amp; Umland | Laura Schunke</title>
  <meta name="description" content="${metaDesc.replace(/"/g, '&quot;')}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Laura Schunke – Heilpraktikerin für Psychotherapie" />
  <meta property="og:title" content="${title} | Laura Schunke" />
  <meta property="og:description" content="${metaDesc.replace(/"/g, '&quot;')}" />
  <meta property="og:image" content="${imgUrl}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:locale" content="de_DE" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')} | Laura Schunke" />
  <meta name="twitter:description" content="${metaDesc.replace(/"/g, '&quot;')}" />
  <meta name="twitter:image" content="${imgUrl}" />
  <meta property="article:published_time" content="${dateStr}" />
  <meta property="article:author" content="Laura Schunke" />
  <script type="application/ld+json">${schema}</script>
  <script type="application/ld+json">${breadcrumb}</script>
  <link rel="stylesheet" href="/fonts/fonts.css" />
  <style>
    :root {
      --cream:#F5F0E8; --sage:#7A9E7E; --sage-dark:#5E8262; --sage-light:#EAF0EA;
      --brown:#4A3728; --brown-mid:#6B5547; --white:#FFFFFF;
      --font-heading:'Playfair Display',Georgia,serif;
      --font-body:'Inter',system-ui,sans-serif;
    }
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth}
    body{font-family:var(--font-body);font-size:1rem;line-height:1.75;color:var(--brown);background:var(--cream);-webkit-font-smoothing:antialiased}
    a{color:var(--sage)}
    a:hover{text-decoration:underline}
    .nav{position:sticky;top:0;z-index:100;background:rgba(255,255,255,0.96);backdrop-filter:blur(12px);box-shadow:0 2px 20px rgba(74,55,40,0.09);padding:1rem 0}
    .nav-inner{max-width:1180px;margin:0 auto;padding:0 clamp(20px,5vw,56px);display:flex;align-items:center;justify-content:space-between;gap:1.5rem}
    .nav-logo{display:flex;align-items:center;gap:0.55rem;font-family:var(--font-heading);font-size:1.15rem;font-weight:600;color:var(--brown);text-decoration:none}
    .nav-back{display:flex;align-items:center;gap:0.4rem;font-size:0.9rem;color:var(--sage);text-decoration:none}
    .nav-back:hover{text-decoration:underline}
    .post-hero{background:var(--white)}
    .post-hero-img-wrap{position:relative}
    .post-hero-img-wrap::after{content:'';position:absolute;bottom:0;left:0;right:0;height:180px;background:linear-gradient(to bottom,transparent,var(--white));pointer-events:none}
    .post-hero-img{width:100%;max-height:440px;object-fit:cover;object-position:center top;display:block}
    .post-header{max-width:760px;margin:0 auto;padding:clamp(2rem,5vw,3.5rem) clamp(20px,5vw,40px) 2rem}
    .post-meta{font-size:0.82rem;color:var(--sage);font-weight:500;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.75rem}
    .post-header h1{font-family:var(--font-heading);font-size:clamp(1.75rem,4.5vw,2.75rem);font-weight:600;color:var(--brown);line-height:1.25;margin-bottom:1rem}
    .post-excerpt{font-size:1.1rem;color:var(--brown-mid);line-height:1.7}
    .post-body{max-width:760px;margin:0 auto;padding:2rem clamp(20px,5vw,40px) clamp(48px,7vw,80px)}
    .post-body p{color:var(--brown-mid);margin-bottom:1.25rem;font-size:1.05rem;line-height:1.85}
    .post-body h2{font-family:var(--font-heading);font-size:1.5rem;color:var(--brown);margin:2.5rem 0 0.75rem}
    .post-body h3{font-family:var(--font-heading);font-size:1.2rem;color:var(--brown);margin:2rem 0 0.6rem}
    .post-body ul,.post-body ol{margin:0.75rem 0 1.25rem 1.75rem;color:var(--brown-mid)}
    .post-body li{margin-bottom:0.4rem;font-size:1.05rem}
    .post-body blockquote{border-left:3px solid var(--sage);padding:1rem 1.5rem;margin:1.5rem 0;background:var(--sage-light);border-radius:0 10px 10px 0;font-style:italic;color:var(--brown-mid)}
    .post-body img{max-width:100%;border-radius:12px;margin:1.5rem 0}
    .post-body strong{color:var(--brown)}
    .post-body a{color:var(--sage);text-decoration:underline}
    .post-cta{background:var(--sage-light);border-radius:18px;padding:2rem 2.5rem;text-align:center;margin:3rem 0}
    .post-cta h3{font-family:var(--font-heading);font-size:1.3rem;margin-bottom:0.75rem}
    .post-cta p{color:var(--brown-mid);margin-bottom:1.5rem}
    a.btn{display:inline-flex;align-items:center;gap:0.5rem;padding:0.9rem 2rem;border-radius:9999px;font-size:0.97rem;font-weight:500;background:var(--sage);color:#fff;transition:background 0.25s,transform 0.25s;text-decoration:none}
    a.btn:hover{background:var(--sage-dark);color:#fff;transform:translateY(-2px);text-decoration:none}
    footer{background:var(--brown);color:rgba(255,255,255,0.65);padding:1.5rem 0;text-align:center;font-size:0.85rem}
    footer a{color:rgba(255,255,255,0.75)}
  </style>
</head>
<body>

<nav class="nav" aria-label="Navigation">
  <div class="nav-inner">
    <a href="/" class="nav-logo" aria-label="Laura Schunke – Startseite">
      <svg width="22" height="26" viewBox="0 0 26 30" fill="none" aria-hidden="true"><line x1="13" y1="28" x2="13" y2="5" stroke="#7A9E7E" stroke-width="1.5" stroke-linecap="round"/><path d="M13 22 C19 20 24 13 21 7 C15 9 12 17 13 22Z" fill="#7A9E7E"/><path d="M13 15 C7 13 3 7 6 2 C11 4 14 11 13 15Z" fill="#7A9E7E" fill-opacity="0.6"/><circle cx="13" cy="4" r="2.5" fill="#7A9E7E" fill-opacity="0.35"/></svg>
      Laura Schunke
    </a>
    <a href="/blog/" class="nav-back">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
      Alle Artikel
    </a>
  </div>
</nav>

<main>
  <article class="post-hero">
    ${image ? `<div class="post-hero-img-wrap"><img src="${image}" alt="${title}" class="post-hero-img" /></div>` : ''}
    <header class="post-header">
      <p class="post-meta">Laura Schunke · <time datetime="${dateStr}">${dateFormatted}</time></p>
      <h1>${title}</h1>
      ${excerpt ? `<p class="post-excerpt">${excerpt}</p>` : ''}
    </header>
    <div class="post-body">
      ${htmlBody}
      <div class="post-cta">
        <h3>Klingt das nach dem richtigen Rahmen für dich?</h3>
        <p>Im kostenlosen Kennenlerngespräch schauen wir gemeinsam, ob und wie ich dir helfen kann.</p>
        <a href="/#kontakt" class="btn">Erstgespräch anfragen</a>
      </div>
    </div>
  </article>
</main>

<footer>
  <p>© 2026 Laura Schunke ·
    <a href="/">Startseite</a> ·
    <a href="/impressum.html">Impressum</a> ·
    <a href="/datenschutz.html">Datenschutz</a>
  </p>
</footer>

</body>
</html>`;
}

// ── Blog-Index generieren ─────────────────────────────────────────────────────
function renderIndex(posts) {
  const cards = posts.map(({ slug, title, date, excerpt }) => {
    const dateStr = date ? isoDate(date) : '';
    return `
    <a href="/blog/${slug}/" class="post-card">
      <img src="/blog/${slug}/thumb.svg" alt="${title}" class="post-card-img" loading="lazy" />
      <div class="post-card-body">
        ${dateStr ? `<p class="post-date">${formatDate(dateStr)}</p>` : ''}
        <h2 style="position:absolute;width:1px;height:1px;padding:0;margin:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0">${title}</h2>
        ${excerpt ? `<p>${excerpt}</p>` : ''}
        <span class="post-read">Weiterlesen →</span>
      </div>
    </a>`;
  }).join('\n');

  const indexDesc = 'Artikel zu Psychotherapie, mentaler Gesundheit und Themen wie Burnout, Angst und Depression – von Laura Schunke, Heilpraktikerin für Psychotherapie in Schwabach.';
  const indexImg  = `${SITE}/images/psychotherapie-schwabach-blog.jpg`; // echtes Foto (kein SVG) fürs Teilen

  const itemList = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Blog – Laura Schunke, Heilpraktikerin für Psychotherapie',
    itemListElement: posts.map(({ slug, title }, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE}/blog/${slug}/`,
      name: title
    }))
  });

  const indexBreadcrumb = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Startseite', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog/` }
    ]
  });

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blog – Nürnberg, Schwabach &amp; Umland | Laura Schunke</title>
  <meta name="description" content="${indexDesc}" />
  <link rel="canonical" href="${SITE}/blog/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Laura Schunke – Heilpraktikerin für Psychotherapie" />
  <meta property="og:title" content="Blog | Laura Schunke" />
  <meta property="og:description" content="${indexDesc}" />
  <meta property="og:image" content="${indexImg}" />
  <meta property="og:url" content="${SITE}/blog/" />
  <meta property="og:locale" content="de_DE" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Blog | Laura Schunke" />
  <meta name="twitter:description" content="${indexDesc}" />
  <meta name="twitter:image" content="${indexImg}" />
  <script type="application/ld+json">${itemList}</script>
  <script type="application/ld+json">${indexBreadcrumb}</script>
  <link rel="stylesheet" href="/fonts/fonts.css" />
  <style>
    :root{--cream:#F5F0E8;--sage:#7A9E7E;--sage-dark:#5E8262;--sage-light:#EAF0EA;--brown:#4A3728;--brown-mid:#6B5547;--white:#FFFFFF;--font-heading:'Playfair Display',Georgia,serif;--font-body:'Inter',system-ui,sans-serif;--shadow-md:0 8px 32px rgba(74,55,40,0.12)}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:var(--font-body);color:var(--brown);background:var(--cream);-webkit-font-smoothing:antialiased}
    a{color:inherit;text-decoration:none}
    .nav{position:sticky;top:0;z-index:100;background:rgba(255,255,255,0.96);backdrop-filter:blur(12px);box-shadow:0 2px 20px rgba(74,55,40,0.09);padding:1rem 0}
    .nav-inner{max-width:1180px;margin:0 auto;padding:0 clamp(20px,5vw,56px);display:flex;align-items:center;justify-content:space-between;gap:1.5rem}
    .nav-logo{display:flex;align-items:center;gap:0.55rem;font-family:var(--font-heading);font-size:1.15rem;font-weight:600;color:var(--brown)}
    .nav-back{display:flex;align-items:center;gap:0.4rem;font-size:0.9rem;color:var(--sage)}
    .nav-back:hover{text-decoration:underline}
    .blog-header{max-width:1180px;margin:0 auto;padding:clamp(3rem,6vw,5rem) clamp(20px,5vw,56px) 2rem}
    .eyebrow{display:block;font-size:0.76rem;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:var(--sage);margin-bottom:0.65rem}
    .blog-header h1{font-family:var(--font-heading);font-size:clamp(1.75rem,4vw,2.6rem);font-weight:600;margin-bottom:0.75rem}
    .blog-header p{color:var(--brown-mid);max-width:560px;font-size:1.05rem;line-height:1.75}
    .posts-section{max-width:1180px;margin:0 auto;padding:2rem clamp(20px,5vw,56px) clamp(64px,9vw,104px)}
    .posts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:2rem}
    .post-card{background:var(--white);border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 2px 12px rgba(74,55,40,0.07);transition:box-shadow 0.3s,transform 0.3s;cursor:pointer}
    .post-card:hover{box-shadow:var(--shadow-md);transform:translateY(-4px)}
    .post-card-img{width:100%;height:200px;object-fit:cover;object-position:top center;display:block}
    .post-card-body{padding:1.5rem;flex:1;display:flex;flex-direction:column}
    .post-date{font-size:0.70rem;color:var(--sage);font-weight:500;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.5rem}
    .post-card h2{font-family:var(--font-heading);font-size:1.1rem;margin-bottom:0.6rem;line-height:1.4;color:var(--brown)}
    .post-card p{font-size:0.88rem;color:var(--brown-mid);line-height:1.65}
    .post-read{display:inline-block;margin-top:auto;padding-top:1rem;font-size:0.88rem;color:var(--sage);font-weight:500}
    footer{background:var(--brown);color:rgba(255,255,255,0.65);padding:1.5rem 0;text-align:center;font-size:0.85rem}
    footer a{color:rgba(255,255,255,0.75)}
  </style>
</head>
<body>

<nav class="nav" aria-label="Navigation">
  <div class="nav-inner">
    <a href="/" class="nav-logo" aria-label="Laura Schunke – Startseite">
      <svg width="22" height="26" viewBox="0 0 26 30" fill="none" aria-hidden="true"><line x1="13" y1="28" x2="13" y2="5" stroke="#7A9E7E" stroke-width="1.5" stroke-linecap="round"/><path d="M13 22 C19 20 24 13 21 7 C15 9 12 17 13 22Z" fill="#7A9E7E"/><path d="M13 15 C7 13 3 7 6 2 C11 4 14 11 13 15Z" fill="#7A9E7E" fill-opacity="0.6"/><circle cx="13" cy="4" r="2.5" fill="#7A9E7E" fill-opacity="0.35"/></svg>
      Laura Schunke
    </a>
    <a href="/" class="nav-back">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
      Zur Praxis
    </a>
  </div>
</nav>

<div class="blog-header">
  <span class="eyebrow">Blog</span>
  <h1>Psychotherapie verstehen</h1>
  <p>Artikel zu mentaler Gesundheit, Therapiemethoden und häufigen Themen aus der Praxis – verständlich erklärt.</p>
</div>

<section class="posts-section">
  <div class="posts-grid">
    ${cards}
  </div>
</section>

<footer>
  <p>© 2026 Laura Schunke ·
    <a href="/">Startseite</a> ·
    <a href="/impressum.html">Impressum</a> ·
    <a href="/datenschutz.html">Datenschutz</a>
  </p>
</footer>

</body>
</html>`;
}

// ── Sitemap updaten ───────────────────────────────────────────────────────────
function updateSitemap(posts) {
  const sitemapPath = path.join(__dirname, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapPath, 'utf-8');

  // Homepage-lastmod auf heute setzen (wird bei jedem Build via Blog-Teaser neu erzeugt)
  sitemap = sitemap.replace(
    new RegExp(`(<loc>${SITE.replace(/[.\/]/g, '\\$&')}/</loc>\\s*<lastmod>)[^<]*(</lastmod>)`),
    `$1${TODAY}$2`
  );

  // Alle bestehenden Blog-Einträge entfernen (query-param und static)
  sitemap = sitemap.replace(
    /\s*<url>\s*<loc>[^<]*\/blog[^<]*<\/loc>[\s\S]*?<\/url>/g,
    ''
  );

  // Neue Einträge vor </urlset> einfügen
  const blogIndex = `  <url>
    <loc>${SITE}/blog/</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  const newEntries = [blogIndex, ...posts.map(({ slug, date }) => {
    const lastmod = date ? isoDate(date) : TODAY;
    return `  <url>
    <loc>${SITE}/blog/${slug}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
  })].join('\n');

  sitemap = sitemap.replace('</urlset>', `${newEntries}\n</urlset>`);
  fs.writeFileSync(sitemapPath, sitemap);
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(POSTS_DIR)) {
    console.log('Kein posts/-Ordner gefunden, überspringe Blog-Build.');
    return;
  }

  // Chronologisch (ältester zuerst): so bekommt ein neuer Post den nächsten
  // Fallback-Bild-Slot und bestehende Posts behalten ihr Bild → stabil.
  const filesAsc = fs.readdirSync(POSTS_DIR)
    .filter(f => f.endsWith('.md'))
    .sort();

  const postsAsc = [];
  let fbCounter = 0;

  for (const file of filesAsc) {
    const raw  = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
    const { data, content } = matter(raw);
    const slug = slugFromFile(file);

    // Eigenes image: hat Vorrang, sonst rotierendes Fallback-Bild
    let image = data.image || null;
    if (!image) {
      image = FALLBACK_IMAGES[fbCounter % FALLBACK_IMAGES.length];
      fbCounter++;
    }

    postsAsc.push({
      slug,
      title:   data.title   || slug,
      date:    data.date    || null,
      excerpt: data.excerpt || '',
      seo_desc: data.seo_desc || data.excerpt || '',
      image,
      body:    content
    });
  }

  const posts = [...postsAsc].reverse(); // neueste zuerst

  for (const post of posts) {
    // Verzeichnis anlegen, HTML + Titel-Thumbnail schreiben
    const outDir = path.join(BLOG_DIR, post.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), renderPost(post));
    fs.writeFileSync(path.join(outDir, 'thumb.svg'), renderThumb(post.title));
    console.log(`✓ blog/${post.slug}/index.html + thumb.svg`);
  }

  // Blog-Index generieren
  fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), renderIndex(posts));
  console.log('✓ blog/index.html');

  // Sitemap aktualisieren
  updateSitemap(posts);
  console.log('✓ sitemap.xml');

  // Statische Blog-Vorschau in index.html injizieren (keine Runtime-Fetches mehr)
  const ARROW = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
  const top3 = posts.slice(0, 3);
  const cards = top3.map(post => {
    const cleanSlug = post.slug.replace(/^\d{4}-\d{2}-\d{2}-/, '');
    const img = `<img src="/blog/${cleanSlug}/thumb.svg" alt="${post.title}" class="blog-card-img" loading="lazy">`;
    const dateStr = post.date ? new Date(isoDate(post.date) + 'T12:00:00').toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    return `<a class="blog-card" href="/blog/${cleanSlug}/">${img}<div class="blog-card-body"><p class="blog-date">${dateStr}</p><h3 style="position:absolute;width:1px;height:1px;padding:0;margin:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0">${post.title}</h3><p>${post.excerpt || ''}</p><span class="blog-read-more">Weiterlesen ${ARROW}</span></div></a>`;
  }).join('\n');
  let indexHtml = fs.readFileSync('index.html', 'utf8');
  indexHtml = indexHtml.replace(
    /<!-- BLOG_PREVIEW_START -->[\s\S]*?<!-- BLOG_PREVIEW_END -->/,
    `<!-- BLOG_PREVIEW_START -->\n${cards}\n<!-- BLOG_PREVIEW_END -->`
  );
  fs.writeFileSync('index.html', indexHtml);
  console.log('✓ index.html blog preview injected');

  console.log(`\nBlog-Build abgeschlossen: ${posts.length} Artikel.`);
}

main();
