<<<<<<< HEAD
# DriverFlow Mobile App

Proyecto React Native oficial para DriverFlow.

## Estructura
- `android/`: Proyecto nativo Android.
- `src/`: Código fuente React Native (components, screens).

## Requisitos
- Node.js LTS
- JDK 17+
- Android Studio / Android SDK

## Configuración
El `applicationId` oficial es: `com.driverflow.app`.

## Ejecución (Android)
```bash
# Instalar dependencias
npm install

# Ejecutar en emulador/dispositivo
npx react-native run-android
```

## Build (Release)
Para generar el App Bundle (.aab):
```bash
cd android
./gradlew bundleRelease
```
El archivo se generará en `android/app/build/outputs/bundle/release/app-release.aab`.
=======
# BizTrack Mobile App

Aplicación móvil oficial de BizTrack construida con React Native (Expo).

## Conexión Backend
Esta app está configurada para conectarse al backend en producción:
- **URL**: `https://biztrack-backend-eebz.onrender.com/api`
- **Archivo de Configuración**: `src/constants/api.js`

## Estructura del Proyecto
- `App.js`: Entrada principal y navegación.
- `src/api/`: Cliente HTTP (Axios) con interceptores de seguridad.
- `src/context/`: Gestión de estado global (AuthContext).
- `src/screens/`: Pantallas (Login, Register, Dashboard).
- `src/constants/`: Variables de configuración.

## Instrucciones de Instalación

### 1. Requisitos Previos
- Node.js instalado.
- Celular Android o Emulador.

### 2. Instalar Dependencias
Si acabas de clonar el proyecto, ejecuta:
```bash
npm install
```

### 3. Correr la App en Desarrollo
Para iniciar el servidor de desarrollo:
```bash
npx expo start
```
- Escanea el código QR con la app **Expo Go** en tu Android.
- O presiona `a` para abrir en Emulador Android.

### 4. Generar APK / AAB para Google Play
Para generar el archivo lista para producción:

1. Instalar EAS CLI:
   ```bash
   npm install -g eas-cli
   ```
2. Iniciar sesión en Expo:
   ```bash
   eas login
   ```
3. Configurar el proyecto:
   ```bash
   eas build:configure
   ```
4. Generar la build (Android):
   ```bash
   eas build -p android
   ```
   - Esto generará un archivo `.aab` listo para subir a la Google Play Console.

## Notas Importantes
- La app maneja autenticación persistente.
- Si hay errores de conexión, verifica que el backend en Render esté activo (puede tardar unos segundos en despertar si está dormido).
>>>>>>> 9cc9bda66741ca4f160429359f4273107ce06219
