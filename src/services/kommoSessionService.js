require('dotenv').config();
const puppeteer = require('puppeteer');
const KommoSession = require('../models/KommoSession');

const SESSION_TTL_MS = 48 * 60 * 60 * 1000; // 48 horas

// Refrescos en curso por subdominio, para que llamadas concurrentes reutilicen
// el mismo browser en vez de lanzar uno cada una (causaba EAGAIN por falta de recursos)
const pendingRefreshes = new Map();

// "Failed to launch the browser process! ... Resource temporarily unavailable (11)"
// es EAGAIN del SO al hacer fork/posix_spawn: casi siempre falta transitoria de
// recursos (procesos/hilos del sistema al límite), no un fallo permanente. Se
// puede autorecuperar reintentando con backoff.
const LAUNCH_RETRY_DELAYS_MS = [3000, 8000, 15000];

function isTransientLaunchError(error) {
  const msg = error?.message || '';
  return (
    msg.includes('Failed to launch the browser process') ||
    msg.includes('Resource temporarily unavailable') ||
    msg.includes('EAGAIN') ||
    msg.includes('spawn')
  );
}

// Lanza Chrome con reintentos: si falla por falta de recursos (EAGAIN), espera
// y reintenta en vez de tumbar el flujo que lo llamó.
async function launchBrowserWithRetry() {
  let lastError;
  for (let attempt = 1; attempt <= LAUNCH_RETRY_DELAYS_MS.length + 1; attempt++) {
    try {
      return await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--mute-audio',
          '--no-first-run',
        ],
      });
    } catch (error) {
      lastError = error;
      const delay = LAUNCH_RETRY_DELAYS_MS[attempt - 1];
      if (delay && isTransientLaunchError(error)) {
        console.warn(
          `[KommoSession] Fallo transitorio al lanzar Chrome (intento ${attempt}/${LAUNCH_RETRY_DELAYS_MS.length + 1}): ${error.message}. Reintentando en ${delay}ms...`
        );
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// Cierra el browser con un límite de tiempo; si close() se cuelga, mata el
// proceso directamente para no dejar procesos huérfanos consumiendo recursos
// (causa típica de que el EAGAIN se repita cada vez más seguido).
async function closeBrowserSafely(browser) {
  try {
    await Promise.race([
      browser.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('browser.close() timeout')), 10000)),
    ]);
  } catch (error) {
    console.warn('[KommoSession] browser.close() falló o se colgó, forzando kill del proceso:', error.message);
    try {
      browser.process()?.kill('SIGKILL');
    } catch (_killError) {
      // Ya no había proceso que matar; ignorar.
    }
  }
}

// Verifica si las cookies en DB son válidas (menos de 48h)
async function isSessionValid(subdominio) {
  const record = await KommoSession.findOne({ where: { domain: subdominio } });
  if (!record) return false;
  const age = Date.now() - new Date(record.obtained_at).getTime();
  return age < SESSION_TTL_MS;
}

function refreshKommoSession(subdominio) {
  if (pendingRefreshes.has(subdominio)) {
    return pendingRefreshes.get(subdominio);
  }

  const promise = doRefreshKommoSession(subdominio).finally(() => {
    pendingRefreshes.delete(subdominio);
  });
  pendingRefreshes.set(subdominio, promise);
  return promise;
}

// Lanza Puppeteer, hace login y guarda las cookies en DB
async function doRefreshKommoSession(subdominio) {
  console.log(`[KommoSession] Iniciando sesión en Kommo con Puppeteer (subdominio: ${subdominio})...`);

  const browser = await launchBrowserWithRetry();

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
    await closeBrowserSafely(browser);
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
