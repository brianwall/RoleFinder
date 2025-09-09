export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST with JSON body' });
    return;
  }

  try {
    const {
      company,
      roles = [],
      location = '',
      numPerRole = 10,
      returnAll = false,
    } = req.body || {};

    if (!company || !Array.isArray(roles) || roles.length === 0) {
      res.status(400).json({ error: 'Provide "company" and a non-empty array "roles".' });
      return;
    }

    const API_KEY = process.env.SERPER_API_KEY;
    if (!API_KEY) {
      res.status(500).json({ error: 'Missing SERPER_API_KEY env var on server.' });
      return;
    }

    const norm = (s = '') => String(s).toLowerCase().trim();
    const parseName = (title = '') => {
      const cut = title.split(' | ')[0].split(' - ')[0].trim();
      const parts = cut.split(/\s+/).filter(Boolean);
      if (!parts.length) return { firstName: null, lastName: null };
      if (parts.length === 1) return { firstName: parts[0], lastName: '' };
      return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
    };
    const scoreTitle = ({ title, role, company }) => {
      const t = norm(title), r = norm(role), c = norm(company);
      let s = 0;
      if (r && t.includes(r)) s += 5;
      if (c && t.includes(c)) s += 4;
      if (r) for (const tok of r.split(/\s+/)) if (tok && t.includes(tok)) s += 1;
      if (c && t.includes(` at ${c}`)) s += 2;
      if (t.includes('| linkedin')) s += 1;
      return s;
    };

    const all = [];
    const seen = new Set();
    let rank = 0;

    for (const role of roles) {
      const q =
        `site:linkedin.com/in "${role}" "${company}"` +
        (location ? ` "${location}"` : '');

      const resp = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY,
        },
        body: JSON.stringify({ q, num: numPerRole }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        res.status(502).json({ error: 'SERPER error', status: resp.status, body: txt });
        return;
      }

      const data = await resp.json();
      const results = Array.isArray(data.organic) ? data.organic : [];

      for (const r of results) {
        const link = (r.link || '').split('#')[0].split('?')[0].replace(/\/$/, '');
        if (!link.includes('linkedin.com/in/')) continue;
        if (seen.has(link)) continue;
        seen.add(link);

        const title = r.title || '';
        const { firstName, lastName } = parseName(title);
        const sc = scoreTitle({ title, role, company });

        all.push({
          firstName,
          lastName,
          linkedinUrl: link,
          matchedRole: role,
          titleText: title,
          score: sc,
          rank: rank++,
        });
      }
    }

    all.sort((a, b) => (b.score - a.score) || (a.rank - b.rank));
    const topMatch = all[0] || null;

    res.status(200).json(
      returnAll
        ? { topMatch, totalCandidates: all.length, candidates: all }
        : { topMatch, totalCandidates: all.length }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unhandled error', details: String(err?.message || err) });
  }
}
