# Entrega de Relay para pruebas internas

Fecha de actualización: 10 de octubre de 2026

Esta entrega permite probar captación, almacenamiento durable, precalificación y
sincronización simulada del CRM. Es una versión en desarrollo para revisión del
equipo; la telefonía y las integraciones reales todavía requieren implementación
o validación. El objetivo es convertir solicitudes en candidatos trazables y
priorizados para revisión humana.

## Explicación para el jefe

Estamos construyendo el sistema de captación y precalificación solicitado por
Relay. Ya tenemos un formulario bilingüe y una arquitectura que primero guarda
la solicitud en PostgreSQL. Después, un worker pide la clasificación a n8n y
sincroniza la información con GoHighLevel. Así, una caída del CRM o de n8n no
obliga al candidato a volver a enviar sus datos.

La entrega incluye código, un workflow importable, migraciones, pruebas y una
configuración Docker para que el equipo ejecute el mismo entorno. Actualmente
GHL se simula en desarrollo. El recorrido completo ya se confirmó en local; el
siguiente hito es conectar una ubicación de pruebas de la empresa. Después se
implementan y validan telefonía, resultados y notificaciones al reclutador.

## Avances y evidencia

| Componente | Avance | Evidencia y límite |
| --- | --- | --- |
| Formulario EN/ES | Implementado | La captura compartida muestra solicitud recibida |
| Validación y normalización | Implementadas | Validación de formulario/API, teléfono estadounidense y ZIP |
| Almacenamiento durable | Implementado | Solicitud y tarea en una transacción; éxito después del commit |
| Cola de procesamiento | Implementada | Clasificación y CRM; reintentos, lease y recuperación manual |
| Idempotencia | Implementada por envío | Mismo eventId y respuestas conservan applicationId; no es deduplicación universal de personas |
| Clasificación n8n | Workflow de seis nodos importado y publicado en la instancia local | Lee una vista PostgreSQL de solo lectura; reglas WH-001 son ejemplos |
| GHL | Cliente implementado después de clasificación | Modo local mock; sin validación con cuenta real de Relay |
| Docker Compose | Entorno local levantado y recorrido completo validado | Web y base listas; worker procesó clasificación y sincronización simulada |
| Pruebas automáticas | 27 resultados aprobados el 10 de octubre de 2026 | 19 unitarias y 8 de integración con PostgreSQL embebido; no sustituyen PostgreSQL nativo/GHL real |
| Lint y build | Aprobados el 10 de octubre de 2026 | Next.js compiló las rutas web y API; no implica aceptación de producción |

## Validación más reciente

El 10 de octubre de 2026 se ejecutaron desde `web` los siguientes controles:

```text
npm test                  19/19 aprobados
npm run test:integration   8/8 aprobados
npm run lint               aprobado
npm run build              aprobado
npm run workflow:build     workflow regenerado
docker compose ... config  configuración válida
```

La prueba de integración HTTP necesita conexiones locales a `127.0.0.1`; se
ejecutó fuera del aislamiento de herramientas y completó los ocho casos. También
se levantó el entorno Docker, se verificaron `/api/health` y `/api/ready`, y se
publicó el workflow local de n8n. Los trabajos de demostración terminaron con
`classify=done` y generaron `sync_ghl=done` en modo mock. Las ejecuciones 10 y 11
del workflow estable quedaron guardadas en n8n con estado `success`; la cola quedó sin
trabajos `pending`, `processing` o `dead`.

Esta validación usa datos ficticios y no autoriza candidatos o credenciales
reales. n8n funciona actualmente con el volumen existente de PostgreSQL 16 y
emite una advertencia de compatibilidad; conviene migrarlo a PostgreSQL 17 en un
hito posterior y con copia de respaldo, sin hacerlo durante la demostración.

## Arquitectura

```text
Candidato → Next.js → PostgreSQL Relay: solicitud y trabajo pendiente
                                  ↓
                             relay-worker
                                  ↓
                  n8n consulta vista PostgreSQL
                                  ↓
                            n8n clasifica
                                  ↓
                    PostgreSQL guarda clasificación
                                  ↓
                       relay-worker sincroniza GHL
```

La base interna de n8n y la de Relay son independientes. GoHighLevel sigue siendo
un SaaS externo y el espacio operativo del reclutador. La cola vigente no ejecuta
llamadas. Las decisiones finales de contratación corresponden al equipo humano.

## Ejecución completa con Docker desde Git Bash

Requisitos: Docker Desktop instalado y activo, Docker Compose v2, Git Bash y
acceso a Internet para descargar imágenes/dependencias. No requiere npm ni Node
instalados en el equipo anfitrión para esta modalidad.

Clonar o abrir el repositorio y ejecutar los comandos desde la carpeta raíz que
contiene `docker-compose.yml`. En esta máquina, la ruta es:

```bash
cd /c/dev/practicas/relay-solicitudes
```

En cualquier otra ubicación, entrar a la carpeta que contiene docker-compose.yml.

```bash
if [ ! -f .env.dev ]; then
  cp .env.dev.example .env.dev
fi

docker compose --env-file .env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  up -d --build
```

