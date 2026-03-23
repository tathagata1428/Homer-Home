// Test secret comparison
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  const GDRIVE_SECRET = (process.env.GDRIVE_SECRET || '').trim();
  const expected = 'OixSxy7gpV0N5PrMWHYzXEotWTZWTJ7Cwlgd79pHdao=';
  
  // Detailed comparison
  let comparison = [];
  for (let i = 0; i < Math.max(GDRIVE_SECRET.length, expected.length); i++) {
    const envChar = GDRIVE_SECRET[i] || 'NULL';
    const expChar = expected[i] || 'NULL';
    const match = envChar === expChar;
    if (!match || i < 5 || i > expected.length - 5) {
      comparison.push({
        position: i,
        env: envChar,
        expected: expChar,
        match: match
      });
    }
    if (comparison.length > 10 && !match) break;
  }
  
  res.status(200).json({
    envSecretLength: GDRIVE_SECRET.length,
    expectedLength: expected.length,
    matches: GDRIVE_SECRET === expected,
    envSecret: GDRIVE_SECRET.substring(0, 10) + '...' + GDRIVE_SECRET.substring(GDRIVE_SECRET.length - 5),
    comparison: comparison
  });
}
