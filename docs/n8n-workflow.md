# Workflow de n8n

El flujo vigente es **Relay - Clasificar solicitud**, exportado en
`n8n/workflows/relay-classify.json`. Recibe el ID desde el worker, busca al
candidato en una vista PostgreSQL de solo lectura, valida, clasifica, prepara
la siguiente acción y devuelve un JSON. No guarda contactos directamente ni
realiza llamadas.

## Configuración

1. Importa `n8n/workflows/relay-classify.json` en la instancia local de n8n.
2. Crea una credencial Header Auth llamada `Relay webhook secret`: nombre
   `x-relay-secret` y valor de `N8N_WEBHOOK_SECRET` del ambiente. El JSON
   referencia esa credencial por nombre e ID, pero no incluye su valor.
3. Crea una credencial Postgres llamada `Relay PostgreSQL read-only`: host
   `relay-postgres`, base `relay`, usuario `relay_n8n_reader`, puerto `5432`,
   SSL desactivado y contraseña `RELAY_N8N_DB_PASSWORD`. La migración crea
   el usuario, la vista `relay_n8n_candidates` y permisos exclusivamente
   de lectura.
4. Publica/activa el workflow para que responda en
   `/webhook/relay-classify`.
5. Conserva el contrato de respuesta del nodo **Devolver clasificación**;
   responder inmediatamente con `{ok:true}` no completa una clasificación.

Con el override local actual, abre n8n en `http://localhost:5679`. La URL
interna que usa el worker permanece `http://n8n:5678` dentro de Docker.

## Regenerar el workflow

`n8n/score.js` es la fuente del nodo **Calcular puntaje**. Recibe reglas del
worker, procedentes de `web/src/config/prequalification.json`. Después de
editar `score.js`, ejecuta desde `web`:

```bash
npm run workflow:build
```

Luego vuelve a importar o actualizar el workflow.

Las reglas `WH-001` son ejemplos y deben aprobarse con Relay. El score prioriza;
la elegibilidad se evalúa por separado. El override local guarda ejecuciones
exitosas para demostración; la configuración base no las conserva y la
auditoría durable permanece en la base Relay.

## Componentes de una fase futura

`n8n/future/ventana-llamada.js` y
`n8n/future/interpretar-resultado.js` se conservan para la siguiente fase de
telefonía. No están conectados al workflow importable. Su integración requiere
la cola de llamadas, credenciales Retell/Vapi, política de contacto y mapeo de
pipeline y notificaciones de la empresa.
