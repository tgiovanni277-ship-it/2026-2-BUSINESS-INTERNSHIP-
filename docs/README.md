# Documentación del proyecto

Esta carpeta reúne la documentación técnica y de entrega de Relay Solicitudes. La mayoría de los documentos están en español; el README principal presenta el proyecto en inglés.

El repositorio incluye un prototipo local ejecutable con Docker Compose. El modo de desarrollo simula la sincronización con GoHighLevel. No representa un despliegue de producción ni una integración validada con cuentas reales.

## Inicio y demostración

- [Ejecución local y entrega al equipo](entrega-al-equipo.md): requisitos, arranque, configuración de n8n, recorrido local y pendientes.
- [Guía de demostración](GUIA-DEMO.md): preparación, recorrido de siete minutos y recuperación de fallos comunes.
- [Manual de usuario, operación y desarrollo](Manual-Relay-Solicitudes.docx).
- [Desarrollo de la aplicación web y el worker](web-worker.md).
- [Configuración y regeneración del workflow de n8n](n8n-workflow.md).

## Arquitectura y operación

- [Arquitectura](arquitectura.md): recepción durable, modelo de datos, contratos, idempotencia y límites.
- [Pruebas y despliegue](pruebas-y-despliegue.md): controles, ambientes, migraciones, operación y respaldos.
- [Campañas y capacidad](campanas-y-capacidad.md): límites de las capas y preparación para carga.
- [Validación registrada](VALIDACION.md): resultados y límites de la revisión fechada el 10 de octubre de 2026.

## Presentación y siguientes fases

- [Presentación ejecutiva en Markdown](PRESENTACION.md).
- [Presentación editable](Relay-Solicitudes-Presentacion.pptx).
- [Propuesta de siguiente fase: GHL, n8n y voz](propuesta-ghl-n8n-retell.md). La telefonía y las integraciones reales no forman parte del recorrido local actual.

## Límites que deben conservarse al presentar el proyecto

- El entorno Compose está destinado al desarrollo y la demostración local.
- `GHL_MODE=mock` simula los resultados del CRM; no crea contactos reales.
- Las reglas de elegibilidad de ejemplo requieren aprobación antes de usarse con candidatos reales.
- No hay despliegue de producción, telefonía, notificaciones ni operación con datos reales documentados.
