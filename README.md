# DriverFlow — Aplicación móvil Android

Aplicación React Native 0.83.1. Este repositorio contiene código de la aplicación existente, no un proyecto nuevo.

## Identidad y ramas

- Android applicationId: `com.driverflow.official` (ver `android/app/build.gradle`).
- En compilaciones **debug QA**, Gradle agrega `.qa`: identificador `com.driverflow.official.qa`. Esto permite instalar QA junto a la aplicación oficial, sin reemplazarla.
- En el teléfono, la app de pruebas se muestra como **DriverFlow QA**; la versión oficial conserva el nombre **DriverFlow**.
- Los enlaces profundos también están separados: `driverflow-qa://` en debug y `driverflow://` en release. Así QA no reclama enlaces destinados a producción.
- Rama de QA aislada: `security-mobile-phase1-2026-10`.
- El backend de QA se mantiene por separado en `arismend1/driverflow-backend`, rama `security-billing-phase1-2026-10`.
- No modificar `main`, `driverflow-stable`, producción, Stripe real, Render ni Google Play sin autorización específica.

## Requisitos para pruebas locales

Node.js 22, JDK 17, Android SDK/API 36, un teléfono Android con depuración USB o un emulador, ADB y un backend **aislado** de pruebas que esté escuchando en el puerto 3000.

Las pruebas GitHub Actions del backend con PostgreSQL desechable no levantan un servidor permanente. No son una URL accesible desde el teléfono. Antes de iniciar sesión, el backend de pruebas debe tener el esquema necesario y cuentas ficticias; nunca apuntar el teléfono de QA a producción.

## Configuración de API

`src/api/apiMode.ts` selecciona `DEVICE_ADB` cuando `__DEV__` es verdadero y `PRODUCTION` en modo release.

En Android debug, `DEVICE_ADB` utiliza `http://127.0.0.1:3000`. Ese localhost pertenece al teléfono. Para conectarlo al backend local de la PC es necesario configurar **ADB reverse**, no usar la IP de producción.

```powershell
adb devices
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
adb reverse --list
```

Para validar la preparación local sin iniciar sesión ni enviar datos, ejecutar en la raíz del repositorio:

```powershell
node scripts/check_android_qa_device.js
```

Este diagnóstico verifica que hay exactamente un dispositivo autorizado, `adb reverse` en el puerto 3000, `DriverFlow QA` instalada, `/health` respondiendo en la PC y un archivo Firebase QA con estructura válida. **No demuestra que el servidor use una base de datos ficticia ni que Firebase esté conectado**; eso debe comprobarse de forma independiente antes de iniciar sesión.


- Puerto 3000: API aislada de pruebas en la PC.
- Puerto 8081: Metro para una compilación React Native debug.
- Solo las compilaciones debug permiten HTTP para la API de pruebas en loopback; release mantiene tráfico sin cifrar deshabilitado. El modo debug no ofrece una alternativa automática mediante IP fija de LAN.
- No se puede inferir que el backend está funcional por el simple hecho de que el comando `adb reverse` haya terminado correctamente.
- Verificar `http://127.0.0.1:3000/health` **en la PC** antes de iniciar la app y probar con cuentas ficticias.
- No introducir credenciales reales ni enlaces Stripe live.

## Compilación y pruebas

```powershell
npm ci --legacy-peer-deps
npx jest __tests__/matchAcceptance.test.ts __tests__/matchStages.test.ts __tests__/matchPrivacy.test.ts __tests__/apiMode.test.ts --runInBand
npx tsc --noEmit
```

Para compilar Android debug localmente se requiere un archivo `android/app/google-services.json` válido para un proyecto Firebase **de pruebas**, con aplicación Android registrada exactamente como `com.driverflow.official.qa`, sin usar credenciales del proyecto real.

Antes de instalar la APK en un dispositivo, ejecutar `node scripts/check_firebase_qa.js` en la raíz del repositorio. Este control rechaza el Firebase ficticio de CI y configuraciones con el identificador de producción. **Solo comprueba la estructura del archivo y la identidad Android:** no demuestra que el proyecto exista, que su clave funcione ni que lleguen notificaciones. No subir `google-services.json` a GitHub. Después, desde la raíz del repositorio, ejecutar `npx react-native run-android` con el dispositivo de pruebas conectado.

El workflow `.github/workflows/mobile-android-debug-validation.yml` crea expresamente un `google-services.json` **ficticio** solo para validar compilación. Su APK de CI **no tiene Firebase funcional** y su existencia no demuestra inicio de sesión ni notificaciones en un dispositivo. No distribuirla como versión operativa.

## Límites de QA

Las pruebas automatizadas actuales comprueban compilación, selección de API y lógica de oportunidades. Todavía hace falta validar conectividad con backend persistente de pruebas, Firebase de pruebas, inicio de sesión real en teléfono, notificaciones y el flujo integral Android. Ningún resultado CI autoriza publicar en Google Play.

Los antiguos bloques de instrucciones de BizTrack/Expo y los marcadores de conflicto se han eliminado porque no describen este proyecto.
