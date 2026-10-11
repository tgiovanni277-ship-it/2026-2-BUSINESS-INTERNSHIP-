# Relay Workforce Group — Plataforma de captación de talento

Relay es una plataforma de captación y precalificación para vacantes de personal operativo. Convierte tráfico de campañas y páginas de empleo en solicitudes estructuradas, verificadas y trazables. El candidato completa un formulario breve en inglés o español; el sistema centraliza la información en GoHighLevel y permite que n8n active reglas de negocio, seguimiento humano y llamadas automatizadas con Retell AI.

La aplicación web no decide si una persona es elegible ni sustituye al reclutador. Su responsabilidad es captar datos consentidos, validarlos, normalizarlos y entregarlos con seguridad al flujo de automatización.

> **Aviso legal:** los textos de consentimiento EN/ES actuales son borradores. Relay debe obtener aprobación de su asesoría legal antes de activar campañas, SMS o llamadas de IA.

## Qué resuelve

- Página de aplicación rápida y optimizada para móvil.
- Experiencia bilingüe EN/ES sin perder lo que el candidato ha escrito al cambiar idioma.
- Validación de nombre, correo, teléfono estadounidense y ZIP de cinco dígitos.
- Teléfono normalizado a E.164 (`+1XXXXXXXXXX`) y ZIP convertido a ciudad, estado y coordenadas.
- Protección básica contra bots (honeypot) y abuso (máximo cinco intentos por IP cada diez minutos).
- Captura de atribución de marketing: `utm_*`, `fbclid` y un `eventId` para deduplicar Meta Pixel y Conversions API.
- Entrega de solicitudes a n8n mediante un webhook interno con secreto compartido.
- Base preparada para GoHighLevel, Retell AI, Caddy, PostgreSQL y n8n en un único Docker Compose.

## Arquitectura

```text
Anuncio / enlace de empleo
          |
          v
Next.js (formulario Relay EN/ES)
          |
          | valida, normaliza y sincroniza contacto con GHL
          | luego firma con x-relay-secret
          v
n8n (webhook interno / reglas por vacante)
     |                 |
     |                 +--> GoHighLevel: contacto, etiquetas, notas, pipeline
     |
     +--> Retell AI: llamada EN o ES dentro de la ventana autorizada
                         |
                         v
                    n8n: resultado y seguimiento en GHL

Servicios de infraestructura: Caddy -> Next.js / n8n, PostgreSQL -> n8n
```

### Responsabilidad de cada componente

| Componente | Responsabilidad |
| --- | --- |
| `web` / Next.js | Landing por vacante, formulario, idioma, validación, normalización, upsert del contacto GHL y entrega al webhook. |
| n8n | Reglas de scoring, radios geográficos, deduplicación operativa, avisos, orquestación de GHL y Retell. |
| GoHighLevel | CRM operativo: contactos, etiquetas, notas, pipeline y automatizaciones del reclutador. |
| Retell AI | Llamada conversacional al candidato y webhook de resultado. |
| PostgreSQL | Base de datos persistente de n8n. |
| Caddy | Proxy HTTPS, enrutamiento por subdominio y restricción del editor de n8n por IP. |
| Meta Pixel/CAPI | Medición opcional del evento `Lead`, deduplicada con el mismo `eventId`. |

## Recorrido del candidato

1. El candidato abre una ruta como `/warehouse-associate` desde una campaña o enlace.
2. La página se muestra en inglés; con `?lang=es` inicia en español. El botón de idioma actualiza los textos, sin reiniciar el formulario.
3. Completa sus datos, ZIP, disponibilidad y preguntas de la vacante.
4. Debe aceptar el consentimiento antes de enviar.
5. Next.js valida los datos y descarta silenciosamente los bots que completen el campo oculto.
6. El servidor normaliza el número y resuelve el ZIP a ubicación.
7. Si está configurada la integración GHL, Next.js crea/actualiza el contacto y agrega etiquetas sin borrar etiquetas existentes.
8. n8n recibe el payload con `ghlContactId`. Allí —y solo allí— se aplican filtros, distancias y puntajes.
9. El workflow de n8n debe usar ese mismo ID para añadir notas/pipeline y, si corresponde, programar una llamada de Retell AI.
10. El reclutador trabaja desde GoHighLevel con estados, etiquetas, transcripción y resultado de la llamada.

