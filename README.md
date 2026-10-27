
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

### Chrome: `Resource temporarily unavailable (11)` / `EAGAIN`

Este error ocurre al crear un proceso o hilo del navegador, antes del login de
Kommo. No demuestra un error de credenciales. Puede deberse a límites de PIDs,
hilos, memoria o procesos del usuario; confirma la causa con las métricas del
contenedor. Al agotar cuatro intentos, el servicio registra PIDs/memoria de
cgroup, límites del proceso y el nombre de PID 1 (cuando esos archivos existen).
Después espera 60 segundos antes de permitir un nuevo ciclo. La deduplicación,
la cola de navegadores y esa pausa son por proceso Node; no coordinan réplicas.

En el contenedor Linux afectado, comprueba:

```sh
cat /sys/fs/cgroup/pids.current /sys/fs/cgroup/pids.max
cat /sys/fs/cgroup/pids.events
cat /sys/fs/cgroup/memory.current /sys/fs/cgroup/memory.max
cat /sys/fs/cgroup/memory.events
cat /proc/1/comm
ps -eo pid,ppid,stat,comm
```

Las rutas anteriores corresponden a cgroup v2; en v1 revisa el controlador
`/sys/fs/cgroup/pids/`. Si hay procesos Chrome huérfanos/zombis acumulados,
reinicia el contenedor afectado para recuperarlo y configura un init que recoja
hijos: `docker run --init ...` o `init: true` en el servicio de Docker Compose.
Si lo que se agota es un límite de PIDs o memoria, ajusta los recursos según las
métricas. El cooldown contiene los reintentos; no libera recursos ya agotados.
Referencia: [Puppeteer: troubleshooting](https://pptr.dev/troubleshooting).

`POST /api/session/refresh` devuelve HTTP 503 con `Retry-After` cuando Chrome no
puede arrancar por recursos agotados. Los clientes deben respetar esa pausa.
Un fallo al iniciar/enviar el salesbot se propaga y no dispara el bot posterior.
No reproduzcas automáticamente mensajes de clientes afectados: verifica primero
en Kommo si se ejecutó el envío para evitar duplicados.

Las contribuciones son bienvenidas. Si deseas contribuir, por favor abre un issue o envía un pull request.

## Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo LICENSE para más detalles.
