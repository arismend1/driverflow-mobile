import { Platform } from 'react-native';
import { selectApiMode } from './apiMode';

// In debug builds use ONLY the loopback API forwarded from the PC over ADB:
//   adb reverse tcp:3000 tcp:3000
// Release builds always use the published HTTPS API.
// Avoid hard-coded LAN addresses: they can silently target a different server.
export type ApiMode = 'PRODUCTION' | 'DEVICE_ADB';
export const API_MODE: ApiMode = selectApiMode(__DEV__);

export const API_URL: string = API_MODE === 'PRODUCTION'
  ? 'https://api.driverflow.app'
  : Platform.OS === 'android'
    ? 'http://127.0.0.1:3000'
    : 'http://localhost:3000';

export const getApiDebugInfo = () => ({
  API_MODE,
  API_URL,
});
