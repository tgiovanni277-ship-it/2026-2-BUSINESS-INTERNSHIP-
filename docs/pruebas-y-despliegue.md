# Pruebas y despliegue de Relay

## Pruebas locales y del equipo

Primero usar `docker-compose.dev.yml` y datos ficticios. Este override publica
web, editor n8n y base Relay solo en 127.0.0.1. GHL está simulado explícitamente.
El archivo base usa GHL real por defecto; no combinar el override de desarrollo
con staging/producción. El simulador está prohibido cuando RELAY_ENV no es
development o test.

Probar recepción, validación, doble envío con la misma clave, caída de n8n,
respuesta de n8n inválida, caída de GHL, reinicio del worker y recuperación manual.
Las pruebas SQL incluidas cubren rollback, leases, reintentos y continuidad entre
clasificación y CRM. PGlite no verifica concurrencia de conexiones nativas;
repetir con RELAY_TEST_DATABASE_URL antes de aceptar un despliegue con varios workers.

Para probar integración real, usar una ubicación GHL de pruebas y su token
contacts.read/contacts.write. Revisar las automatizaciones de esa ubicación antes
de crear contactos. Mantener llamadas reales deshabilitadas: esta versión no
implementa Retell/Vapi ni notificaciones.

## Staging y producción

Copiar .env.example a un archivo privado del ambiente, completar contraseñas,
secretos y credenciales, y usar un nombre de proyecto distinto para aislar volúmenes:

```powershell
docker compose --env-file .env.staging -p relay-staging --profile production config --quiet
docker compose --env-file .env.staging -p relay-staging --profile production up -d --build
```

Configurar DOMINIO y ADMIN_IP para Caddy. El editor n8n queda restringido por IP;
los webhooks de clasificación y su versión de prueba están bloqueados desde
Internet. El worker los llama por la red privada. La futura ruta de resultados
de telefonía requerirá su propio mecanismo de autenticación.

Importar el workflow, configurar Header Auth y publicarlo en cada instancia.
Staging y producción deben usar secretos, bases, volúmenes y cuentas/configuración
separados. RELAY_ENV=production en producción. El servicio n8n tiene versión fija
configurable: no actualizar ni degradar una instancia existente sin conocer su
versión actual, respaldarla y validar compatibilidad de workflows y base.

## Migraciones

El servicio relay-migrate termina correctamente antes de iniciar web y worker.
Las migraciones usan una transacción y un advisory lock. Para una actualización
con la base ya existente, ejecuta explícitamente:

```powershell
docker compose --env-file .env.staging -p relay-staging run --rm relay-migrate
```

Luego actualiza web y worker. Las migraciones futuras deben mantener compatibilidad
con las instancias activas durante el despliegue. No se migra el contenido de GHL
ni se importan automáticamente ejecuciones antiguas de n8n.

## Operación y respaldos

GET /api/health indica que Next.js responde. GET /api/ready comprueba conexión a
la base Relay, existencia de la tabla de solicitudes y Redis, sin revelar datos. La
readiness no garantiza que n8n/GHL estén disponibles: la recepción puede continuar
mientras sus tareas esperan.

Consultar tareas con `node scripts/jobs.mjs status` en relay-worker. Investigar
last_error antes de reactivar una tarea dead con `node scripts/jobs.mjs retry ID`.
El reintento manual conserva applicationId, contacto y clasificación. Configurar
monitoreo de cantidad/antigüedad de tareas pending y dead; no hay alertas externas
automáticas implementadas todavía.

`node scripts/jobs.mjs status` incluye `queue_summary` con cantidad y antigüedad
de trabajos no terminados. Estas dos cifras deben alimentar alertas antes de campañas.

Respaldar por separado las bases relay y n8n, así como N8N_ENCRYPTION_KEY y los
archivos privados de configuración. Preferir pg_dump en formato personalizado y
verificar restauración en un ambiente aislado. Un volumen persistente no reemplaza
un respaldo. No usar `docker compose down -v` en ambientes con datos que conservar.

## Criterio de salida

Antes de tráfico real: recorrido aprobado con GHL de pruebas, reglas y consentimiento
aprobados, pipeline definido, respaldos restaurados y procedimiento de incidentes.
La telefonía, límites de costo, cadencia, no-contacto y handoff humano requieren
su propia implementación y pruebas en la siguiente fase.
