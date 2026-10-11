# Arquitectura de recepción durable de Relay

## Responsabilidades

Next.js valida nombre, correo, teléfono estadounidense, ZIP, respuestas y
consentimiento. Construye el registro, guarda solicitud y tarea en una transacción
y responde 202. El éxito significa recepción durable, no clasificación terminada
ni contacto realizado. Si falla PostgreSQL responde 503 sin aceptar el envío.

Antes de validar, la API consume un contador compartido en Redis. La clave contiene
un hash de la IP, no la IP en texto. En producción también exige un token Turnstile
validado directamente con Cloudflare. Si Redis o la validación no están disponibles,
la recepción falla de forma controlada y no omite la protección. PgBouncer usa modo
transaction y limita las conexiones abiertas hacia PostgreSQL cuando hay varias webs.

`relay-worker` consulta tareas cada cinco segundos. Reclama una tarea usando
`FOR UPDATE SKIP LOCKED`, un token de propietario y un lease de 120 segundos.
Las llamadas externas tienen timeout y se hacen fuera de la transacción. La
confirmación comprueba que el worker conserva su lease; un worker antiguo no
puede sobrescribir el resultado de una tarea ya reclamada por otro.

n8n recibe un contrato autenticado con el ID y las reglas. Consulta al candidato
en `relay_n8n_candidates` mediante `relay_n8n_reader`, un usuario sin permisos de
escritura, y calcula distancia, elegibilidad y score. No crea contactos en este
workflow. El worker guarda el resultado y la tarea CRM en una segunda transacción.
Luego sincroniza GHL. Así un fallo del CRM no vuelve a ejecutar la clasificación.

Esta implementación centraliza los efectos externos del CRM en el worker para
hacerlos recuperables; n8n conserva las reglas de negocio. Las futuras llamadas,
resultados y notificaciones se pueden agregar como nuevos tipos de tarea sin
cambiar la recepción del formulario.

## Persistencia

| Tabla de la base Relay | Contenido |
| --- | --- |
| relay_applications | Payload original, hash del envío, clasificación, estado, IDs CRM |
| relay_jobs | Tareas classify/sync_ghl, intentos, fecha, lease y código de error |
| relay_events | Historial received/classified/crm_synced/job_retry/job_dead/manual_retry |
| relay_migrations | Migraciones aplicadas |
| relay_n8n_candidates | Vista limitada que n8n puede consultar, sin metadatos técnicos |

El payload conserva datos técnicos y consentimiento en la base Relay. La nota
GHL contiene datos del candidato, respuestas, consentimiento, atribución y
clasificación, sin IP ni user-agent. Definir con Relay retención, accesos y borrado
para ambos sistemas. Los logs de aplicación no imprimen el payload ni respuestas
remotas. La configuración base de n8n no guarda ejecuciones exitosas. El override
local sí las guarda para demostrar el recorrido con datos ficticios.

La base de Relay y la interna de n8n usan contenedores, roles y volúmenes
separados. `relay_pg_data` es nuevo. Se conservan `pg_data` y `n8n_data` existentes;
no cambiar de versión mayor ni borrar volúmenes para aplicar esta arquitectura.

## Contratos

POST /api/apply mantiene los campos de entrada del formulario. `eventId` es la
clave idempotente del envío. Respuesta después del commit:

```json
{"ok":true,"applicationId":"UUID estable","duplicate":false}
```

HTTP 202. El mismo eventId y las mismas respuestas devuelven el ID anterior.
Si el candidato cambia sus respuestas con ese eventId, devuelve 409/conflict;
el formulario renueva la clave y permite registrar el nuevo envío. Las fechas,
IP y atribución variable no alteran la identidad de un reintento.

El worker envía a /webhook/relay-classify `schemaVersion`, `applicationId` y
`reglas`, obtenidas del archivo servidor `web/src/config/prequalification.json`.
El navegador no puede elegir esas reglas. n8n carga el payload desde PostgreSQL y
debe devolver:

```json
{
  "applicationId":"el mismo UUID recibido",
  "estado":"precalificado",
  "score":100,
  "distanciaMi":0,
  "motivos":[],
  "rulesVersion":"WH-001-example-v1"
}
```

Estados admitidos: precalificado, revision, no_elegible. Un HTTP 200 con `{ok:true}`
o con otro applicationId no completa la tarea: se registra un fallo y se reintenta.
Las reglas incluidas conservan el ejemplo anterior; `minScore=0` no impone un
umbral adicional. Relay debe aprobar radios, puntos y umbral antes de campañas.

## Recuperación e idempotencia

Solicitud y tarea inicial se guardan juntas. El worker consulta la base: no depende
de un aviso HTTP que pueda perderse. Los fallos se reintentan con espera exponencial
hasta ocho intentos por defecto; después quedan en `dead` para revisión manual.
Una caída deja el lease pendiente; al vencer puede recuperarse. Los IDs y errores
seguros son visibles con `npm run jobs` o el comando Docker equivalente.

Hay una sola tarea de cada tipo por solicitud. El ID GHL se guarda después del
upsert para reusarlo en reintentos. Antes de crear una nota se consultan las notas
del contacto buscando `[relay-application:UUID]`. Esto permite recuperar una nota
creada cuya respuesta se perdió. Requiere permisos `contacts.read` y `contacts.write`.

Los efectos externos son al menos una vez; no se promete exactamente una vez.
Si GHL demora en mostrar una nota recién creada o se solapan workers tras vencer
un lease, aún podría haber duplicados remotos. El upsert depende también de la
configuración de duplicados de la ubicación GHL. No activar automatizaciones de
llamada basadas únicamente en un upsert repetido.

La idempotencia cubre un mismo envío, no todas las postulaciones de una persona.
Un contacto puede tener solicitudes de distintas vacantes. Las etiquetas de
estado se agregan por vacante y expresan historial; la nota es la fuente del estado
de cada solicitud, no una única etiqueta de estado actual para todo el contacto.

## Alcance vigente

La API guarda todas las solicitudes válidas. n8n clasifica y el worker sincroniza
todos los resultados con GHL; no elimina silenciosamente los no elegibles.
Todavía no crea oportunidades ni asigna responsables, pues faltan los IDs y
reglas de la empresa. Los scripts de ventana y resultado de llamada son piezas
para la fase posterior, no servicios activados.

Meta Pixel/CAPI mide la recepción durable, no la calificación. CAPI es opcional
y de mejor esfuerzo mediante `after`; no forma parte de la transacción ni de
los reintentos de la cola.
