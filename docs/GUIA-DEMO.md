# Guía de demostración — Relay Solicitudes

Duración sugerida: 7 minutos.

Usa únicamente candidatos ficticios. Mantén cerrados los archivos `.env` y no
muestres credenciales, tokens o contraseñas durante la presentación.

## 1. Preparación previa

Desde `C:\dev\practicas\relay-solicitudes`:

```powershell
if (!(Test-Path .env.dev)) { Copy-Item .env.dev.example .env.dev }
docker compose --env-file .env.dev `
  -f docker-compose.yml `
  -f docker-compose.dev.yml `
  up -d --build
```

Comprueba los servicios:

```powershell
docker compose --env-file .env.dev `
  -f docker-compose.yml `
  -f docker-compose.dev.yml `
  ps -a
```

Los servicios permanentes deben estar `Up`; las bases, PgBouncer, Redis y web
deben aparecer saludables. `relay-migrate` debe terminar con código 0.

En una instalación nueva de n8n:

1. Abre `http://localhost:5678` y crea el usuario propietario local.
2. Importa `n8n/workflows/relay-classify.json`.
3. Crea `Relay webhook secret` como credencial Header Auth:
   - Name: `x-relay-secret`
   - Value: `N8N_WEBHOOK_SECRET` de `.env.dev`.
4. Crea `Relay PostgreSQL read-only` como credencial Postgres:
   - Host: `relay-postgres`
   - Database: `relay`
   - User: `relay_n8n_reader`
   - Password: `RELAY_N8N_DB_PASSWORD` de `.env.dev`
   - Port: `5432`
   - SSL: desactivado.
5. Publica el workflow.

## 2. Pestañas que deben estar preparadas

- Formulario: `http://localhost:3000/warehouse-associate?lang=es`
- Workflow: `http://localhost:5678`
- Terminal en la raíz del proyecto.
- Este documento abierto como guion.

## 3. Introducción — 45 segundos

Mensaje sugerido:

> El prototipo recibe candidatos en español o inglés y guarda primero la
> solicitud en PostgreSQL. Después, un worker confiable solicita la clasificación
> a n8n. Si n8n o el CRM están temporalmente fuera de servicio, el candidato no
> tiene que volver a completar el formulario.

## 4. Enviar un candidato — 1 minuto

Completa el formulario con datos ficticios reconocibles:

```text
Nombre: Candidato Presentación
Correo: presentacion@example.com
Teléfono: +1 919 555 0123
ZIP: 27601
Horario: tarde
Autorización: sí
Transporte: sí
Disponibilidad: tiempo completo
Experiencia: 1–3 años
```

Muestra el mensaje de recepción y explica:

> Este mensaje confirma almacenamiento durable y creación del trabajo. Todavía
> no significa que GHL o una llamada real hayan terminado.

## 5. Mostrar la ejecución de n8n — 2 minutos

1. Abre **Ejecuciones**.
2. Selecciona la ejecución más reciente con estado `success`.
3. Recorre los nodos de izquierda a derecha:
   - Solicitud
   - Buscar lead en PostgreSQL
   - Validar candidato
   - Calcular puntaje
   - Preparar siguiente paso
   - Devolver clasificación
4. En **Buscar lead en PostgreSQL**, explica que la cuenta es de solo lectura.
5. En **Preparar siguiente paso**, muestra `siguienteAccion` y
   `ventanaPreferida`.

Mensaje sugerido:

> n8n recibe el identificador, busca el candidato en una vista limitada y aplica
> reglas visibles. La respuesta vuelve al worker, que guarda el resultado y
> controla reintentos.

## 6. Mostrar la cola — 1 minuto

Ejecuta:

```powershell
docker compose --env-file .env.dev `
  -f docker-compose.yml `
  -f docker-compose.dev.yml `
  exec relay-worker node scripts/jobs.mjs status
```

Busca los últimos registros:

```text
classify   done
sync_ghl   done
```

Aclara que `sync_ghl=done` usa el modo `mock` de desarrollo y no crea un contacto
real.

## 7. Explicar el alcance — 1 minuto

### Funciona actualmente

- Recepción bilingüe.
- Validación y normalización.
- Persistencia PostgreSQL.
- Cola, leases y reintentos.
- Clasificación visible en n8n.
- Preparación del siguiente paso.
- Simulación de sincronización GHL.

### Requiere participación de la empresa

- Reglas aprobadas por vacante.
- Consentimiento aprobado.
- Cuenta GHL de pruebas.
- Pipeline y responsables.
- Proveedor de voz, número y guion.
- Política de horarios, reintentos y costos.

## 8. Cierre — 30 segundos

> La base técnica ya demuestra que una solicitud no se pierde y que la decisión
> de automatización es visible y recuperable. El siguiente paso es validar GHL en
> una cuenta de pruebas y después incorporar llamadas bajo reglas aprobadas.

## 9. Recuperación rápida durante la demostración

### La web no abre

```powershell
docker compose --env-file .env.dev `
  -f docker-compose.yml `
  -f docker-compose.dev.yml `
  ps -a
```

### n8n no muestra ejecución

- Confirma que el workflow diga **Publicado**.
- Revisa que las dos credenciales estén seleccionadas.
- Espera cinco segundos y actualiza **Ejecuciones**.
- Consulta la cola para identificar `n8n_http_error` o `n8n_unavailable`.

### Una tarea quedó `dead`

Después de corregir la causa:

```powershell
docker compose --env-file .env.dev `
  -f docker-compose.yml `
  -f docker-compose.dev.yml `
  exec relay-worker node scripts/jobs.mjs retry ID
```

### Detener sin borrar datos

```powershell
docker compose --env-file .env.dev `
  -f docker-compose.yml `
  -f docker-compose.dev.yml `
  down
```

No agregues `-v`: eliminaría las bases y la configuración local de n8n.
