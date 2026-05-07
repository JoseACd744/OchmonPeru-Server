// buscarProducto.js — OCHMON PERU
// Búsqueda determinística con coincidencia exacta de campos
const path = require('path');
const fs   = require('fs');

// ─── Ajusta esta ruta a donde tengas los JSON ────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');

// ─── Archivos por tipo ────────────────────────────────────────────────────────
const ARCHIVO = {
  cobertura_aluzinc:       'cobertura_aluzinc.json',
  placa_colaborante:       'placa_colaborante.json',
  panel_poliestireno:      'panel_poliestireno.json',
  panel_poliuretano:       'panel_poliuretano.json',
  cobertura_upvc:          'cobertura_upvc.json',
  cobertura_policarbonato: 'cobertura_policarbonato.json',
  cobertura_fibra_vidrio:  'cobertura_fibra_vidrio.json',
  accesorios_aluzinc:      'accesorios_aluzinc.json',
};

// ─── Campos filtrables por tipo (en el orden que deben chequearse) ────────────
// Nota: "ANCHO UTIIL MT" tiene doble I en los datos originales — no corregir.
const CAMPOS_FILTRO = {
  cobertura_aluzinc:       ['FORMATO', 'MODELO', 'ESPESOR', 'COLOR PRINCIPAL', 'CONDICION'],
  placa_colaborante:       ['FORMATO', 'ESPESOR'],
  panel_poliestireno:      ['FORMATO', 'ESPESOR', 'ESPESOR EXTERNO', 'ESPESOR INTERNO', 'COLOR PRINCIPAL', 'CONDICION'],
  panel_poliuretano:       ['FORMATO', 'ESPESOR', 'ESPESOR EXTERNO', 'ESPESOR INTERNO', 'COLOR PRINCIPAL', 'CONDICION'],
  cobertura_upvc:          ['FORMATO', 'ESPESOR', 'COLOR PRINCIPAL'],
  cobertura_policarbonato: ['FORMATO', 'ESPESOR', 'COLOR PRINCIPAL'],
  cobertura_fibra_vidrio:  ['FORMATO', 'MODELO', 'ESPESOR', 'COLOR PRINCIPAL'],
  accesorios_aluzinc:      ['FORMATO', 'ESPESOR', 'COLOR PRINCIPAL', 'CONDICION', 'DESARROLLO', 'DETALLE'],
};

// ─── Campos que se devuelven en "datos" por tipo ──────────────────────────────
const CAMPOS_SALIDA = {
  cobertura_aluzinc:       ['FORMATO', 'MODELO', 'ESPESOR', 'COLOR PRINCIPAL', 'CONDICION', 'RALL', 'ANCHO UTIIL MT', 'PESO KG PROMEDIO COMERCIAL', 'PRECIO'],
  placa_colaborante:       ['FORMATO', 'MODELO', 'ESPESOR', 'ANCHO UTIIL MT', 'PESO KG PROMEDIO COMERCIAL', 'PRECIO'],
  panel_poliestireno:      ['FORMATO', 'ESPESOR', 'ESPESOR EXTERNO', 'ESPESOR INTERNO', 'COLOR PRINCIPAL', 'CONDICION', 'RALL', 'ANCHO UTIIL MT', 'PESO KG PROMEDIO COMERCIAL', 'PRECIO'],
  panel_poliuretano:       ['FORMATO', 'ESPESOR', 'ESPESOR EXTERNO', 'ESPESOR INTERNO', 'COLOR PRINCIPAL', 'CONDICION', 'RALL', 'ANCHO UTIIL MT', 'PESO KG PROMEDIO COMERCIAL', 'PRECIO'],
  cobertura_upvc:          ['FORMATO', 'MODELO', 'ESPESOR', 'COLOR PRINCIPAL', 'ANCHO UTIIL MT', 'PESO KG PROMEDIO COMERCIAL', 'PRECIO'],
  cobertura_policarbonato: ['FORMATO', 'MODELO', 'ESPESOR', 'COLOR PRINCIPAL', 'PESO KG PROMEDIO COMERCIAL', 'PRECIO'],
  cobertura_fibra_vidrio:  ['FORMATO', 'MODELO', 'ESPESOR', 'COLOR PRINCIPAL', 'ANCHO UTIIL MT', 'PESO KG PROMEDIO COMERCIAL', 'PRECIO'],
  accesorios_aluzinc:      ['FORMATO', 'ESPESOR', 'COLOR PRINCIPAL', 'CONDICION', 'DESARROLLO', 'DETALLE', 'RALL', 'PESO KG PROMEDIO COMERCIAL', 'PRECIO'],
};

