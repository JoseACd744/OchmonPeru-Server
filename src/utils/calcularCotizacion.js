// calcularCotizacion.js — OCHMON PERU
// Cálculo determinístico de totales de cotización (y peso opcional).
// Reemplaza el cálculo "mental" que antes hacía el modelo de lenguaje,
// causa de montos incorrectos (ej. multiplicaciones o sumas mal hechas).

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function esNumeroValido(n) {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

const LARGOS_ESTANDAR_UPVC_M = [3.9, 5.9, 11.8];

function esItemUpvc(item) {
  return item.tipo_producto === 'cobertura_upvc' || /\bUPVC\b/i.test(item.descripcion || '');
}

function esLargoEstandarUpvc(largo) {
  return LARGOS_ESTANDAR_UPVC_M.some((estandar) => Math.abs(largo - estandar) < 1e-9);
}

function calcularItem(item, index) {
  const { modo, precio_unitario, cantidad_planchas, largo_m, area_m2, cantidad_unidades, peso_unitario_kg } = item;

  if (!esNumeroValido(precio_unitario)) {
    return { error: `Item ${index + 1}: precio_unitario inválido o faltante.` };
  }

  let cantidad_total_m = null; // metros lineales totales, usado también para el peso
  let subtotal = null;

  if (esItemUpvc(item) && modo !== 'planchas') {
    return {
      error: `Item ${index + 1}: la cobertura UPVC se cotiza por planchas de medida estándar. ` +
        'Usa modo "planchas" y selecciona un largo exacto de 3.90 m, 5.90 m o 11.80 m; todas tienen 1.00 m de ancho.',
    };
  }

  if (modo === 'planchas') {
    if (!esNumeroValido(cantidad_planchas) || !esNumeroValido(largo_m)) {
      return { error: `Item ${index + 1}: modo "planchas" requiere cantidad_planchas y largo_m válidos.` };
    }

    if (esItemUpvc(item) && !esLargoEstandarUpvc(largo_m)) {
      return {
        error: `Item ${index + 1}: largo UPVC no estándar (${largo_m} m). ` +
          'Los únicos largos estándar son 3.90 m, 5.90 m y 11.80 m, todos de 1.00 m de ancho. ' +
          'No redondees 3.90 m a 4 m ni 5.90 m a 6 m. Una medida personalizada requiere cotización especial con un asesor.',
      };
    }

    cantidad_total_m = cantidad_planchas * largo_m;
    subtotal = cantidad_total_m * precio_unitario;
  } else if (modo === 'area') {
    if (!esNumeroValido(area_m2)) {
      return { error: `Item ${index + 1}: modo "area" requiere area_m2 válido.` };
    }
    cantidad_total_m = area_m2;
    subtotal = area_m2 * precio_unitario;
  } else if (modo === 'unidades') {
    if (!esNumeroValido(cantidad_unidades)) {
      return { error: `Item ${index + 1}: modo "unidades" requiere cantidad_unidades válido.` };
    }
    subtotal = cantidad_unidades * precio_unitario;
  } else {
    return { error: `Item ${index + 1}: modo "${modo}" inválido. Usa "planchas", "area" o "unidades".` };
  }

  const resultado = {
    descripcion: item.descripcion || null,
    tipo_producto: item.tipo_producto || null,
    modo,
    subtotal: round2(subtotal),
  };

  if (peso_unitario_kg !== undefined && peso_unitario_kg !== null) {
    if (!esNumeroValido(peso_unitario_kg)) {
      return { error: `Item ${index + 1}: peso_unitario_kg inválido.` };
    }
    const baseCantidad = modo === 'unidades' ? cantidad_unidades : cantidad_total_m;
    resultado.peso_kg = round2(baseCantidad * peso_unitario_kg);
  }

  return { resultado };
}

// items: array de { tipo_producto?, descripcion?, modo: 'planchas'|'area'|'unidades', precio_unitario,
//                    cantidad_planchas?, largo_m?, area_m2?, cantidad_unidades?, peso_unitario_kg? }
// moneda: 'PEN' | 'USD' (default 'PEN')
function calcularCotizacion({ items, moneda } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, message: 'Debes enviar al menos un item en "items".' };
  }

  const errores = [];
  const itemsCalculados = [];

  items.forEach((item, index) => {
    const { error, resultado } = calcularItem(item, index);
    if (error) {
      errores.push(error);
    } else {
      itemsCalculados.push(resultado);
    }
  });

  if (errores.length > 0) {
    return { success: false, message: errores.join(' ') };
  }

  const total = round2(itemsCalculados.reduce((acc, it) => acc + it.subtotal, 0));

  const incluyePeso = itemsCalculados.every((it) => it.peso_kg !== undefined);
  const peso_total_kg = incluyePeso
    ? round2(itemsCalculados.reduce((acc, it) => acc + it.peso_kg, 0))
    : null;

  return {
    success: true,
    moneda: moneda === 'USD' ? 'USD' : 'PEN',
    items: itemsCalculados,
    total,
    peso_total_kg,
  };
}

module.exports = { calcularCotizacion };
