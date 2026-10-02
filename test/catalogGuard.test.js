const test = require('node:test');
const assert = require('node:assert/strict');
const { CatalogGuard, mentionsUnsupportedProduct } = require('../src/utils/catalogGuard');

function verifiedItem(guard, overrides = {}) {
  const product = guard.search({ tipo: 'cobertura_upvc', espesor: '2.00 MM', color: 'AZUL' });
  assert.equal(product.encontrado, true);
  return { producto_id: product.producto_id, tipo_producto: 'cobertura_upvc',
    modo: 'planchas', cantidad_planchas: 10, largo_m: 3.9, ...overrides };
}

test('precio y descripción se obtienen del catálogo, y una cotización válida pasa', () => {
  const guard = new CatalogGuard();
  const item = verifiedItem(guard, { descripcion: 'Descripción inventada' });
  const result = guard.quote({ items: [item] });
  assert.equal(result.success, true);
  assert.match(result.items[0].descripcion, /TR5.*2.00 MM.*AZUL/);
  const price = guard.products.get(item.producto_id).datos.PRECIO;
  assert.equal(result.total, Math.round(price * 39 * 100) / 100);
  assert.equal(guard.validateResponse(`Total: S/ ${result.total.toFixed(2)}`), true);
});

test('rechaza precios, pesos, tipos y monedas manipulados', () => {
  for (const overrides of [{ precio_unitario: 0.01 }, { peso_unitario_kg: 999 },
    { tipo_producto: 'accesorios_aluzinc' }, { modo: 'unidades', cantidad_unidades: 310 }]) {
    const guard = new CatalogGuard();
    assert.equal(guard.quote({ items: [verifiedItem(guard, overrides)] }).success, false);
  }
  const guard = new CatalogGuard();
  assert.equal(guard.quote({ items: [verifiedItem(guard)], moneda: 'USD' }).success, false);
});

test('rechaza IDs fabricados o de otra solicitud y cotizaciones sin búsqueda', () => {
  const other = new CatalogGuard();
  const item = verifiedItem(other);
  for (const producto_id of [undefined, 'inventado', item.producto_id]) {
    assert.equal(new CatalogGuard().quote({ items: [{ ...item, producto_id }] }).success, false);
  }
});

test('bloquea el caso reportado incluso si se disfraza como accesorio registrado', () => {
  const guard = new CatalogGuard();
  assert.equal(guard.search({ tipo: 'accesorios_aluzinc', formato: 'TORNILLOS AUTOPERFORANTES' }).success, false);
  const item = verifiedItem(new CatalogGuard(), { descripcion: 'Tornillos autoperforantes con arandela 0.30 mm gris',
    precio_unitario: 3, modo: 'unidades', cantidad_unidades: 310 });
  assert.equal(guard.quote({ items: [item] }).success, false);
  assert.equal(guard.validateResponse('Total general: S/ 3,018.00'), false);
});

test('bloquea especificaciones y consumo de fijaciones aunque no se use ninguna herramienta', () => {
  for (const text of ['8 tornillos por m²', 'Arandelas en color azul',
    'Tornillos 0.30 mm disponibles en rojo, azul y gris', 'autoperforantes compatibles con cualquier cubierta']) {
    assert.equal(new CatalogGuard().validateResponse(text), false);
    assert.equal(mentionsUnsupportedProduct(text), true);
  }
});

test('bloquea importes sin respaldo aun cuando el modelo ignore las herramientas', () => {
  for (const text of ['Total S/ 930.00', 'Precio USD 3', 'US$ 100', '$ 40']) {
    assert.equal(new CatalogGuard().validateResponse(text), false);
  }
  assert.equal(new CatalogGuard().validateResponse('Hola, ¿qué producto necesitas?'), true);
});

test('no acepta como verificado un resultado sin coincidencia exacta', () => {
  const guard = new CatalogGuard();
  const result = guard.search({ tipo: 'accesorios_aluzinc' });
  assert.equal(result.encontrado, false);
  assert.equal(result.producto_id, undefined);
  assert.equal(guard.validateResponse('Precio S/ 30.00'), false);
});

test('mantiene el rechazo de largos UPVC no estándar al validar catálogo', () => {
  const guard = new CatalogGuard();
  assert.equal(guard.quote({ items: [verifiedItem(guard, { largo_m: 4 })] }).success, false);
});
