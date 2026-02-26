import { Platform } from 'react-native';

// --- API CONFIGURATION ---
// MODOS:
// - 'PRODUCTION'  -> App publicada / Play Console (usa https://api.driverflow.app)
// - 'EMULATOR'    -> Android Emulator (10.0.2.2)
// - 'DEVICE_ADB'  -> Celular por cable usando adb reverse
// - 'DEVICE_LAN'  -> Celular por WiFi (IP de tu PC)
//
// IMPORTANTE:
// Para la app instalada desde Google Play, lo correcto es que SIEMPRE sea 'PRODUCTION'.
// No lo cambies a menos que estés probando en local.

export type ApiMode = 'PRODUCTION' | 'EMULATOR' | 'DEVICE_ADB' | 'DEVICE_LAN';

// ✅ Deja esto en PRODUCTION para el build de Play Console
export const API_MODE: ApiMode = 'PRODUCTION';

const getBaseUrl = (): string => {
  switch (API_MODE) {
    case 'PRODUCTION':
      // ✅ Dominio final del backend (producción)
      return 'https://api.driverflow.app';

    case 'EMULATOR':
      // Android emulator: 10.0.2.2 apunta al localhost de tu PC
      return Platform.OS === 'android'
        ? 'http://10.0.2.2:3000'
        : 'http://localhost:3000';

    case 'DEVICE_ADB':
      // Requiere:
      // adb reverse tcp:3000 tcp:3000
      return Platform.OS === 'android'
        ? 'http://127.0.0.1:3000'
        : 'http://localhost:3000';

    case 'DEVICE_LAN':
      // Cambia la X por el IP real de tu PC:
      // ejemplo: http://192.168.1.50:3000
      return 'http://192.168.1.99:3000';

    default:
      return 'http://localhost:3000';
  }
};

// URL base final usada por el cliente API
export const API_URL = getBaseUrl();

// Debug rápido por si quieres mostrarlo en pantalla temporalmente
export const getApiDebugInfo = () => ({
  API_MODE,
  API_URL,
});