## Experiencia de marca

La landing usa el logo oficial de Relay y la paleta observada en su sitio corporativo:

- Azul petróleo: encabezados y texto de marca.
- Azul Relay: controles, selección y llamada a la acción.
- Naranja: acento visual y jerarquía.
- Diseño de tarjeta, contrastes altos, controles táctiles y distribución adaptable a teléfono y escritorio.

El diseño está en `web/src/features/apply/ApplyForm.jsx`, los estilos globales en `web/src/app/globals.css` y el logo en `web/public/relay-logo.png`.

## Estructura del repositorio

```text
relay/
├── web/                         # Aplicación Next.js 16
│   ├── public/relay-logo.png     # Logo corporativo
│   ├── src/app/                  # Páginas y rutas API
│   ├── src/config/vacantes.js    # Vacantes, preguntas y copys EN/ES
│   ├── src/dictionaries/         # Diccionarios de interfaz
│   ├── src/features/apply/       # Formulario, esquema y atribución
│   └── src/lib/                  # i18n, rate limit y Meta CAPI
├── n8n/                          # Scripts para nodos Code; no workflows exportados
├── docker-compose.yml            # Stack de producción
├── docker-compose.dev.yml        # Ajustes de desarrollo local para n8n
├── Caddyfile                     # Proxy y reglas de acceso
└── .env.example                  # Variables requeridas, sin secretos
```

## Manual de uso: equipo de reclutamiento

### Publicar una vacante

Las vacantes viven en `web/src/config/vacantes.js`. Cada objeto representa una landing y contiene:

- `slug`: URL pública, por ejemplo `warehouse-associate`.
- `vacanteId`: identificador estable que n8n usará en sus reglas, por ejemplo `WH-001`.
- `activa`: controla si esa ruta está disponible.
- `consentimientoVersion`: versión del texto aprobado legalmente.
- `titulo` y `descripcion`: copys EN/ES.
- `campos`: preguntas y opciones. Los valores técnicos como `yes`, `no` o `full_time` nunca se traducen.

Para publicar una vacante nueva, agrega un objeto siguiendo el formato existente y configura el mismo `vacanteId` en el script `n8n/score.js`. No agregues criterios de elegibilidad al formulario: esas reglas permanecen en n8n para que puedan modificarse sin tocar la web.

### Compartir el enlace

El enlace en inglés es:

```text
https://empleo.TU_DOMINIO/warehouse-associate
```

El enlace inicial en español es:

```text
https://empleo.TU_DOMINIO/warehouse-associate?lang=es
```

Las campañas pueden añadir UTM, por ejemplo:

```text
?lang=es&utm_source=meta&utm_campaign=warehouse-raleigh
```

La atribución se conserva en `sessionStorage` durante la sesión del candidato.

### Interpretar resultados en GoHighLevel

El flujo de n8n debe etiquetar los contactos con valores como:

- `vacante-WH-001`
- `estado-precalificado`, `estado-revision` o `estado-no_elegible`
- `lang-en` o `lang-es`
- `resultado-calificado`, `resultado-revision`, `resultado-no_contesto`, `resultado-no_interesado` o `resultado-no_llamar`

El equipo debe usar la etiqueta `resultado-no_llamar` para respetar inmediatamente las solicitudes de no contacto. Las decisiones finales de contratación son siempre humanas.

## Manual técnico: desarrollo local

### Requisitos

- Node.js 20 o posterior (el proyecto se verificó con Node 26).
- npm.
- Docker Desktop y Docker Compose, para probar el stack completo.
- Git Bash o una terminal equivalente en Windows.

### Ejecutar solo la web

```bash
cd /c/dev/practicas/relay/web
npm install
npm run dev
```

Abre `http://localhost:3000/warehouse-associate`.

