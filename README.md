
Este proyecto es una aplicación Node.js que utiliza Express para interactuar con la API de OpenAI. La aplicación está estructurada en módulos para facilitar la mantenibilidad y la escalabilidad.

## Estructura del Proyecto

```
mi-proyecto-node
├── src
│   ├── controllers
│   │   └── openaiController.js  # Controlador para manejar las solicitudes relacionadas con OpenAI
│   ├── routes
│   │   └── openaiRoutes.js      # Definición de rutas para los endpoints de OpenAI
│   ├── services
│   │   └── openaiService.js      # Lógica para interactuar con la API de OpenAI
│   │   └── refreshTokenKommo.js  # Lógica para refrescar el token de kommo cuando sea necesario
│   ├── utils
│   │   └── index.js              # Funciones utilitarias para el proyecto
│   ├── app.js                    # Inicialización de la aplicación Express
│   └── server.js                 # Archivo responsable de iniciar el servidor
├── .env                          # Variables de entorno para la configuración
├── package.json                  # Configuración del proyecto y dependencias
└── README.md                     # Documentación del proyecto
```

## Instalación

1. Clona el repositorio:
   ```
   git clone <URL_DEL_REPOSITORIO>
   ```

2. Navega al directorio del proyecto:
   ```
   cd Assistant-server
   ```

3. Instala las dependencias:
   ```
   npm install
   ```

4. Crea un archivo `.env` en la raíz del proyecto y agrega tus variables de entorno, como las claves de API necesarias.

## Uso

1. Inicia el servidor:
   ```
   npm start
   ```

2. Accede a la aplicación en tu navegador en `http://localhost:3000`.

## Contribuciones

Las contribuciones son bienvenidas. Si deseas contribuir, por favor abre un issue o envía un pull request.

## Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo LICENSE para más detalles.
