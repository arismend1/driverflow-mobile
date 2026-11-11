# Fase 2 — Mapa de llamadores y decisión sobre duplicados (2026-11-11)

Alcance: inspección de **70 archivos TS/TSX/JS/JSON y documentación del árbol móvil de la rama de trabajo**, además de `server.js` del backend. No se ejecutó ninguna llamada a servicios reales.

| Elemento | Llamadores encontrados | Decisión |
|---|---|---|
| `src/context/AuthContext.tsx` | `App.tsx:4` importa `AuthProvider`; `RootNavigator.tsx:4`, `PinScreen.tsx:4`, `LoginScreen.tsx:4`, `MatchesScreen.tsx:21` y otras pantallas usan ese contexto | Mantener |
| `src/context/AuthContext.stable.tsx` | **Ninguna importación** en los 70 archivos revisados; únicamente la exclusión de ESLint `.eslintrc.js:3` | Copia inactiva retirada; también se eliminó su excepción ESLint |
| `src/api/client.ts` `confirmRequest()` → `POST /approve_driver` | No se encontró uso ni importación de `confirmRequest` fuera de su propia definición | Wrapper móvil retirado |
| Backend `POST /approve_driver` | Ya no llamado por las pantallas móviles actuales, pero sigue siendo API heredada potencialmente usada por clientes antiguos; existe contrato de cola PUSH y pruebas heredadas | **Mantener** hasta verificar consumidores externos |
| `src/screens/MatchesScreen.tsx` | Usa `POST /matches/:id/accept` (moderno), no `approve_driver` | Mantener |
| Backend `POST /create_request` | `client.ts` exporta `createRequest`; `CreateRequestScreen.tsx:16,42` lo usa | Mantener |
| Backend `GET /list_available_requests` | `client.ts` exporta `getAvailableRequests`; `AvailableRequestsScreen.tsx:3` lo usa | Mantener |
| Backend `POST /apply_for_request` | `client.ts` exporta `applyToRequest`; `AvailableRequestsScreen.tsx:3` lo usa | Mantener |
| `src/api/NotificationsService.ts` | `NotificationsScreen.tsx:3,10` importa `notifications` y se suscribe a sus eventos | Mantener |
| `src/screens/LegalAcceptanceScreen.tsx` | Usa `AuthContext.completeLegalAcceptance` con el JWT nuevo; ahora transmite el refresh token opcional | Mantener |

## Evidencia de compatibilidad y límites
- Inspección de imports del árbol disponible; **no prueba que no existan clientes externos** de las rutas HTTP. Ninguna ruta backend heredada fue eliminada.
- Tests de regresión: `__tests__/phase2Callers.test.ts` comprueba importación del contexto efectivo, borrado de la copia, retención de tres rutas heredadas vivas, la aceptación moderna y el consumidor de notificaciones.
- El código eliminado no modifica el PIN, almacenamiento seguro, login ni migraciones QA.
- No se tocaron producción, Render, Google Play ni la app instalada.