Sin n8n activo, el formulario debe renderizar y validar normalmente; al enviarlo responderá un error controlado porque el webhook no está disponible. Esto es esperado.

### Verificaciones de calidad

```bash
cd /c/dev/practicas/relay/web
npm run lint
npm run build
```

El build utiliza `output: "standalone"`, por lo que Docker puede copiar una distribución compacta y ejecutar `server.js` sin instalar todo el árbol de desarrollo en la imagen final.

### Probar la API directamente

Con la web ejecutándose, una solicitud de ejemplo es:

```bash
curl -X POST http://localhost:3000/api/apply \
  -H "Content-Type: application/json" \
  -d '{
    "slug":"warehouse-associate",
    "idioma":"en",
    "eventId":"11111111-2222-3333-4444-555555555555",
    "nombre":"Test Candidate",
    "email":"test@example.com",
    "telefono":"(919) 555-0123",
    "zip":"27601",
    "horario":"morning",
    "respuestas":{"autorizacion":"yes","transporte":"yes","disponibilidad":"full_time","experiencia":"1_3"},
    "consentimiento":true
  }'
```

Casos esperados: ZIP inexistente devuelve `400` con `code: "zip"`; teléfono inválido devuelve `400` con `code: "phone"`; el sexto intento desde la misma IP durante diez minutos devuelve `429` con `code: "rate"`.

## Configuración con Docker

### Variables de entorno

```bash
cd /c/dev/practicas/relay
cp .env.example .env
```

Completa `.env` antes de un despliegue real:

| Variable | Uso |
| --- | --- |
| `DOMINIO` | Dominio base, sin `https://`. |
| `ADMIN_IP` | IP pública permitida para acceder al editor de n8n. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | Credenciales de la base de n8n. |
| `N8N_ENCRYPTION_KEY` | Clave que cifra las credenciales de n8n. Debe respaldarse fuera del servidor. |
| `N8N_WEBHOOK_SECRET` | Secreto que valida Next.js al comunicar con n8n. |
| `GHL_PRIVATE_INTEGRATION_TOKEN` | Token privado de la subcuenta de GoHighLevel; solo se usa en el servidor. Requiere permiso `contacts.write`. |
| `GHL_LOCATION_ID` | ID de la ubicación/subcuenta de GoHighLevel donde se guardarán los contactos. |
| `META_PIXEL_ID` / `META_CAPI_TOKEN` | Opcionales; activan medición de Meta. |

Genera claves nuevas con:

```bash
openssl rand -hex 32
```

`.env` y `.env.local` están ignorados por Git. Nunca deben subirse al repositorio.

### Validar y construir

```bash
docker compose --env-file .env.example config
docker compose --env-file .env.example build web
```

El primer comando revisa la composición sin iniciar contenedores. El segundo crea la imagen `relay-web`.

