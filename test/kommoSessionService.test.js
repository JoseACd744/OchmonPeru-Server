const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');

function loadSessionService({ newPageFails = false } = {}) {
  const servicePath = path.resolve(__dirname, '../src/services/kommoSessionService.js');
  const localRequire = createRequire(servicePath);
  const counts = { launches: 0, closes: 0, writes: 0, active: 0, maxActive: 0 };
  const browser = {
    async newPage() {
      if (newPageFails) throw new Error('newPage falló');
      return { async goto() {}, async waitForSelector() {}, async type() {}, async waitForNavigation() {}, async click() {},
        async cookies() { return [{ name: 'session_id', value: 'test' }, { name: 'csrf_token', value: 'test' }]; } };
    },
    async close() { counts.closes++; counts.active--; },
  };
  const context = { module: { exports: {} }, process: { env: { KOMMO_EMAIL: 'synthetic', KOMMO_PASSWORD: 'synthetic' } },
    console: { log() {}, warn() {}, error() {} }, require(name) {
      if (name === 'dotenv') return { config() {} };
      if (name === 'puppeteer') return { async launch() {
        counts.launches++;
        counts.active++;
        counts.maxActive = Math.max(counts.maxActive, counts.active);
        return browser;
      } };
      if (name === '../models/KommoSession') return { async upsert() { counts.writes++; } };
      return localRequire(name);
    } };
  vm.runInNewContext(fs.readFileSync(servicePath, 'utf8'), context, { filename: servicePath });
  return { service: context.module.exports, counts };
}

test('peticiones simultáneas del mismo dominio comparten login, escritura y cierre', async () => {
  const { service, counts } = loadSessionService();
  const results = await Promise.all(Array.from({ length: 20 }, () => service.refreshKommoSession('test')));
  assert.equal(counts.launches, 1);
  assert.equal(counts.writes, 1);
  assert.equal(counts.closes, 1);
  assert.ok(results.every(value => value.sessionId === 'test'));
});

test('dominios distintos no mantienen navegadores abiertos al mismo tiempo', async () => {
  const { service, counts } = loadSessionService();
  await Promise.all(['test1', 'test2', 'test3'].map(domain => service.refreshKommoSession(domain)));
  assert.equal(counts.launches, 3);
  assert.equal(counts.closes, 3);
  assert.equal(counts.maxActive, 1);
});

test('un error de página cierra Chrome y libera la renovación pendiente', async () => {
  const { service, counts } = loadSessionService({ newPageFails: true });
  await assert.rejects(service.refreshKommoSession('test'), /newPage falló/);
  await assert.rejects(service.refreshKommoSession('test'), /newPage falló/);
  assert.equal(counts.launches, 2);
  assert.equal(counts.closes, 2);
  assert.equal(counts.writes, 0);
  assert.equal(counts.active, 0);
});

test('endpoint de renovación informa 503 y Retry-After para recursos agotados', async () => {
  const controllerPath = path.resolve(__dirname, '../src/controllers/sessionController.js');
  const context = { module: { exports: {} }, process: { env: { INTERNAL_TOKEN: 'synthetic' } }, console: { error() {} },
    require() { return { async refreshKommoSession() {
      const error = new Error('Chrome sin recursos');
      error.code = 'KOMMO_BROWSER_RESOURCE_EXHAUSTED';
      error.retryAfterMs = 45001;
      throw error;
    } }; } };
  vm.runInNewContext(fs.readFileSync(controllerPath, 'utf8'), context, { filename: controllerPath });
  const controller = new context.module.exports();
  const response = { headers: {}, set(key, value) { this.headers[key] = value; return this; },
    status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  await controller.refresh({ header() { return 'synthetic'; } }, response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['Retry-After'], '46');
  assert.equal(response.body.success, false);
  assert.equal(response.body.retryAfterSeconds, 46);
});
