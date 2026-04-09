// src/server.js
// Este archivo es responsable de iniciar el servidor y escuchar en un puerto especificado.

const app = require('./app'); // Importa la aplicación Express desde app.js
const dotenv = require('dotenv'); // Importa dotenv para manejar variables de entorno
const { verifyToken, refreshToken, initializeTokensFromEnv } = require('./services/refreshTokenKommo'); // Importa las funciones desde refreshTokenKommo.js
const { initializeKommoSession, refreshKommoSession } = require('./services/kommoSessionService');

dotenv.config(); // Carga las variables de entorno desde el archivo .env

const port = process.env.PORT || 3000; // Establece el puerto, usando el valor de la variable de entorno o 3000 por defecto

async function bootstrap() {
  try {
    // 1) Inicializar tokens desde .env (solo la primera vez) y renovar si están vencidos
    await initializeTokensFromEnv();
    const isValid = await verifyToken();
    if (!isValid) {
      await refreshToken();
      console.log('Token OAuth de Kommo renovado al iniciar servidor.');
    } else {
      console.log('Token OAuth de Kommo válido al iniciar servidor.');
    }

    // 2) Inicializar sesión web de Kommo al arranque
    await initializeKommoSession();
    console.log('Sesión web de Kommo inicializada al iniciar servidor.');

    // 3) Configurar renovación periódica de token OAuth
    const refreshInterval = 22 * 60 * 60 * 1000; // 22 horas en milisegundos
    setInterval(() => {
      refreshToken().catch(error => {
        console.error('Error al actualizar el token automáticamente:', error);
      });
    }, refreshInterval);

    // 4) Configurar renovación periódica de sesión web
    const sessionRefreshInterval = 40 * 60 * 60 * 1000; // 40 horas en milisegundos
    setInterval(() => {
      refreshKommoSession(process.env.SUBDOMINIO).catch(error => {
        console.error('Error al refrescar la sesión de Kommo automáticamente:', error);
      });
    }, sessionRefreshInterval);

    // 5) Iniciar servidor solo cuando token + sesión estén listos
    app.listen(port, () => {
      console.log(`Servidor escuchando en el puerto ${port}`);
    });
  } catch (error) {
    console.error('Error crítico durante el arranque del servidor:', error);
    process.exit(1);
  }
}

bootstrap();