### Arranque local con n8n

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d n8n postgres
```

Luego inicia Next.js con `npm run dev` desde `web/`. En n8n, abre el workflow de intake y selecciona **Listen for test event** antes de probar el formulario: el entorno local usa `/webhook-test/apply`.

### Despliegue en servidor

1. Instala Docker Engine y Docker Compose en el VPS.
2. Configura DNS para `empleo.tudominio.com` y `n8n.tudominio.com` hacia la IP del servidor.
3. Clona el repositorio y crea el archivo `.env` con secretos nuevos.
4. Ejecuta `docker compose up -d --build`.
5. Comprueba el estado con `docker compose ps`.

Caddy expone la web y n8n con HTTPS. El endpoint interno `/webhook/apply` de n8n se bloquea desde Internet: Next.js se comunica con él por la red Docker.

## Configuración manual de n8n

Los archivos de `n8n/` son únicamente el código que se pega en nodos **Code**; no contienen workflows ni credenciales.

| Archivo | Workflow y nodo |
| --- | --- |
| `n8n/score.js` | **Relay: Intake** → nodo **Score** (Run Once for All Items). |
| `n8n/ventana-llamada.js` | **Relay: Intake** → nodo **Ventana de llamada**. |
| `n8n/interpretar-resultado.js` | **Relay: Resultado llamada** → nodo **Interpretar**. |

El workflow de intake recibe el webhook con `ghlContactId`, calcula distancia y prioridad, actualiza ese contacto en GHL, evita volver a llamar duplicados y programa la llamada. No debe crear un segundo contacto si la API web ya envió `ghlContactId`. El workflow de resultado interpreta la respuesta de Retell, añade notas a GHL y deja los casos ambiguos para revisión humana.

La API web también sincroniza el contacto con GoHighLevel antes de llamar al webhook de n8n. Usa `POST /contacts/upsert` para crear o actualizar por la regla de duplicados configurada en la ubicación y agrega las etiquetas de vacante e idioma sin reemplazar las etiquetas existentes. El ID resultante viaja en `ghlContactId` dentro del payload de n8n. Configura `GHL_PRIVATE_INTEGRATION_TOKEN` y `GHL_LOCATION_ID` en `.env`; para desarrollo local, usa las mismas variables en `web/.env.local`. Si no están configuradas, en desarrollo se omite la sincronización; en producción el endpoint falla de forma controlada para evitar aceptar solicitudes sin guardarlas en el CRM.

## Seguridad y privacidad

- El navegador nunca recibe secretos de n8n, GHL, Retell o Meta CAPI.
- La comunicación web → n8n incluye `x-relay-secret`.
- El rate limit actual es en memoria; funciona para un solo contenedor. Si se escala la web, debe migrarse a Redis u otro almacenamiento compartido.
- Caddy restringe el editor de n8n a `ADMIN_IP`; revisar esta IP antes de desplegar.
- Respaldar `N8N_ENCRYPTION_KEY` y programar backups de PostgreSQL. Sin esa clave, las credenciales almacenadas de n8n no se pueden descifrar.
- Antes de activar tráfico: aprobación legal del consentimiento TCPA/SMS, política de privacidad publicada, agentes IA aprobados y procedimiento claro de no contacto.

## Límites actuales y siguientes mejoras

- No hay panel de métricas propio; se puede integrar con GHL, Metabase o Looker Studio.
- No hay CAPTCHA; para campañas de alto volumen se recomienda Cloudflare Turnstile.
- No hay reintentos de llamadas desde la aplicación web; se recomienda controlarlos en GHL/n8n con un máximo de tres.
- El listado de ZIP usa una librería local y la elegibilidad geográfica final se calcula en n8n.
- La API de Meta está configurada como integración opcional. Antes de producción, validar la versión vigente de Graph API y probar deduplicación de eventos.

## Checklist de salida a producción

- [ ] Consentimiento EN/ES aprobado legalmente.
- [ ] `.env` de producción con claves nuevas y protegidas.
- [ ] DNS y certificados HTTPS verificados.
- [ ] Credenciales de n8n, GHL y Retell creadas manualmente.
- [ ] `SITIOS` y umbrales por vacante revisados con Relay.
- [ ] Pruebas ficticias de formularios, duplicados, no elegibles y casos de no contacto.
- [ ] Llamada real de prueba en inglés y español.
- [ ] Verificación de contactos, etiquetas, notas y pipeline en GHL.
- [ ] Eventos Lead de Meta sin duplicación, si Meta está habilitado.

## Registro de solicitudes en GHL

La web guarda una nota en el contacto después del upsert y antes de enviar a n8n.
Conserva el ID y fecha de la solicitud, vacante, idioma, datos de contacto,
ubicación, horario, respuestas, consentimiento y atribución. Excluye los datos
 técnicos (IP y user-agent). Usa POST /contacts/{contactId}/notes con el mismo
 token de servidor y su permiso contacts.write.

Si falla la nota, /api/apply devuelve el error CRM y no continúa hacia n8n.
El contacto puede haber sido creado previamente. Si n8n falla después, la nota
ya queda guardada. Un reenvío genera otro applicationId y puede crear otra nota:
aún no hay idempotencia entre reenvíos. El registro de consentimiento no sustituye
la aprobación legal del texto.

Pruebas sin servicios externos: desde web, ejecutar
node --test tests/gohighlevel.test.mjs.
