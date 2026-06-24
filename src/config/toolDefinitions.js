const tools = [
  {
    type: 'function',
    name: 'buscar_producto',
    description: 'Busca un producto en la base de datos de OCHMON PERU con coincidencia exacta de campos. Si faltan campos obligatorios, retorna las opciones disponibles para que el usuario elija. SIEMPRE llamar esta función antes de responder.',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: [
            'cobertura_aluzinc',
            'placa_colaborante',
            'panel_poliestireno',
            'panel_poliuretano',
            'cobertura_upvc',
            'cobertura_policarbonato',
            'cobertura_fibra_vidrio',
            'accesorios_aluzinc'
          ],
          description: 'Tipo de producto a buscar'
        },
        formato: {
          type: 'string',
          description: 'Formato del producto. Coberturas: TR3, TR4, TR5, TR6, TR7, TEJA, LISA. Paneles: TECHO, MURO. Placa: DECK 38, DECK 60, DECK 75. Accesorios: nombre del accesorio (ej. CUMBRERA STANDARD).'
        },
        modelo: {
          type: 'string',
          description: 'Modelo del producto. Ej: RECTO, CURVO CHANCADO, CURVO ROLADO.'
        },
        espesor: {
          type: 'string',
          description: "Espesor general del producto. En paneles es el espesor del NÚCLEO interior (ej. '50 MM', '100 MM'). En coberturas es el espesor de la lámina (ej. '0.30 MM'). NUNCA confundir con espesor_externo ni espesor_interno."
        },
        espesor_externo: {
          type: 'string',
          description: "SOLO para paneles. Espesor de la chapa metálica exterior. Ej: '0.40 MM', '0.45 MM', '0.50 MM'. Completamente independiente de espesor e espesor_interno."
        },
        espesor_interno: {
          type: 'string',
          description: "SOLO para paneles. Espesor de la chapa metálica interior. Ej: '0.40 MM', '0.45 MM'. Completamente independiente de espesor y espesor_externo."
        },
        color: {
          type: 'string',
          description: 'Color principal del producto. Ej: BLANCO, ROJO, AZUL, VERDE, GRIS, MARRON, NATURAL, CRISTAL, BLANCO LECHOSO, BLANCO OPAL, TRANSPARENTE, AMARILLO, NIEBLA.'
        },
        condicion: {
          type: 'string',
          enum: ['CON FILM', 'NETO'],
          description: 'SOLO para aluzinc y paneles. CON FILM = con película protectora. NETO = sin película.'
        },
        desarrollo: {
          type: 'string',
          description: "SOLO para accesorios. Desarrollo en MM. Ej: 'D:200MM', 'D:300MM', 'D:400MM', 'D:600MM', 'D:900MM', 'D:1220MM'."
        },
        detalle: {
          type: 'string',
          description: 'SOLO para accesorios. Detalle adicional del accesorio.'
        }
      },
      required: ['tipo']
    }
  },
  {
    type: 'function',
    name: 'send_asesor',
    description: 'Send information or trigger an action for the specified ASESOR action ID',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        action_id: {
          type: 'string',
          description: 'The unique action identifier for ASESOR'
        }
      },
      required: ['action_id'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'cotizado',
    description: "Set the action_id to indicate a 'COTIZADO' action.",
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        action_id: {
          type: 'string',
          description: "Action identifier, should be 'COTIZADO'."
        }
      },
      required: ['action_id'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'finalizado',
    description: 'Set the status of an action to FINALIZADO',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        action_id: {
          type: 'string',
          description: 'The unique identifier of the action to be set as FINALIZADO'
        }
      },
      required: ['action_id'],
      additionalProperties: false
    }
  }
];

module.exports = tools;
