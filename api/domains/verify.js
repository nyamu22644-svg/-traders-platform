import { verifyDomainDns } from '../../server/lib/dns-verify.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const domain = String(req.body?.domain || '').trim().toLowerCase();
  const verificationToken = String(req.body?.verificationToken || '').trim();
  const verificationRecordName = String(req.body?.verificationRecordName || '_tradesaas-challenge');
  const expectedARecordValue = String(req.body?.expectedARecordValue || '76.76.21.21').trim();

  if (!domain) {
    return res.status(400).json({ error: 'Domain is required.' });
  }

  if (!verificationToken) {
    return res.status(400).json({ error: 'Verification token is required.' });
  }

  const result = await verifyDomainDns({
    domain,
    verificationToken,
    verificationRecordName,
    expectedARecordValue,
  });

  return res.status(200).json(result);
}

