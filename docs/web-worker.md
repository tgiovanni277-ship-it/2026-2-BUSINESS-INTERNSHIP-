# Aplicación web y worker

Next.js recibe postulaciones y las guarda en PostgreSQL. La API no llama a GHL
ni a n8n. El worker procesa la cola durable, pide la clasificación a n8n y
sincroniza GHL después de guardar ese resultado.

## Desarrollo local fuera de Docker

Usa Node.js 22 o posterior. Copia `web/.env.example` a `web/.env.local` y
mantén las credenciales locales fuera de Git. Para conectarte al entorno
publicado por `docker-compose.dev.yml`, usa PostgreSQL Relay en `5434`, Redis
en `6380` y n8n en `5679`. Las contraseñas de Relay y el secreto n8n deben
coincidir con `.env.dev`.

Desde Git Bash:

```bash
cd web
npm ci
npm run dev
```

En otra terminal, ejecuta el worker:

```bash
cd web
npm run worker
```

## Comandos disponibles

- `npm run db:migrate`: aplica migraciones idempotentes a la base Relay.
- `npm run worker`: procesa tareas pendientes con reintentos.
- `npm run jobs`: muestra tareas sin imprimir datos de candidatos.
- `npm run jobs -- retry ID`: recupera una tarea agotada.
- `npm run workflow:build`: genera el JSON importable desde `n8n/score.js`.
- `npm test`: pruebas unitarias.
- `npm run test:integration`: pruebas de almacenamiento y recuperación; usa PGlite por defecto o PostgreSQL nativo mediante `RELAY_TEST_DATABASE_URL`.
- `npm run lint` y `npm run build`: revisión de estilo y compilación.

## Contratos y secretos

`GET /api/health` comprueba el proceso. `GET /api/ready` comprueba la base y
el esquema. `POST /api/apply` responde HTTP 202 después del guardado durable.

Las credenciales GHL y el secreto n8n se usan en el worker, nunca en el
navegador. Los contenedores web y worker tienen entornos separados;
`.env.local` combina variables únicamente para desarrollo local.