// ─── Moneda por tipo ──────────────────────────────────────────────────────────
const MONEDA = {
  panel_poliestireno: 'USD',
  panel_poliuretano:  'USD',
};

// ─── Mapeo param del agente → nombre de columna en el JSON ───────────────────
const PARAM_A_CAMPO = {
  formato:         'FORMATO',
  modelo:          'MODELO',
  espesor:         'ESPESOR',
  espesor_externo: 'ESPESOR EXTERNO',
  espesor_interno: 'ESPESOR INTERNO',
  color:           'COLOR PRINCIPAL',
  condicion:       'CONDICION',
  desarrollo:      'DESARROLLO',
  detalle:         'DETALLE',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cargarJSON(tipo) {
  const archivo = ARCHIVO[tipo];
  if (!archivo) throw new Error(`Tipo desconocido: "${tipo}"`);
  const ruta = path.join(DATA_DIR, archivo);
  if (!fs.existsSync(ruta)) throw new Error(`Archivo no encontrado: ${ruta}`);
  // Los JSON pueden contener NaN (valor numérico inválido en JS).
  // JSON.parse estricto los rechaza, así que los reemplazamos por null antes de parsear.
  const raw = fs.readFileSync(ruta, 'utf-8').replace(/:\s*NaN/g, ': null');
  return JSON.parse(raw);
}

function norm(v) {
  if (v === undefined || v === null) return null;
  return String(v).trim().toUpperCase();
}

function extraerSalida(registro, campos) {
  const out = {};
  for (const c of campos) {
    const val = registro[c];
    // Normalizar la clave para el JSON de salida (sin espacios)
    const key = c.replace(/ /g, '_');
    out[key] = (val !== undefined && val !== null) ? val : null;
  }
  return out;
}

function valoresUnicos(data, campo) {
  return [...new Set(data.map(r => r[campo]).filter(v => v !== undefined && v !== null))];
}

// ─── Función principal ────────────────────────────────────────────────────────
function buscarProducto(params) {
  const { tipo, ...resto } = params;

  if (!tipo || !ARCHIVO[tipo]) {
    return {
      encontrado: false,
      motivo: `Tipo de producto desconocido: "${tipo}"`,
      tipos_validos: Object.keys(ARCHIVO),
    };
  }

  const data          = cargarJSON(tipo);
  const camposFiltro  = CAMPOS_FILTRO[tipo];
  const camposSalida  = CAMPOS_SALIDA[tipo];
  const moneda        = MONEDA[tipo] || 'PEN';
  const esPaneles     = tipo.startsWith('panel_');
  const esAccesorio   = tipo === 'accesorios_aluzinc';

  // ── Construir filtros a partir de los parámetros recibidos ──────────────────
  const filtros = {};
  for (const [paramKey, campoJSON] of Object.entries(PARAM_A_CAMPO)) {
    if (
      resto[paramKey] !== undefined &&
      resto[paramKey] !== null &&
      camposFiltro.includes(campoJSON)
    ) {
      filtros[campoJSON] = norm(resto[paramKey]);
    }
  }

  // ── Si no vino ningún filtro, devolver campos disponibles completos ──────────
  if (Object.keys(filtros).length === 0) {
    return buildDatosInsuficientes(tipo, data, camposFiltro, []);
  }

  // ── Detectar campos requeridos que faltan ────────────────────────────────────
  // Campos mínimos obligatorios para hacer una búsqueda significativa por tipo
  const OBLIGATORIOS = {
    cobertura_aluzinc:       ['FORMATO', 'ESPESOR', 'COLOR PRINCIPAL', 'CONDICION'],
    placa_colaborante:       ['FORMATO', 'ESPESOR'],
    panel_poliestireno:      ['FORMATO', 'ESPESOR', 'ESPESOR EXTERNO', 'ESPESOR INTERNO', 'COLOR PRINCIPAL'],
    panel_poliuretano:       ['FORMATO', 'ESPESOR', 'ESPESOR EXTERNO', 'ESPESOR INTERNO', 'COLOR PRINCIPAL'],
    cobertura_upvc:          ['ESPESOR', 'COLOR PRINCIPAL'],
    cobertura_policarbonato: ['FORMATO', 'COLOR PRINCIPAL'],
    cobertura_fibra_vidrio:  ['FORMATO', 'ESPESOR', 'COLOR PRINCIPAL'],
    accesorios_aluzinc:      ['FORMATO', 'ESPESOR', 'COLOR PRINCIPAL'],
  };

  const faltantes = (OBLIGATORIOS[tipo] || []).filter(c => !(c in filtros));

  if (faltantes.length > 0) {
    return buildDatosInsuficientes(tipo, data, faltantes, Object.keys(filtros));
  }

  // ── Búsqueda con coincidencia exacta en TODOS los filtros ────────────────────
  const encontrado = data.find(registro =>
    Object.entries(filtros).every(([campo, valor]) =>
      norm(registro[campo]) === valor
    )
  );

  if (encontrado) {
    return {
      encontrado: true,
      producto: labelProducto(tipo),
      datos: extraerSalida(encontrado, camposSalida),
      nota: notaMoneda(tipo, moneda),
    };
  }

  // ── No encontrado: buscar alternativas con filtros base ──────────────────────
  // Para paneles: usar FORMATO + ESPESOR (núcleo) como base
  // Para el resto: usar FORMATO si existe, sino ESPESOR
  const filtrosBase = {};
  if (filtros['FORMATO'])  filtrosBase['FORMATO'] = filtros['FORMATO'];
  if (esPaneles && filtros['ESPESOR']) filtrosBase['ESPESOR'] = filtros['ESPESOR'];

  const alternativas = data
    .filter(registro =>
      Object.entries(filtrosBase).every(([campo, valor]) =>
        norm(registro[campo]) === valor
      )
    )
    .map(r => extraerSalida(r, camposSalida));

  return {
    encontrado: false,
    producto: labelProducto(tipo),
    motivo: `No existe ningún registro con exactamente: ${JSON.stringify(filtros)}`,
    alternativas,
  };
}

// ─── Helpers de presentación ──────────────────────────────────────────────────
function buildDatosInsuficientes(tipo, data, camposFaltantes, camposPresentes) {
  const disponibles = {};
  for (const campo of camposFaltantes) {
    disponibles[campo] = valoresUnicos(data, campo);
  }

  // Si ya hay filtros parciales aplicados, filtrar los disponibles en contexto
  // (ej: si ya se sabe FORMATO=TECHO, mostrar solo los ESPESOR que existen para TECHO)
  // Para simplificar, devolvemos todos los valores únicos del campo faltante
  return {
    encontrado: false,
    producto: labelProducto(tipo),
    motivo: 'DATOS INSUFICIENTES',
    campos_faltantes: camposFaltantes,
    campos_recibidos: camposPresentes,
    valores_disponibles: disponibles,
  };
}

function labelProducto(tipo) {
  const labels = {
    cobertura_aluzinc:       'COBERTURA ALUZINC',
    placa_colaborante:       'PLACA COLABORANTE',
    panel_poliestireno:      'PANEL POLIESTIRENO',
    panel_poliuretano:       'PANEL POLIURETANO',
    cobertura_upvc:          'COBERTURA UPVC',
    cobertura_policarbonato: 'COBERTURA POLICARBONATO',
    cobertura_fibra_vidrio:  'COBERTURA FIBRA DE VIDRIO',
    accesorios_aluzinc:      'ACCESORIO ALUZINC',
  };
  return labels[tipo] || tipo.toUpperCase();
}

function notaMoneda(tipo, moneda) {
  if (tipo === 'accesorios_aluzinc') return 'PRECIO y PESO por unidad de 3 metros';
  if (moneda === 'USD') return 'PRECIO por metro lineal en DOLARES (USD)';
  return 'PRECIO por metro lineal en SOLES (PEN)';
}

module.exports = { buscarProducto };