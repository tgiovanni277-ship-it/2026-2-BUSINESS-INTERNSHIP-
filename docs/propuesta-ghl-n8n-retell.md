# Propuesta de siguiente fase: GHL, n8n y agente de voz

## Objetivo

Usar GoHighLevel como punto de entrada y espacio de trabajo del reclutador. Un
formulario de GHL crea o actualiza el contacto, n8n programa una entrevista de
voz en la franja elegida por el candidato y el resultado vuelve al mismo contacto.
Un agente independiente atiende llamadas entrantes cuando la oficina no está
disponible.

Esta propuesta no está implementada en la entrega actual. Su activación requiere
cuentas de prueba, número telefónico, aprobación del guion y autorización para
contactar y transcribir.

## Flujo propuesto

```text
Formulario GHL
  -> contacto y postulación
  -> workflow Form Submitted
  -> webhook autenticado a n8n
  -> validar consentimiento, zona horaria, franja y duplicados
  -> crear llamada saliente en Retell
  -> Retell entrevista y transcribe
  -> webhook call_analyzed a n8n
  -> nota, campos y tarea de revisión en GHL

Número de oficina
  -> personal disponible durante horario
  -> agente entrante fuera de horario o como respaldo
  -> resumen y tarea de devolución en GHL
```

## Alcance inicial recomendado

- Una vacante y un formulario.
- Tres franjas de contacto: mañana, tarde y noche, definidas por la empresa.
- Una llamada automática por postulación; los reintentos requieren una política
  aprobada y un límite explícito.
- Preguntas sobre disponibilidad para empezar, turnos aceptados y horario de
  contacto. La decisión de selección queda en manos del reclutador.
- Un agente saliente para entrevistas y otro entrante para atención fuera de
  horario.
- Resultado mínimo en GHL: estado de llamada, resumen, respuestas estructuradas,
  referencia a la transcripción y tarea de revisión.

## Controles necesarios

Antes de crear una llamada, n8n debe comprobar:

1. Que la postulación tiene un identificador único y un número válido.
2. Que existe consentimiento vigente para llamada con voz automatizada y
   transcripción.
3. Que el contacto no está marcado como no llamar.
4. Que no existe una llamada pendiente o completada para esa postulación.
5. Que la hora calculada corresponde a la zona horaria del candidato y a la
   franja aprobada.

El webhook de resultado debe validar la firma del proveedor y procesar cada
combinación de evento e ID de llamada una sola vez. La transcripción completa no
debe copiarse en campos cortos ni enviarse a herramientas publicitarias.

## Reparto de responsabilidades

| Practicante/desarrollo | Empresa/propietario del proceso |
| --- | --- |
| Diseñar el workflow y mapear campos | Aprobar formulario, preguntas y criterios |
| Implementar webhooks y control de duplicados | Proveer cuentas, números y credenciales de prueba |
| Guardar resultados y errores técnicos | Aprobar consentimiento, privacidad y retención |
| Documentar configuración y casos de prueba | Definir horarios, reintentos, costos y responsable humano |
| Demostrar con contactos autorizados de prueba | Autorizar el paso a candidatos reales y asumir la operación |

## Criterio de demostración

La fase se considera demostrable cuando un contacto ficticio enviado desde GHL
genera una sola llamada de prueba, el proveedor devuelve `call_analyzed` y n8n
escribe en el mismo contacto el estado, resumen y respuestas. La atención fuera
de horario se valida llamando al número de prueba con la ruta humana disponible y
no disponible.

La producción requiere además revisar costos, monitoreo, recuperación de fallos,
retención de grabaciones/transcripciones y requisitos legales aplicables con los
responsables designados por la empresa.
