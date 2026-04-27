import { getEnv, isTrue } from './env.js';
import { splitSldTld } from './domain-utils.js';

const DEFAULT_API_BASE = 'https://api.sandbox.namecheap.com/xml.response';

function getErrorFromXml(xml) {
  const errorsBlock = xml.match(/<Errors>([\s\S]*?)<\/Errors>/i);
  if (!errorsBlock) return null;

  const errorMessages = [...errorsBlock[1].matchAll(/<Error[^>]*>([\s\S]*?)<\/Error>/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean);

  return errorMessages.length ? errorMessages.join(' | ') : null;
}

function parseCheckResult(xml) {
  const match = xml.match(/<DomainCheckResult[^>]*Available="([^"]+)"[^>]*IsPremiumName="([^"]+)"/i);
  if (!match) {
    return {
      available: false,
      premium: false,
      message: 'Could not parse Namecheap availability response.',
    };
  }

  return {
    available: String(match[1]).toLowerCase() === 'true',
    premium: String(match[2]).toLowerCase() === 'true',
  };
}

function parseCreateResult(xml) {
  const match = xml.match(/<DomainCreateResult[^>]*Registered="([^"]+)"[^>]*OrderID="([^"]*)"/i);
  if (!match) {
    return {
      registered: false,
      orderId: null,
    };
  }

  return {
    registered: String(match[1]).toLowerCase() === 'true',
    orderId: match[2] || null,
  };
}

function parseSetHostsResult(xml) {
  const match = xml.match(/<DomainDNSSetHostsResult[^>]*IsSuccess="([^"]+)"/i);
  if (!match) {
    return { success: false };
  }

  return {
    success: String(match[1]).toLowerCase() === 'true',
  };
}

function getApiConfig() {
  return {
    apiBase: getEnv('NAMECHEAP_API_BASE', DEFAULT_API_BASE),
    apiUser: getEnv('NAMECHEAP_API_USER'),
    apiKey: getEnv('NAMECHEAP_API_KEY'),
    username: getEnv('NAMECHEAP_USERNAME'),
    clientIp: getEnv('NAMECHEAP_CLIENT_IP'),
  };
}

function ensureApiCredentials() {
  const config = getApiConfig();

  if (!config.apiUser || !config.apiKey || !config.username || !config.clientIp) {
    throw new Error('Namecheap credentials are not configured.');
  }

  return config;
}

function hasApiCredentials() {
  const config = getApiConfig();
  return Boolean(config.apiUser && config.apiKey && config.username && config.clientIp);
}

function getMockAvailability(domain) {
  const normalized = String(domain || '').toLowerCase();
  const hash = Array.from(normalized).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const available = hash % 5 !== 0;
  const premium = /(^|\.)((ai)|(crypto)|(forex)|(trade)|(trader)|(bot))(\.|$)/i.test(normalized);

  return {
    domain,
    available,
    premium,
    source: 'mock',
    message: 'Mock domain availability mode is active because live Namecheap credentials are not configured.',
  };
}

async function callNamecheap(command, extraParams) {
  const config = ensureApiCredentials();

  const params = new URLSearchParams({
    ApiUser: config.apiUser,
    ApiKey: config.apiKey,
    UserName: config.username,
    ClientIp: config.clientIp,
    Command: command,
    ...extraParams,
  });

  const response = await fetch(`${config.apiBase}?${params.toString()}`);
  const xml = await response.text();

  const parsedError = getErrorFromXml(xml);
  if (parsedError) {
    throw new Error(parsedError);
  }

  return xml;
}

export async function checkDomainAvailability(domain) {
  const allowMockCheck = isTrue(getEnv('NAMECHEAP_ENABLE_MOCK_CHECK', 'true'));

  if (!hasApiCredentials()) {
    if (allowMockCheck) {
      return getMockAvailability(domain);
    }

    throw new Error('Namecheap credentials are not configured. Set NAMECHEAP_API_USER, NAMECHEAP_API_KEY, NAMECHEAP_USERNAME, and NAMECHEAP_CLIENT_IP.');
  }

  const xml = await callNamecheap('namecheap.domains.check', {
    DomainList: domain,
  });

  const result = parseCheckResult(xml);
  return {
    domain,
    available: result.available,
    premium: result.premium,
    source: 'namecheap',
    message: null,
  };
}

