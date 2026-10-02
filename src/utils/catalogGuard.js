const { randomUUID } = require('crypto');
const { buscarProducto } = require('./buscarProducto');
const { calcularCotizacion } = require('./calcularCotizacion');

// No existe un catálogo aprobado de fijaciones. No reutilizar datos de láminas.
function mentionsUnsupportedProduct(text) {
  return /tornill|autoperfor|arandela|capuch[oó]n|tirafondo|pija\b/i.test(text || '');
}

const HANDOFF_MESSAGE = 'Necesito confirmar esta información con un asesor para darte datos y precios correctos. Voy a derivar tu consulta.';

// Una instancia por solicitud: nunca compartir productos entre clientes ni turnos.
class CatalogGuard {
  constructor() {
    this.products = new Map();
    this.amounts = new Set();
    this.blocked = false;
    this.quoted = false;
  }

  reject(message) {
    this.blocked = true;
    return { success: false, message };
  }

  search(args) {
    if (mentionsUnsupportedProduct(JSON.stringify(args))) {
      return this.reject('Fijaciones sin catálogo aprobado: deriva a un asesor. No ofrecer espesores, colores, cantidades ni precios.');
    }
    const result = buscarProducto(args);
    if (result.encontrado) {
      const producto_id = randomUUID();
      this.products.set(producto_id, { tipo: args.tipo, datos: result.datos });
      this.amounts.add(result.datos.PRECIO);
      return { ...result, producto_id };
    }
    return result;
  }

  quote(args = {}) {
    if (!Array.isArray(args.items) || !args.items.length) {
      return this.reject('La cotización requiere productos verificados con buscar_producto en este turno.');
    }
    const items = [];
    const currencies = new Set();
    for (const item of args.items) {
      if (!item || mentionsUnsupportedProduct(JSON.stringify(item))) {
        return this.reject('No se pueden cotizar fijaciones sin catálogo aprobado. Deriva a un asesor.');
      }
      const product = this.products.get(item.producto_id);
      if (!product || product.tipo !== item.tipo_producto) {
        return this.reject('producto_id no verificado para este tipo. Ejecuta buscar_producto y usa el ID de su resultado.');
      }
      if (item.precio_unitario !== undefined && item.precio_unitario !== product.datos.PRECIO) {
        return this.reject('El precio indicado no coincide con el catálogo.');
      }
      if (item.peso_unitario_kg !== undefined && item.peso_unitario_kg !== product.datos.PESO_KG_PROMEDIO_COMERCIAL) {
        return this.reject('El peso indicado no coincide con el catálogo.');
      }
      const accessory = product.tipo === 'accesorios_aluzinc';
      if ((accessory && item.modo !== 'unidades') || (!accessory && item.modo === 'unidades')) {
        return this.reject('Modo de cotización incompatible con la unidad de venta del catálogo.');
      }
      currencies.add(product.tipo.startsWith('panel_') ? 'USD' : 'PEN');
      // La descripción y el precio proceden del registro, no del texto del modelo.
      items.push({ ...item, precio_unitario: product.datos.PRECIO,
        descripcion: [product.tipo, product.datos.FORMATO, product.datos.ESPESOR,
          product.datos.COLOR_PRINCIPAL].filter(Boolean).join(' ') });
    }
    if (currencies.size !== 1 || (args.moneda && !currencies.has(args.moneda))) {
      return this.reject('No mezcles monedas ni cambies la moneda del catálogo.');
    }
    const result = calcularCotizacion({ items, moneda: [...currencies][0] });
    if (result.success) {
      this.quoted = true;
      this.amounts.add(result.total);
      result.items.forEach(item => this.amounts.add(item.subtotal));
    } else {
      this.blocked = true;
    }
    return result;
  }

  validateResponse(text) {
    if (this.blocked || mentionsUnsupportedProduct(text)) return false;
    // Importes explícitos: solo pueden repetirse precios o totales verificados.
    const money = /(?:S\/\.?|USD|US\$|\$)\s*([0-9]+(?:[.,][0-9]+)*)/gi;
    for (const match of text.matchAll(money)) {
      const raw = match[1];
      const amount = Number(raw.includes('.') ? raw.replace(/,/g, '') : raw.replace(',', '.'));
      if (!this.amounts.has(amount)) return false;
    }
    for (const match of text.matchAll(/([0-9]+(?:[.,][0-9]+)*)\s*(?:soles|d[oó]lares|PEN)\b/gi)) {
      const raw = match[1];
      const amount = Number(raw.includes('.') ? raw.replace(/,/g, '') : raw.replace(',', '.'));
      if (!this.amounts.has(amount)) return false;
    }
    return true;
  }
}

module.exports = { CatalogGuard, mentionsUnsupportedProduct, HANDOFF_MESSAGE };
