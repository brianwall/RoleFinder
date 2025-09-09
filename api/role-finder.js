export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST with JSON body' });
    return;
  }

  const { company, roles = [], location = '' } = req.body || {};

  if (!company || !Array.isArray(roles) || roles.length === 0) {
    res.status(400).json({ error: 'Provide "company" and a non-empty array "roles".' });
    return;
  }

  // Dummy response for now — just to prove deploy works
  res.status(200).json({
    topMatch: {
      firstName: "Jane",
      lastName: "Doe",
      linkedinUrl: "https://linkedin.com/in/janedoe",
      matchedRole: roles[0],
      company,
      location,
      score: 12
    }
  });
}
