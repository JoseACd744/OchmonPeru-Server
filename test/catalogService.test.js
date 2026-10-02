// Ejercitar el flujo real sin OpenAI, Kommo ni credenciales de producción.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { createRequire } = require('module');
const servicePath = path.resolve(__dirname, '../src/services/openaiService.js');
const localRequire = createRequire(servicePath);
const sandbox = { module: { exports: {} }, process: { env: {} }, console: { log() {}, warn() {}, error() {} },
  setTimeout, require(name) {
    if (name === 'dotenv') return { config() {} };
    if (name === 'openai') return class {};
    if (name === 'node-fetch' || name.startsWith('./')) return {};
    return localRequire(name);
  } };
vm.runInNewContext(fs.readFileSync(servicePath, 'utf8'), sandbox, { filename: servicePath });
const Service = sandbox.module.exports;
function message(text) { return { id: 'response_test', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }; }
function call(name, args) { return { type: 'function_call', name, call_id: name, arguments: JSON.stringify(args) }; }
function service() {
  const instance = new Service();
  instance.actions = [];
  instance.getInterest = async (action, lead) => { instance.actions.push({ action, lead }); return { success: true }; };
  return instance;
}

test('consulta de tornillos se deriva sin invocar el modelo y borra contexto contaminado', async () => {
  const instance = service();
  const id = await instance.createdConversation();
  let called = false;
  instance.streamOpenAIResponse = async () => { called = true; throw new Error('No debe llamarse'); };
  const text = await instance.createResponse('Tornillos autoperforantes azules para 116 m²', id, 'lead_test');
  assert.match(text, /confirmar.*asesor/);
  assert.equal(called, false);
  assert.equal(instance.actions[0].action, 'ASESOR');
  instance.updateConversationContext(id, { messages: [{ role: 'assistant', content: '310 tornillos por S/ 930' }], lastResponseId: 'bad' });
  await instance.createResponse('Ok', id, 'lead_test');
  assert.equal(called, false);
  assert.equal(instance.getConversationContext(id).lastResponseId, null);
});

test('respuesta inventada sin herramientas no llega al cliente ni a la memoria', async () => {
  const instance = service();
  const id = await instance.createdConversation();
  const bad = message('Se necesitan 8 tornillos por m². Total S/ 930.00');
  instance.streamOpenAIResponse = async () => ({ currentResponse: bad, toolCallItems: [] });
  assert.match(await instance.createResponse('¿Qué accesorios necesito?', id, 'lead_test'), /confirmar/);
  assert.equal(instance.getConversationContext(id).messages.length, 0);
  assert.equal(instance.actions[0].action, 'ASESOR');
});

test('precio inventado tras una búsqueda fallida bloquea cierre y deriva', async () => {
  const instance = service();
  const calls = [call('calcular_cotizacion', { items: [{ producto_id: 'inventado', tipo_producto: 'accesorios_aluzinc',
    descripcion: 'Tornillos 0.30 mm gris', modo: 'unidades', cantidad_unidades: 310, precio_unitario: 3 }] }),
    call('cotizado', { action_id: 'COTIZADO' })];
  instance.streamOpenAIResponse = async () => ({ currentResponse: { id: 'test', output: calls }, toolCallItems: calls });
  instance.openai.responses = { create: async () => message('Total S/ 930.00') };
  assert.match(await instance.createResponse('Sí, con eso', null, 'lead_test'), /confirmar/);
  assert.deepEqual(instance.actions.map(a => a.action), ['ASESOR']);
});

test('búsqueda y cálculo verificados permiten una cotización válida y guardan contexto', async () => {
  const instance = service();
  const id = await instance.createdConversation();
  const search = call('buscar_producto', { tipo: 'cobertura_upvc', espesor: '2.00 MM', color: 'AZUL' });
  instance.streamOpenAIResponse = async () => ({ currentResponse: { id: 'test', output: [search] }, toolCallItems: [search] });
  let round = 0;
  instance.openai.responses = { create: async ({ input }) => {
    const output = JSON.parse(input[0].output);
    if (round++ === 0) {
      assert.equal(output.encontrado, true);
      return { id: 'quote', output: [call('calcular_cotizacion', { items: [{ producto_id: output.producto_id,
        tipo_producto: 'cobertura_upvc', modo: 'planchas', cantidad_planchas: 10, largo_m: 3.9 }] })] };
    }
    assert.equal(output.success, true);
    return message(`Total: S/ ${output.total.toFixed(2)}`);
  } };
  const text = await instance.createResponse('10 planchas UPVC azul de 2 mm, largo 3.90 m', id, 'lead_test');
  assert.match(text, /^Total: S\//);
  assert.equal(instance.actions.length, 0);
  assert.equal(instance.getConversationContext(id).verifiedQuote, true);
  assert.equal(instance.getConversationContext(id).messages[1].content, text);
});

test('no ejecuta un cierre pendiente si el texto final resulta inventado', async () => {
  const instance = service();
  const final = call('finalizado', { action_id: 'FINALIZADO' });
  instance.streamOpenAIResponse = async () => ({ currentResponse: { id: 'test', output: [final] }, toolCallItems: [final] });
  instance.openai.responses = { create: async () => message('Los tornillos cuestan 930 soles') };
  assert.match(await instance.createResponse('Sí, con eso', null, 'lead_test'), /confirmar/);
  assert.deepEqual(instance.actions.map(a => a.action), ['ASESOR']);
});
