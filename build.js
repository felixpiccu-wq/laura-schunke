const fs   = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const POSTS_DIR = path.join(__dirname, 'posts');
const BLOG_DIR  = path.join(__dirname, 'blog');
const SITE      = 'https://laura-schunke.de';
const TODAY     = new Date().toISOString().slice(0, 10);

// ── Slug aus Dateiname ────────────────────────────────────────────────────────
function slugFromFile(filename) {
  return filename
    .replace(/\.md$/, '')
    .replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

// ── Datum formatieren ─────────────────────────────────────────────────────────
function formatDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── HTML für einen Post ───────────────────────────────────────────────────────
function renderPost({ slug, title, date, excerpt, seo_desc, image, body }) {
  const canonical  = `${SITE}/blog/${slug}/`;
  const metaDesc   = seo_desc || excerpt || '';
  const imgUrl     = image
    ? (image.startsWith('http') ? image : `${SITE}${image}`)
    : `${SITE}/images/psychotherapie-schwabach-blog.jpg`;
  const dateStr    = date ? String(date).slice(0, 10) : TODAY;
  const dateFormatted = formatDate(dateStr);
  const htmlBody   = marked.parse(body || '');

  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: metaDesc,
    datePublished: dateStr,
    author: { '@type': 'Person', 'name': 'Laura Schunke' },
    publisher: {
      '@type': 'Organization',
      name: 'Laura Schunke – Heilpraktikerin für Psychotherapie',
      url: SITE
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
  <meta property="article:published_time" content="${dateStr}" />
  <meta property="article:author" content="Laura Schunke" />
  <script type="application/ld+json">${schema}</script>
  <script type="application/ld+json">${breadcrumb}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
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
    .post-hero-img{width:100%;max-height:440px;object-fit:cover;object-position:center 20%;display:block}
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
        <a href="/#kontakt" class="btn">Kostenloses Erstgespräch anfragen</a>
      </div>
    </div>
  </article>
</main>

<footer>
  <p>© 2025 Laura Schunke ·
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
  const cards = posts.map(({ slug, title, date, excerpt, image }) => {
    const dateStr = date ? String(date).slice(0, 10) : '';
    const imgSrc  = image || '/images/psychotherapie-schwabach-blog.jpg';
    return `
    <a href="/blog/${slug}/" class="post-card">
      <img src="${imgSrc}" alt="${title}" class="post-card-img" loading="lazy" />
      <div class="post-card-body">
        ${dateStr ? `<p class="post-date">${formatDate(dateStr)}</p>` : ''}
        <h2>${title}</h2>
        ${excerpt ? `<p>${excerpt}</p>` : ''}
        <span class="post-read">Weiterlesen →</span>
      </div>
    </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blog – Nürnberg, Schwabach &amp; Umland | Laura Schunke</title>
  <meta name="description" content="Artikel zu Psychotherapie, mentaler Gesundheit und Themen wie Burnout, Angst und Depression – von Laura Schunke, Heilpraktikerin für Psychotherapie in Schwabach." />
  <link rel="canonical" href="${SITE}/blog/" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Blog | Laura Schunke" />
  <meta property="og:url" content="${SITE}/blog/" />
  <meta property="og:locale" content="de_DE" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
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
    .post-card-img{width:100%;height:200px;object-fit:cover;display:block}
    .post-card-body{padding:1.5rem;flex:1;display:flex;flex-direction:column}
    .post-date{font-size:0.78rem;color:var(--sage);font-weight:500;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem}
    .post-card h2{font-family:var(--font-heading);font-size:1.1rem;margin-bottom:0.6rem;line-height:1.4;color:var(--brown)}
    .post-card p{font-size:0.88rem;color:var(--brown-mid);line-height:1.65;flex:1}
    .post-read{display:inline-block;margin-top:1rem;font-size:0.88rem;color:var(--sage);font-weight:500}
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
  <p>© 2025 Laura Schunke ·
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
    const lastmod = date ? String(date).slice(0, 10) : TODAY;
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

  const files = fs.readdirSync(POSTS_DIR)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse(); // neueste zuerst

  const posts = [];

  for (const file of files) {
    const raw  = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
    const { data, content } = matter(raw);
    const slug = slugFromFile(file);

    posts.push({
      slug,
      title:   data.title   || slug,
      date:    data.date    || null,
      excerpt: data.excerpt || '',
      seo_desc: data.seo_desc || data.excerpt || '',
      image:   data.image   || null,
      body:    content
    });

    // Verzeichnis anlegen und HTML schreiben
    const outDir = path.join(BLOG_DIR, slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), renderPost({ slug, ...data, body: content }));
    console.log(`✓ blog/${slug}/index.html`);
  }

  // Blog-Index generieren
  fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), renderIndex(posts));
  console.log('✓ blog/index.html');

  // Sitemap aktualisieren
  updateSitemap(posts);
  console.log('✓ sitemap.xml');

  console.log(`\nBlog-Build abgeschlossen: ${posts.length} Artikel.`);
}

main();
