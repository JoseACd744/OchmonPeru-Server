const test = require('node:test');
const assert = require('node:assert/strict');

const { calcularCotizacion } = require('../src/utils/calcularCotizacion');
const catalogoUpvc = require('../src/data/cobertura_upvc.json');

function itemUpvc(largo_m, overrides = {}) {
  return {
    tipo_producto: 'cobertura_upvc',
    descripcion: 'Cobertura UPVC TR5 2.00 mm',
    modo: 'planchas',
    precio_unitario: 24.5,
    cantidad_planchas: 10,
    largo_m,
    ...overrides,
  };
}

test('el catálogo UPVC usa 1.00 m de ancho y los tres espesores estándar', () => {
  const anchos = [...new Set(catalogoUpvc.map((producto) => producto['ANCHO UTIIL MT']))];
  const espesores = [...new Set(catalogoUpvc.map((producto) => producto.ESPESOR))].sort();

  assert.deepEqual(anchos, [1]);
  assert.deepEqual(espesores, ['1.50 MM', '2.00 MM', '2.50 MM']);
});

test('acepta únicamente los largos estándar de UPVC', () => {
  for (const largo of [3.9, 5.9, 11.8]) {
    const resultado = calcularCotizacion({ items: [itemUpvc(largo)] });

    assert.equal(resultado.success, true);
    assert.equal(resultado.items[0].tipo_producto, 'cobertura_upvc');
    assert.equal(resultado.total, Math.round(10 * largo * 24.5 * 100) / 100);
  }
});

test('rechaza 4 m y 6 m como largos de UPVC', () => {
  for (const largo of [4, 6]) {
    const resultado = calcularCotizacion({ items: [itemUpvc(largo)] });

    assert.equal(resultado.success, false);
    assert.match(resultado.message, /largo UPVC no estándar/);
    assert.match(resultado.message, /3\.90 m, 5\.90 m y 11\.80 m/);
  }
});

test('rechaza cotizar UPVC por área sin definir las planchas estándar', () => {
  const resultado = calcularCotizacion({
    items: [itemUpvc(undefined, { modo: 'area', area_m2: 40 })],
  });

  assert.equal(resultado.success, false);
  assert.match(resultado.message, /se cotiza por planchas de medida estándar/);
});

test('mantiene la validación para llamadas anteriores que identifican UPVC en la descripción', () => {
  const item = itemUpvc(4);
  delete item.tipo_producto;

  const resultado = calcularCotizacion({ items: [item] });

  assert.equal(resultado.success, false);
  assert.match(resultado.message, /largo UPVC no estándar/);
});

test('no aplica la restricción de largos UPVC a otros productos', () => {
  const resultado = calcularCotizacion({
    items: [{
      tipo_producto: 'cobertura_aluzinc',
      descripcion: 'Cobertura Aluzinc TR5',
      modo: 'planchas',
      precio_unitario: 20,
      cantidad_planchas: 2,
      largo_m: 4,
    }],
  });

  assert.equal(resultado.success, true);
  assert.equal(resultado.total, 160);
});
