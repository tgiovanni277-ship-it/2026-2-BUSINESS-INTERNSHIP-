# Web y worker de Relay

Next.js recibe postulaciones y las guarda en PostgreSQL. La API no llama a GHL
ni a n8n. El worker procesa la cola durable, pide la clasificación a n8n y
sincroniza GHL después de guardar ese resultado.

Consulta `../README.md` para levantar bases, n8n y web con Docker Compose,
e importar el workflow autenticado.

Para desarrollo fuera de Docker, configura las variables de `.env.example` en
`.env.local` (conserva las existentes y agrega las nuevas). Arranca `npm run dev`
y, en otra terminal, `npm run worker`. Node 22+; base Relay local en puerto 5433.

Comandos disponibles:

- `npm run db:migrate`: aplica migraciones idempotentes a la base Relay.
- `npm run worker`: procesa tareas pendientes con reintentos.
- `npm run jobs`: muestra tareas sin imprimir datos de candidatos.
- `npm run jobs -- retry ID`: recupera una tarea agotada.
- `npm run workflow:build`: genera el JSON importable desde `../n8n/score.js`.
- `npm test`: contratos, reglas, GHL e ingreso.
- `npm run test:integration`: almacenamiento SQL y recuperación; PGlite por defecto,
  o PostgreSQL nativo mediante `RELAY_TEST_DATABASE_URL`.
- `npm run lint` y `npm run build`: verificaciones de código y compilación.

GET /api/health comprueba el proceso. GET /api/ready comprueba la base y esquema.
POST /api/apply responde 202 únicamente después del guardado durable.

Las credenciales GHL y el secreto n8n se usan en el worker, nunca en el navegador.
Los contenedores web y worker tienen entornos separados; `.env.local` combina
las variables únicamente para desarrollo local.
