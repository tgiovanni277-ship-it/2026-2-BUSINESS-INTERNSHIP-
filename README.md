# Relay Workforce Group

Captación bilingüe de candidatos con almacenamiento durable en PostgreSQL,
precalificación en n8n y sincronización posterior con GoHighLevel.

## Arquitectura actual

```text
Formulario → Caddy/Cloudflare → Next.js (réplicas) → Redis (rate limit)
                                      ↓
                                  PgBouncer
                                      ↓
                 PostgreSQL Relay (solicitud + trabajo pendiente)
                                      ↓
                                 relay-worker
                              ↓
                  n8n → vista PostgreSQL de solo lectura
                              ↓
                     n8n: precalificación
                              ↓
                 PostgreSQL: resultado + tarea CRM
                              ↓
                    relay-worker → GoHighLevel
```

La API confirma con HTTP 202 después de guardar en PostgreSQL. No llama a GHL
ni a n8n. El worker recoge tareas persistentes y maneja reintentos. Envía a n8n
el ID de la solicitud y las reglas; n8n consulta una vista PostgreSQL de solo
lectura, calcula la clasificación y devuelve un contrato validado. El worker
persiste el resultado antes de sincronizar el contacto y la nota de solicitud en
GHL. Todos los estados se sincronizan, incluyendo revisión y no elegible. No se
ejecutan llamadas reales.

Se usan dos PostgreSQL aislados: `postgres` mantiene n8n y su volumen existente;
`relay-postgres` mantiene solicitudes, tareas y auditoría de Relay. La web no
recibe credenciales GHL ni el secreto n8n. El worker sí recibe esas credenciales.
Redis comparte el límite de envíos entre réplicas y PgBouncer protege las conexiones
de PostgreSQL. Redis no guarda leads y puede reiniciarse sin perder solicitudes.

## Inicio local sin cuentas de la empresa

Requisitos: Docker Compose v2 y, para desarrollar la web fuera de Docker, Node 22+.
No sobrescribas un `.env` existente: utiliza el archivo local separado `.env.dev`.

```powershell
if (!(Test-Path .env.dev)) { Copy-Item .env.dev.example .env.dev }
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Abre http://localhost:5678, crea el usuario local e importa
`n8n/workflows/relay-classify.json`. En el nodo **Solicitud**, configura una
credencial **Header Auth** con nombre `x-relay-secret` y el valor de
`N8N_WEBHOOK_SECRET` de `.env.dev`. Configura además la credencial PostgreSQL
**Relay PostgreSQL read-only** con host `relay-postgres`, base `relay`, usuario
`relay_n8n_reader`, puerto `5432`, SSL desactivado y la contraseña
`RELAY_N8N_DB_PASSWORD`. Publica/activa el workflow para atender
`/webhook/relay-classify`. El webhook exige autenticación y no trae secretos exportados.

Abre http://localhost:3000/warehouse-associate?lang=es y envía datos ficticios.
Compose ejecuta las migraciones antes de iniciar la web y el worker. En desarrollo
GHL es simulado: la base registra `crm_status=mocked`, nunca un éxito real de GHL.
En el override de desarrollo, las ejecuciones exitosas quedan visibles en la
pestaña **Ejecuciones** de n8n; la configuración base no las conserva.
Las tareas que fallaron mientras se configuraba n8n se reintentan automáticamente;
si agotaron sus intentos, usa el comando de recuperación indicado abajo.

## Desarrollo con recarga de Next.js

Levanta únicamente las bases, n8n y migraciones:

```powershell
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml up -d --build postgres relay-postgres n8n relay-migrate
cd web
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm ci
npm run dev
```

Ajusta `RELAY_DB_PASSWORD` y `N8N_WEBHOOK_SECRET` en `web/.env.local` para que
coincidan con `.env.dev`. En una segunda terminal dentro de `web`, ejecuta
`npm run worker`. Las variables de los contenedores y las locales tienen hosts
diferentes: contenedor usa `relay-postgres`/`n8n`; npm usa `127.0.0.1`.

## Verificación y operaciones

Desde `web`:

```powershell
npm test
npm run test:integration
npm run lint
npm run build
npm run workflow:build
```

Las pruebas de integración ejecutan SQL en PostgreSQL embebido (PGlite) sin Docker.
Para probar contra un PostgreSQL nativo configura `RELAY_TEST_DATABASE_URL` con
una base de pruebas: el test crea y elimina un esquema temporal propio.
No uses credenciales de producción para pruebas.

Operaciones desde la raíz:

```powershell
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml exec relay-worker node scripts/jobs.mjs status
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml exec relay-worker node scripts/jobs.mjs retry 123
```

El segundo comando recupera únicamente una tarea `dead`, con su mismo ID de
solicitud. `123` es un ejemplo: consulta el ID real con `status`.

## Preparación para campañas

El override de campaña inicia dos webs y dos workers. No se combina con el override
de desarrollo porque este publica un único puerto web local:

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.campaign.yml --profile production up -d --build
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.campaign.yml ps
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.campaign.yml exec relay-worker node scripts/jobs.mjs status
```

Esto aumenta capacidad, pero una sola máquina sigue siendo un punto único de falla.
Para alta disponibilidad se necesitan balanceador, PostgreSQL y Redis administrados,
y réplicas en hosts distintos. Consulta `docs/campanas-y-capacidad.md` antes de
activar tráfico real.

## Documentación y pendientes

- `docs/Manual-Relay-Solicitudes.docx`: manual completo de usuario, operación y desarrollo.
- `docs/PRESENTACION.md`: resumen ejecutivo, alcance, evidencia y decisiones requeridas.
- docs/Relay-Solicitudes-Presentacion.pptx: presentación ejecutiva editable de siete diapositivas.
- `docs/GUIA-DEMO.md`: guion de siete minutos y recuperación rápida.
- docs/VALIDACION.md: resultados reproducibles de pruebas, lint y compilación.
- `docs/arquitectura.md`: modelo de datos, contratos, idempotencia y límites.
- `docs/pruebas-y-despliegue.md`: pruebas del equipo, migraciones, staging y respaldos.
- `docs/propuesta-ghl-n8n-retell.md`: alcance propuesto para formulario GHL y llamadas de la siguiente fase.
- `n8n/README.md`: importación del workflow y scripts de futuras llamadas.

Quedan pendientes la aprobación de reglas/consentimiento, credenciales reales,
pipeline y campos GHL, cola de telefonía, Retell/Vapi y notificaciones. La cola
implementada procesa clasificación y CRM; no es aún una cola de llamadas.

## Entrega al equipo

Empieza por `docs/PRESENTACION.md` y utiliza `docs/GUIA-DEMO.md` durante la
demostración. `docs/entrega-al-equipo.md` conserva el detalle operativo.
