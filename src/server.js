// src/server.js
// Este archivo es responsable de iniciar el servidor y escuchar en un puerto especificado.

const app = require('./app'); // Importa la aplicación Express desde app.js
const dotenv = require('dotenv'); // Importa dotenv para manejar variables de entorno
const { verifyToken, refreshToken, initializeTokensFromEnv } = require('./services/refreshTokenKommo'); // Importa las funciones desde refreshTokenKommo.js
const { initializeKommoSession, refreshKommoSession } = require('./services/kommoSessionService');

dotenv.config(); // Carga las variables de entorno desde el archivo .env

const port = process.env.PORT || 3000; // Establece el puerto, usando el valor de la variable de entorno o 3000 por defecto

// Inicializar tokens desde .env (solo la primera vez) y verificar/actualizar si es necesario
initializeTokensFromEnv().then(() => {
  return verifyToken();
}).then(isValid => {
  if (!isValid) {
      refreshToken().catch(error => {
          console.error('Error al actualizar el token:', error);
      });
  }
}).catch(error => {
  console.error('Error durante la inicialización del token:', error);
});

// Configurar la actualización del token cada 22 horas
const refreshInterval = 22 * 60 * 60 * 1000; // 22 horas en milisegundos
setInterval(() => {
  refreshToken().catch(error => {
    console.error('Error al actualizar el token automáticamente:', error);
  });
}, refreshInterval);

// Inicializar cookies de sesión de Kommo al arrancar (Puppeteer solo si es necesario)
initializeKommoSession().catch(error => {
  console.error('Error al inicializar la sesión de Kommo:', error);
});

// Refrescar cookies de sesión cada 40 horas (antes del límite de 48h)
const sessionRefreshInterval = 40 * 60 * 60 * 1000; // 40 horas en milisegundos
setInterval(() => {
  refreshKommoSession(process.env.SUBDOMINIO).catch(error => {
    console.error('Error al refrescar la sesión de Kommo automáticamente:', error);
  });
}, sessionRefreshInterval);


// Inicia el servidor y escucha en el puerto especificado
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`); // Mensaje en consola indicando que el servidor está en funcionamiento
});