# DriverFlow — Plan de pruebas en un Android real (sin datos de producción)

**Estado:** plan de QA, no significa que las pruebas de teléfono estén realizadas.
**Rama móvil:** `security-mobile-phase1-2026-10`
**Rama backend:** `security-billing-phase1-2026-10`
**Fecha:** 23 de octubre de 2026

## Condiciones indispensables antes de instalar

- [ ] Preparar un backend **staging** independiente de Render/producción, con PostgreSQL temporal y registros ficticios. No copiar datos privados ni tarjetas reales.
- [ ] Crear una compilación móvil de **pruebas** que use solamente la dirección HTTPS de ese staging. Actualmente `src/api/config.ts` indica `API_MODE = 'PRODUCTION'`; no usar la app publicada para validar cambios que aún no están desplegados.
- [ ] Configurar Firebase de pruebas adecuado a la app de staging si hay que verificar notificaciones. El `google-services.json` ficticio creado por CI sirve para comprobar compilación, **no** para probar notificaciones reales.
- [ ] Verificar que pagos se ejecuten **exclusivamente** con claves y cuentas Stripe de prueba, o limitar QA a los estados previos al pago.
- [ ] Tener dos cuentas ficticias: conductor A y compañía A; para autorización negativa, una compañía B independiente. Usar solo identificadores y contactos ficticios.
- [ ] Registrar versión exacta de la app, commit del backend, URL de staging y fecha de la sesión.

## Recorrido guiado

1. [ ] Conductor A y compañía A inician sesión por separado. Comprobar que cada uno ve solo sus oportunidades.
2. [ ] Ambos consultan una oportunidad `NEW`, sin teléfono ni correo de la otra parte ni documentos bloqueados expuestos.
3. [ ] **Solo compañía A acepta.** Debe verse en **In Progress** como **Waiting for response**, aunque el estado del backend sea aún `NEW`. En la cuenta del conductor la oportunidad sigue pendiente de aceptar.
4. [ ] Repetir en otra oportunidad con **solo conductor A aceptando**. Comprobar comportamiento equivalente.
5. [ ] Pulsar **Accept Interest** dos veces rápidamente. Debe procesarse una sola solicitud simultánea para esa tarjeta; no debe aparecer un falso error de aceptación.
6. [ ] Cuando ambos aceptan, comprobar `PREMATCH_READY` o estado posterior válido, sin duplicar notificaciones.
7. [ ] Cada parte abre la etapa de consentimiento. Comprobar que **Cancelar** no comparte datos. Confirmar únicamente en staging.
8. [ ] Antes de completar consentimiento y pago (si se requiere), comprobar que no aparecen correos, teléfonos ni fotografías de licencia privados.
9. [ ] Si staging tiene Stripe de prueba, completar el pago simulado y su webhook. El contacto debe mostrarse solo después del estado autorizado `INFO_SHARED`. Si no hay ambiente Stripe de prueba, **omitir este paso**.
10. [ ] Cerrar y volver a abrir la pantalla; la clasificación **New / In Progress / Exclusive / Hired** debe permanecer consistente con los datos guardados.
11. [ ] Compañía B intenta consultar o modificar un match de compañía A: debe rechazarse. Coincidencia de correo electrónico entre compañías nunca sustituye una autorización expresa.
12. [ ] Probar desconexión a internet y reintento de aceptación. Un `409` solo puede desaparecer si una nueva lectura confirma la aceptación propia; si falla la lectura, se presenta un error y no se concede acceso.

## Evidencia y criterios de aprobación

Guardar únicamente información ficticia: capturas sin datos personales, estado inicial y final, número de solicitudes `POST /matches/:id/accept`, respuestas HTTP y conteos de notificaciones. No almacenar tokens, claves, números reales ni credenciales.

**No aprobado** si el teléfono muestra contactos antes de autorización, permite operar sobre matches ajenos, duplica aceptación por toques rápidos, o convierte un conflicto de backend en éxito sin verificar el consentimiento existente.

**Pendiente:** este plan no reemplaza las pruebas manuales en un teléfono conectado ni autoriza publicar en Google Play. Nunca desplegar versiones de seguridad sin revisión y aprobación explícitas.
