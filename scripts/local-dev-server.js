import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import checkNamecheapHandler from '../api/namecheap/check.js';
import checkPorkbunHandler from '../api/porkbun/check.js';
import porkbunSuggestionsHandler from '../api/porkbun/suggestions.js';
import verifyDomainHandler from '../api/domains/verify.js';
import mockCheckoutHandler from '../api/payments/mock/checkout.js';
import mockWebhookHandler from '../api/payments/mock/webhook.js';
import processDomainOrderHandler from '../api/domain-orders/process.js';
import deploymentActionHandler from '../api/deployments/action.js';
import deploymentPublicSiteHandler from '../api/deployments/public-site.js';
import derivTokenHandler from '../api/deriv/token.js';
import derivIntrospectHandler from '../api/deriv/introspect.js';
import derivOptionsWebsocketUrlHandler from '../api/deriv/options-websocket-url.js';
import commissionIngestHandler from '../api/commissions/ingest.js';

function loadEnvFile(fileName) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// Load local environment files when running API routes outside Vercel runtime.
loadEnvFile('.env.local');
loadEnvFile('.env');

const app = express();
const port = Number(process.env.LOCAL_API_PORT || 3001);

app.use(express.json());

app.all('/api/namecheap/check', async (req, res) => {
  await checkNamecheapHandler(req, res);
});

app.all('/api/porkbun/check', async (req, res) => {
  await checkPorkbunHandler(req, res);
});

app.all('/api/porkbun/suggestions', async (req, res) => {
  await porkbunSuggestionsHandler(req, res);
});

app.all('/api/domains/verify', async (req, res) => {
  await verifyDomainHandler(req, res);
});

app.all('/api/payments/mock/checkout', async (req, res) => {
  await mockCheckoutHandler(req, res);
});

app.all('/api/payments/mock/webhook', async (req, res) => {
  await mockWebhookHandler(req, res);
});

app.all('/api/domain-orders/process', async (req, res) => {
  await processDomainOrderHandler(req, res);
});

app.all('/api/deriv/token', async (req, res) => {
  await derivTokenHandler(req, res);
});

app.all('/api/deriv/introspect', async (req, res) => {
  await derivIntrospectHandler(req, res);
});

app.all('/api/deriv/options-websocket-url', async (req, res) => {
  await derivOptionsWebsocketUrlHandler(req, res);
});

app.all('/api/commissions/ingest', async (req, res) => {
  await commissionIngestHandler(req, res);
});

app.all('/api/deployments/action', async (req, res) => {
  await deploymentActionHandler(req, res);
});

app.all('/api/deployments/public-site', async (req, res) => {
  await deploymentPublicSiteHandler(req, res);
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(port, () => {
  console.log(`Local API server running on http://localhost:${port}`);
});