function getContactProfile(email) {
  return {
    firstName: getEnv('NAMECHEAP_CONTACT_FIRST_NAME', 'Domain'),
    lastName: getEnv('NAMECHEAP_CONTACT_LAST_NAME', 'Owner'),
    address1: getEnv('NAMECHEAP_CONTACT_ADDRESS1', 'Nairobi Street 1'),
    city: getEnv('NAMECHEAP_CONTACT_CITY', 'Nairobi'),
    stateProvince: getEnv('NAMECHEAP_CONTACT_STATE', 'Nairobi'),
    postalCode: getEnv('NAMECHEAP_CONTACT_POSTAL', '00100'),
    country: getEnv('NAMECHEAP_CONTACT_COUNTRY', 'KE'),
    phone: getEnv('NAMECHEAP_CONTACT_PHONE', '+254.700000000'),
    emailAddress: email || getEnv('NAMECHEAP_CONTACT_EMAIL', 'domain-owner@example.com'),
    orgName: getEnv('NAMECHEAP_CONTACT_ORG', 'DForge'),
    jobTitle: getEnv('NAMECHEAP_CONTACT_TITLE', 'Founder'),
  };
}

function buildCreateParams(domain, years, registrantEmail) {
  const { sld, tld } = splitSldTld(domain);
  const contact = getContactProfile(registrantEmail);

  const params = {
    DomainName: domain,
    Years: String(years),
    SLD: sld,
    TLD: tld,
  };

  for (const type of ['Registrant', 'Tech', 'Admin', 'AuxBilling']) {
    params[`${type}FirstName`] = contact.firstName;
    params[`${type}LastName`] = contact.lastName;
    params[`${type}Address1`] = contact.address1;
    params[`${type}City`] = contact.city;
    params[`${type}StateProvince`] = contact.stateProvince;
    params[`${type}PostalCode`] = contact.postalCode;
    params[`${type}Country`] = contact.country;
    params[`${type}Phone`] = contact.phone;
    params[`${type}EmailAddress`] = contact.emailAddress;
    params[`${type}OrganizationName`] = contact.orgName;
    params[`${type}JobTitle`] = contact.jobTitle;
  }

  return params;
}

export async function registerDomain({ domain, years, registrantEmail }) {
  const allowLiveRegistration = isTrue(getEnv('NAMECHEAP_ENABLE_REGISTRATION'));

  if (!allowLiveRegistration) {
    return {
      registered: true,
      orderId: `mock-${Date.now()}`,
      mode: 'mock',
    };
  }

  const params = buildCreateParams(domain, years, registrantEmail);
  const xml = await callNamecheap('namecheap.domains.create', params);
  const result = parseCreateResult(xml);

  if (!result.registered) {
    throw new Error('Namecheap did not confirm registration success.');
  }

  return {
    registered: true,
    orderId: result.orderId,
    mode: 'live',
  };
}

export async function setDomainDnsRecords({ domain, records }) {
  const allowLiveRegistration = isTrue(getEnv('NAMECHEAP_ENABLE_REGISTRATION'));

  if (!allowLiveRegistration) {
    return {
      success: true,
      mode: 'mock',
    };
  }

  const { sld, tld } = splitSldTld(domain);
  const extraParams = {
    SLD: sld,
    TLD: tld,
  };

  records.forEach((record, index) => {
    const idx = index + 1;
    extraParams[`HostName${idx}`] = record.host;
    extraParams[`RecordType${idx}`] = record.type;
    extraParams[`Address${idx}`] = record.value;
    extraParams[`TTL${idx}`] = String(record.ttl || 300);
  });

  const xml = await callNamecheap('namecheap.domains.dns.setHosts', extraParams);
  const result = parseSetHostsResult(xml);

  if (!result.success) {
    throw new Error('Namecheap DNS update failed.');
  }

  return {
    success: true,
    mode: 'live',
  };
}

export function getNamecheapAffiliateCheckoutUrl(domain, years = 1) {
  const template = getEnv('NAMECHEAP_AFFILIATE_URL_TEMPLATE', '');

  if (template.includes('{{DOMAIN}}')) {
    return template
      .replaceAll('{{DOMAIN}}', encodeURIComponent(domain))
      .replaceAll('{{YEARS}}', encodeURIComponent(String(Math.max(1, Number(years || 1)))));
  }

  const params = new URLSearchParams({
    domain,
  });

  return `https://www.namecheap.com/domains/registration/results/?${params.toString()}`;
}
