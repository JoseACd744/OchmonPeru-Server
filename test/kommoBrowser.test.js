const test = require('node:test');
const assert = require('node:assert/strict');
const { createBrowserManager } = require('../src/utils/kommoBrowser');
const logger = { warn() {}, error() {} };
const eagain = () => new Error('Failed to launch the browser process! posix_spawn chrome_crashpad_handler: Resource temporarily unavailable (11)');

test('EAGAIN agota cuatro intentos y bloquea nuevas peticiones durante 60s', async () => {
  let clock = 0;
  let launches = 0;
  let snapshots = 0;
  const delays = [];
  const manager = createBrowserManager({ launch: async () => { launches++; throw eagain(); }, now: () => clock,
    sleep: async delay => { delays.push(delay); clock += delay; }, logger,
    diagnostics: async () => { snapshots++; return { pids_current: '512', pids_max: '512' }; } });
  await assert.rejects(manager.launch(), error => error.code === 'KOMMO_BROWSER_RESOURCE_EXHAUSTED' && error.retryAfterMs === 60000);
  assert.equal(launches, 4);
  assert.deepEqual(delays, [3000, 8000, 15000]);
  assert.equal(snapshots, 1);
  for (let i = 0; i < 20; i++) await assert.rejects(manager.launch(), { code: 'KOMMO_BROWSER_RESOURCE_EXHAUSTED' });
  assert.equal(launches, 4);
  clock += 60000;
  await assert.rejects(manager.launch(), { code: 'KOMMO_BROWSER_RESOURCE_EXHAUSTED' });
  assert.equal(launches, 8);
});

test('puede recuperar un fallo de recursos transitorio', async () => {
  let count = 0;
  const browser = {};
  const manager = createBrowserManager({ launch: async () => { if (++count < 2) throw eagain(); return browser; },
    sleep: async () => {}, logger });
  assert.equal(await manager.launch(), browser);
  assert.equal(count, 2);
});

test('no reintenta ejecutable, dependencias o permisos incorrectos', async () => {
  for (const message of ['Failed to launch the browser process! libfoo.so missing', 'spawn chrome ENOENT', 'spawn chrome EACCES']) {
    let count = 0;
    const manager = createBrowserManager({ launch: async () => { count++; throw new Error(message); }, logger });
    await assert.rejects(manager.launch(), { message });
    assert.equal(count, 1);
  }
});

test('serializa tareas hasta terminar su limpieza y libera la cola tras errores', async () => {
  const manager = createBrowserManager({ logger });
  const events = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = manager.runExclusive(async () => { events.push('login1'); await gate; events.push('close1'); throw new Error('login fallido'); });
  const second = manager.runExclusive(async () => { events.push('login2'); });
  const rejected = assert.rejects(first, /login fallido/);
  await Promise.resolve();
  assert.deepEqual(events, ['login1']);
  release();
  await rejected;
  await second;
  assert.deepEqual(events, ['login1', 'close1', 'login2']);
});

test('cierra normalmente y mata solo el proceso propio si close falla o se cuelga', async () => {
  let kills = 0;
  const manager = createBrowserManager({ logger, closeTimeoutMs: 5 });
  const process = () => ({ kill: signal => { assert.equal(signal, 'SIGKILL'); kills++; } });
  await manager.close({ close: async () => {}, process });
  assert.equal(kills, 0);
  await manager.close({ close: () => { throw new Error('fallo'); }, process });
  assert.equal(kills, 1);
  await manager.close({ close: () => new Promise(() => {}), process });
  assert.equal(kills, 2);
});

test('un fallo de diagnóstico no oculta el error de recursos ni quita el cooldown', async () => {
  let count = 0;
  const manager = createBrowserManager({ launch: async () => { count++; throw eagain(); }, sleep: async () => {}, logger,
    diagnostics: async () => { throw new Error('sin permisos'); } });
  await assert.rejects(manager.launch(), { code: 'KOMMO_BROWSER_RESOURCE_EXHAUSTED' });
  await assert.rejects(manager.launch(), { code: 'KOMMO_BROWSER_RESOURCE_EXHAUSTED' });
  assert.equal(count, 4);
});