La primera ejecución descarga imágenes y puede tardar varios minutos.

```bash
docker compose --env-file .env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  ps -a
```

Los servicios permanentes deben estar Up y las bases healthy. relay-migrate debe
terminar en Exited (0): aplica el esquema y finaliza normalmente.

| Servicio | Acceso local |
| --- | --- |
| Formulario | http://localhost:3000/warehouse-associate?lang=es |
| Editor n8n | http://localhost:5679 |
| PostgreSQL Relay | 127.0.0.1:5434, base relay, usuario relay, contraseña de .env.dev |
| Redis | 127.0.0.1:6380 |
| PostgreSQL n8n | Interno a Docker; sin puerto publicado |

## Configurar n8n

1. Abrir localhost:5679 y crear el usuario de la instancia local.
2. Importar n8n/workflows/relay-classify.json.
3. Crear una credencial Header Auth llamada `Relay webhook secret`:
   Name=x-relay-secret y Value igual a N8N_WEBHOOK_SECRET de .env.dev. El
   workflow ya referencia esa credencial; el JSON no contiene su valor. El
   archivo de ejemplo usa un secreto exclusivamente local.
4. Crear una credencial Postgres llamada `Relay PostgreSQL read-only`: host
   `relay-postgres`, base `relay`, usuario `relay_n8n_reader`, puerto 5432, SSL
   desactivado y Value igual a RELAY_N8N_DB_PASSWORD de .env.dev.
5. Verificar POST, path relay-classify y respuesta mediante Respond to Webhook.
6. Guardar y publicar/activar el workflow. El worker llama /webhook/relay-classify.
   La opción Ejecutar flujo espera /webhook-test/... y no sustituye la publicación.

El flujo visible contiene Solicitud, Buscar lead en PostgreSQL, Validar candidato,
Calcular puntaje, Preparar siguiente paso y Devolver clasificación.

## Desarrollo web con recarga

Para ejecutar Next.js fuera de Docker, mantén en Docker las bases, Redis, n8n y
las migraciones:

```bash
docker compose --env-file .env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  up -d --build postgres relay-postgres redis n8n relay-migrate

cd web
if [ ! -f .env.local ]; then cp .env.example .env.local; fi
npm ci
npm run dev
```

En una segunda terminal, desde `web`, ejecuta `npm run worker`. Confirma que
`web/.env.local` use los puertos publicados por el override local: PostgreSQL
Relay `5434`, Redis `6380` y n8n `5679`. Las contraseñas de Relay y el secreto
de n8n deben coincidir con `.env.dev`. No uses estos valores de ejemplo en otros
ambientes.

## Demostración sugerida

Enviar una solicitud ficticia por el formulario y mostrar el mensaje de recepción.
Consultar las tareas:

```bash
docker compose --env-file .env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  exec relay-worker node scripts/jobs.mjs status
```

El resultado esperado es classify=done y sync_ghl=done. En modo local, el estado
CRM en la base es mocked: no se crea un contacto real ni se hace una llamada.
Si una tarea está pending se reintenta sola; si está dead, primero corregir la
causa y recuperar su ID concreto:

```bash
docker compose --env-file .env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  exec relay-worker node scripts/jobs.mjs retry ID
```

Consultar logs sin reenviar el formulario:

```bash
docker compose --env-file .env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  logs --tail=100 relay-worker
```

Detener conservando los volúmenes:

```bash
docker compose --env-file .env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  down
```

No añadir -v si se desea conservar solicitudes y configuración n8n.

## Pendientes y decisiones requeridas de Relay

- Confirmar campos y criterios por vacante: radios, requisitos, score y motivos.
- Aprobar consentimiento, privacidad, retención y reglas de contacto.
- Facilitar ubicación GHL de pruebas y token con contacts.read/contacts.write;
  confirmar política de duplicados, campos, pipeline, etapas y responsables.
- Elegir Retell o Vapi, número telefónico y guion de entrevista.
- Implementar cola de llamadas, límites de costo, cadencia y exclusión no-contacto.
- Implementar resultados, oportunidades en GHL y notificación al reclutador.
- Completar pruebas conjuntas con PostgreSQL nativo, GHL real y fallos controlados.
- Definir servidor/dominio, monitoreo, respaldos y restauración antes de producción.

## Contenido de la entrega

El ZIP incluye fuentes web/worker, package-lock.json, migraciones, pruebas,
workflow n8n, Dockerfiles, Compose, Caddyfile y documentación. Contiene únicamente
archivos de ejemplo de configuración; no incluye .env, .env.dev, .env.local,
node_modules, .next, volúmenes Docker, .git ni el antiguo web.zip.

La información privada de despliegue debe configurarse por separado. `README.md`,
`docs/arquitectura.md`, `docs/PRESENTACION.md` y `docs/GUIA-DEMO.md` describen
la versión actual y el recorrido de demostración.

La propuesta acotada para formulario administrado en GHL y entrevistas por voz
está en `docs/propuesta-ghl-n8n-retell.md`. Es una fase posterior y no forma parte
del recorrido validado de esta entrega.
