# Relay Solicitudes — presentación para la empresa

Fecha de preparación: 10 de octubre de 2026

## Resumen ejecutivo

Relay Solicitudes es un prototipo funcional para captar candidatos en español o
inglés, validar sus datos, conservar la solicitud de forma durable, clasificarla
con reglas visibles en n8n y preparar su sincronización con GoHighLevel.

La demostración usa información ficticia. GoHighLevel funciona en modo simulado
y todavía no se realizan llamadas reales. Esta separación permite revisar la
solución antes de autorizar credenciales, criterios de contratación, textos de
consentimiento y costos de telefonía.

## Problema que resuelve

- Centraliza solicitudes que llegan desde campañas o páginas de empleo.
- Evita perder candidatos cuando n8n o el CRM están temporalmente indisponibles.
- Normaliza teléfono, ZIP, idioma, disponibilidad y respuestas de precalificación.
- Mantiene trazabilidad entre recepción, clasificación y sincronización.
- Permite que reclutamiento revise las decisiones antes de automatizar llamadas.

## Recorrido implementado

```text
Candidato
   ↓
Formulario Next.js EN/ES
   ↓
PostgreSQL guarda solicitud y trabajo pendiente
   ↓
Worker reclama el trabajo con reintentos
   ↓
n8n recibe el ID y consulta una vista PostgreSQL de solo lectura
   ↓
n8n valida, puntúa y prepara el siguiente paso
   ↓
Worker guarda la clasificación
   ↓
Sincronización GHL simulada
```

El mensaje de recepción de la web significa que la solicitud ya está guardada.
La pestaña **Ejecuciones** de n8n permite comprobar posteriormente que la
clasificación terminó correctamente.

## Estado de los componentes

| Componente | Estado para la demostración | Límite actual |
| --- | --- | --- |
| Formulario adaptable EN/ES | Funcional | Consentimiento pendiente de aprobación legal |
| Validación de teléfono y ZIP | Funcional | Configurado para Estados Unidos |
| PostgreSQL Relay | Funcional | La política de retención debe ser definida por la empresa |
| Cola y reintentos | Funcional | Procesa clasificación y CRM, todavía no llamadas |
| Workflow n8n | Publicable y funcional | Las reglas WH-001 son ejemplos |
| GoHighLevel | Cliente implementado | La demostración usa modo simulado |
| Meta Pixel/CAPI | Preparado | Requiere IDs y token reales |
| Retell | Diseño y scripts preliminares | No hay agente, número ni llamadas activas |
| Atención fuera de horario | Propuesta documentada | Pertenece a la siguiente fase |

## Workflow visible en n8n

1. **Solicitud** recibe un contrato autenticado.
2. **Buscar lead en PostgreSQL** consulta el candidato por `applicationId`.
3. **Validar candidato** comprueba consentimiento, respuestas y estructura.
4. **Calcular puntaje** aplica distancia, transporte, disponibilidad y experiencia.
5. **Preparar siguiente paso** propone llamada, revisión humana o cierre.
6. **Devolver clasificación** responde al worker para completar o reintentar la tarea.

La respuesta al worker es necesaria porque el worker es responsable de marcar la
tarea como completada, guardar el resultado y crear el siguiente trabajo. Si n8n
no responde con el contrato esperado, el worker conserva el candidato y reintenta.

## Controles aplicados

- La API responde éxito únicamente después de guardar en PostgreSQL.
- La cola usa leases, bloqueo de filas y reintentos con espera progresiva.
- El webhook exige un secreto compartido.
- n8n usa el usuario `relay_n8n_reader`, que solo puede consultar una vista.
- El webhook no transporta nombre, correo o teléfono; envía el ID y las reglas.
- Los secretos se mantienen en archivos `.env` ignorados por Git.
- Los logs no imprimen el contenido completo de las solicitudes.
- En configuración base, n8n no conserva ejecuciones exitosas; el modo local sí
  las conserva para mostrar el recorrido con datos ficticios.

## Evidencia disponible

- Pruebas unitarias y de integración incluidas en el repositorio.
- Build y lint configurados.
- Endpoints `/api/health` y `/api/ready`.
- Ejecuciones exitosas del workflow estable en n8n.
- Trabajos `classify=done` y `sync_ghl=done` en la cola local.
- Migraciones reproducibles para tablas, vista y permisos PostgreSQL.

## Qué no se debe afirmar durante la presentación

- Que el sistema está aprobado para producción.
- Que ya crea contactos reales en la cuenta GHL de la empresa.
- Que ya realiza o recibe llamadas de IA.
- Que las reglas actuales son decisiones finales de contratación.
- Que los textos actuales sustituyen una revisión legal.
- Que el prototipo ofrece alta disponibilidad en una sola computadora.

## Decisiones que necesita tomar la empresa

1. Aprobar campos, preguntas, radios, puntajes y motivos por vacante.
2. Aprobar consentimiento, privacidad, retención y horarios de contacto.
3. Proporcionar una ubicación GHL de pruebas y credenciales con permisos mínimos.
4. Definir pipeline, etapas, responsables, etiquetas y política de duplicados.
5. Elegir Retell o Vapi, número telefónico, idiomas y guion de entrevista.
6. Definir límites de costo, reintentos, no contacto y transferencia humana.
7. Determinar alojamiento, dominio, copias de seguridad y responsables operativos.

## Siguiente fase recomendada

1. Conectar una ubicación GHL de pruebas.
2. Validar un candidato ficticio de extremo a extremo con el equipo.
3. Crear la cola de llamadas separada de la cola de clasificación.
4. Configurar un agente saliente para candidatos precalificados.
5. Configurar otro agente entrante para atención fuera de horario.
6. Guardar resultado, resumen y transcripción con una política de retención.
7. Ejecutar una prueba controlada antes de activar campañas.

## Mensaje de cierre sugerido

> La entrega demuestra la recepción durable, la clasificación visible en n8n y
> la preparación de la integración CRM. La telefonía y las credenciales reales
> quedan como una fase controlada que requiere decisiones y aprobación de Relay.
