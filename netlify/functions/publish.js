exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ungültige Anfrage' }) }; }

  const { password, filename, content } = body;

  if (!process.env.EDITOR_PASSWORD || password !== process.env.EDITOR_PASSWORD) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Falsches Passwort' }) };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server nicht konfiguriert – GITHUB_TOKEN fehlt' }) };
  }

  const contentB64 = Buffer.from(content, 'utf-8').toString('base64');

  const res = await fetch(
    `https://api.github.com/repos/felixpiccu-wq/laura-schunke/contents/posts/${filename}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'laura-schunke-editor/1.0',
      },
      body: JSON.stringify({
        message: `Blogartikel: ${filename}`,
        content: contentB64,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'Fehler beim Veröffentlichen' }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true, filename }) };
};
