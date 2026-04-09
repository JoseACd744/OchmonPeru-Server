require('dotenv').config();
const puppeteer = require('puppeteer');
const KommoSession = require('../models/KommoSession');

const SESSION_TTL_MS = 48 * 60 * 60 * 1000; // 48 horas

// Verifica si las cookies en DB son válidas (menos de 48h)
async function isSessionValid(subdominio) {
  const record = await KommoSession.findOne({ where: { domain: subdominio } });
  if (!record) return false;
  const age = Date.now() - new Date(record.obtained_at).getTime();
  return age < SESSION_TTL_MS;
}

// Lanza Puppeteer, hace login y guarda las cookies en DB
async function refreshKommoSession(subdominio) {
  console.log(`[KommoSession] Iniciando sesión en Kommo con Puppeteer (subdominio: ${subdominio})...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(`https://${subdominio}.kommo.com`, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.waitForSelector('input[name="USER_LOGIN"], input[type="email"]', { timeout: 10000 });
    await page.type('input[name="USER_LOGIN"], input[type="email"]', process.env.KOMMO_EMAIL);
    await page.type('input[name="USER_PASSWORD"], input[type="password"]', process.env.KOMMO_PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('button[type="submit"], input[type="submit"]'),
    ]);

    const cookies = await page.cookies();
    const cookieHeader = cookies
      .filter(c => c && c.name && typeof c.value !== 'undefined')
      .map(c => `${c.name}=${c.value}`)
      .join('; ');
    const sessionId = cookies.find(c => c.name === 'session_id')?.value;
    const csrfToken = cookies.find(c => c.name === 'csrf_token')?.value;

    if (!sessionId || !csrfToken) {
      const names = cookies.map(c => c.name).join(', ');
      throw new Error(`No se encontraron las cookies. Cookies disponibles: ${names}`);
    }

    await KommoSession.upsert({
      domain: subdominio,
      session_id: sessionId,
      csrf_token: csrfToken,
      obtained_at: new Date(),
    });

    console.log(`[KommoSession] Cookies guardadas en DB → session_id: ${sessionId.slice(0, 8)}...`);
    return { sessionId, csrfToken, cookieHeader };
  } finally {
    await browser.close();
  }
}

// Lee las cookies desde DB. Lanza error si no existen o están expiradas.
async function getKommoSessionFromDB(subdominio) {
  const record = await KommoSession.findOne({ where: { domain: subdominio } });
  if (!record) throw new Error('[KommoSession] No hay cookies de sesión en DB. Reinicia el servidor.');

  const age = Date.now() - new Date(record.obtained_at).getTime();
  if (age >= SESSION_TTL_MS) throw new Error('[KommoSession] Cookies de sesión expiradas. Reinicia el servidor.');

  console.log(`[KommoSession] Usando cookies cacheadas (${Math.round(age / 3600000)}h de antigüedad)`);
  return { sessionId: record.session_id, csrfToken: record.csrf_token };
}

// Llamar al iniciar el servidor: refresca solo si es necesario
async function initializeKommoSession() {
  const subdominio = process.env.SUBDOMINIO;
  const valid = await isSessionValid(subdominio);
  if (valid) {
    console.log('[KommoSession] Cookies de sesión válidas en DB, no es necesario renovar.');
    return;
  }
  await refreshKommoSession(subdominio);
}

module.exports = { initializeKommoSession, refreshKommoSession, getKommoSessionFromDB };
