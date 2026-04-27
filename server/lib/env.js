export function getEnv(name, fallback = undefined) {
  const value = process.env[name];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return fallback;
}

export function getRequiredEnv(name) {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function isTrue(value) {
  return String(value || '').toLowerCase() === 'true';
}
