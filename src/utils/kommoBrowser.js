const fs = require('fs/promises');

const RETRY_DELAYS_MS = [3000, 8000, 15000];
const RESOURCE_COOLDOWN_MS = 60000;

function isResourceError(error) {
  return error?.code === 'EAGAIN' ||
    /Resource temporarily unavailable|\bEAGAIN\b|pthread_create.*failed|Cannot allocate memory|\bENOMEM\b/i.test(error?.message || '');
}

// Leer archivos directamente: no crear más subprocesos cuando faltan PIDs.
async function resourceDiagnostics() {
  const paths = {
    pids_current: '/sys/fs/cgroup/pids.current',
    pids_max: '/sys/fs/cgroup/pids.max',
    pids_events: '/sys/fs/cgroup/pids.events',
    memory_current: '/sys/fs/cgroup/memory.current',
    memory_max: '/sys/fs/cgroup/memory.max',
    memory_events: '/sys/fs/cgroup/memory.events',
    pids_current_v1: '/sys/fs/cgroup/pids/pids.current',
    pids_max_v1: '/sys/fs/cgroup/pids/pids.max',
    process_limits: '/proc/self/limits',
    pid1: '/proc/1/comm',
  };
  const entries = await Promise.all(Object.entries(paths).map(async ([key, file]) => {
    try { return [key, (await fs.readFile(file, 'utf8')).trim()]; }
    catch (_) { return null; } // Windows, cgroup v1 o rutas no montadas.
  }));
  return Object.fromEntries(entries.filter(Boolean));
}

function resourceUnavailable(retryAfterMs, cause) {
  const error = new Error('Chrome no está disponible por falta de recursos del servidor. ' +
    `Próximo intento permitido en ${Math.ceil(retryAfterMs / 1000)} segundos.`);
  error.code = 'KOMMO_BROWSER_RESOURCE_EXHAUSTED';
  error.retryAfterMs = retryAfterMs;
  if (cause) error.cause = cause;
  return error;
}

function createBrowserManager({ launch, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  diagnostics = resourceDiagnostics, logger = console, closeTimeoutMs = 10000 } = {}) {
  let blockedUntil = 0;
  let queue = Promise.resolve();

  return {
    // Serializa el ciclo completo login + cierre, incluso entre subdominios.
    runExclusive(task) {
      const result = queue.then(task);
      queue = result.catch(() => {});
      return result;
    },

    async launch() {
      if (now() < blockedUntil) throw resourceUnavailable(blockedUntil - now());
      for (let attempt = 0; ; attempt++) {
        try {
          return await launch();
        } catch (error) {
          // Un ejecutable ausente, permisos o dependencias faltantes no son EAGAIN.
          if (!isResourceError(error)) throw error;
          if (attempt < RETRY_DELAYS_MS.length) {
            const delay = RETRY_DELAYS_MS[attempt];
            logger.warn(`[KommoSession] Chrome sin recursos (intento ${attempt + 1}/4). Reintentando en ${delay}ms.`);
            await sleep(delay);
            continue;
          }
          blockedUntil = now() + RESOURCE_COOLDOWN_MS;
          let snapshot;
          try { snapshot = await diagnostics(); } catch (_) { snapshot = { unavailable: true }; }
          logger.error('[KommoSession] Chrome agotó los reintentos; pausa de 60s. Recursos del contenedor:', snapshot);
          throw resourceUnavailable(Math.max(0, blockedUntil - now()), error);
        }
      }
    },

    async close(browser) {
      let timeout;
      try {
        await Promise.race([
          Promise.resolve().then(() => browser.close()),
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('browser.close() timeout')), closeTimeoutMs);
          }),
        ]);
      } catch (error) {
        logger.warn('[KommoSession] No se pudo cerrar Chrome; forzando su proceso:', error.message);
        try { browser.process()?.kill('SIGKILL'); } catch (_) { /* El proceso ya terminó. */ }
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

module.exports = { createBrowserManager, isResourceError, resourceDiagnostics };
