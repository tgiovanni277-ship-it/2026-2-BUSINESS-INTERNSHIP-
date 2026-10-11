# Campañas y capacidad

## Qué protege cada capa

- Cloudflare debe servir el contenido estático, aplicar WAF y limitar abuso antes de Caddy.
- Turnstile protege el formulario; `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` son obligatorias cuando `RELAY_ENV=production`.
- Redis mantiene el rate limit común a todas las réplicas. No contiene solicitudes.
- PgBouncer evita que cada réplica abra demasiadas conexiones a PostgreSQL.
- PostgreSQL confirma la solicitud y el trabajo en una transacción antes del HTTP 202.
- Los workers drenan la cola con concurrencia controlada. GHL y n8n nunca bloquean la API.

Configurar en Cloudflare una regla específica para `POST /api/apply`. El valor debe
basarse en la prueba y en el tráfico real; no usar un límite estricto por IP que pueda
bloquear redes móviles o corporativas compartidas. El límite interno es una segunda
defensa y se configura con `RATE_LIMIT_MAX` y `RATE_LIMIT_WINDOW_MS`.
En producción, `TRUST_CLOUDFLARE=true` permite usar `CF-Connecting-IP`; solo debe
activarse si el firewall del origen acepta tráfico web exclusivamente desde Cloudflare,
para impedir que un cliente directo falsifique esa cabecera.

## Prueba de carga

Instalar k6 en la máquina de pruebas y ejecutar contra el ambiente local o staging:

```bash
BASE_URL=http://localhost:3000 PAGE_RPS=40 APPLY_RPS=10 DURATION=2m k6 run tests/load/campaign.js
```

El script exige menos de 1% de errores, p95 de recepción menor a 500 ms y p99 menor
a un segundo. Sus envíos se identifican con `utm.source=load-test`; eliminarlos según
la política del ambiente. No ejecutarlo contra producción ni GHL real.

Repetir a 1x, 2x y 3x del pico esperado. Durante la prueba observar `docker stats` y:

```bash
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml exec relay-worker node scripts/jobs.mjs status
```

`queue_summary` muestra cantidad y edad de trabajos pendientes. Detener n8n durante
una ejecución y comprobar que la API continúa aceptando y que la cola se vacía al
restaurarlo. Repetir con el worker detenido. La campaña está lista cuando la cola
vuelve a cero dentro del tiempo acordado y no aparecen trabajos `dead`.

## Producción

El archivo `docker-compose.campaign.yml` es una capacidad inicial, no una cifra final.
En una sola máquina las réplicas comparten CPU, disco y la misma falla. Para campañas
críticas usar balanceador administrado, al menos dos hosts web, PostgreSQL administrado
con respaldos probados y Redis administrado. Mantener n8n y GHL detrás de la cola.
RabbitMQ se incorpora después si la medición exige colas independientes o mayor
rendimiento; PostgreSQL continúa siendo la fuente de verdad.

Alertar por HTTP 5xx/429, latencia p95, conexiones y espacio de base, cantidad y edad
de pendientes, trabajos `dead` y respuestas 429 de GHL. Definir con marketing el pico
esperado, duración, regiones y horario antes de cada campaña.
