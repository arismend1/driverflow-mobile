import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

export type SecureAuthKey =
  | 'auth_token'
  | 'restricted_token'
  | 'saved_pin'
  | 'saved_email'
  | 'saved_password'
  | 'saved_type';

const SERVICE_PREFIX = 'com.driverflow.official.auth.';
const KEYCHAIN_USERNAME = 'driverflow';

const serviceFor = (key: SecureAuthKey) => `${SERVICE_PREFIX}${key}`;

export const getSecureAuthValue = async (key: SecureAuthKey): Promise<string | null> => {
  const credentials = await Keychain.getGenericPassword({ service: serviceFor(key) });
  return credentials ? credentials.password : null;
};

export const setSecureAuthValue = async (key: SecureAuthKey, value: string): Promise<void> => {
  await Keychain.setGenericPassword(KEYCHAIN_USERNAME, value, {
    service: serviceFor(key),
  });
};

export const removeSecureAuthValue = async (key: SecureAuthKey): Promise<void> => {
  await Keychain.resetGenericPassword({ service: serviceFor(key) });
  // Also clear a possible pre-migration plaintext copy.
  await AsyncStorage.removeItem(key);
};

export const migrateLegacyAuthValue = async (key: SecureAuthKey): Promise<string | null> => {
  const secureValue = await getSecureAuthValue(key);
  if (secureValue !== null) {
    // Remove any leftover plaintext copy after a successful prior migration.
    await AsyncStorage.removeItem(key);
    return secureValue;
  }

  const legacyValue = await AsyncStorage.getItem(key);
  if (legacyValue === null) return null;

  // Write and verify before deleting the plaintext legacy value.
  await setSecureAuthValue(key, legacyValue);
  const verifiedValue = await getSecureAuthValue(key);
  if (verifiedValue !== legacyValue) {
    throw new Error(`SECURE_AUTH_MIGRATION_FAILED:${key}`);
  }

  await AsyncStorage.removeItem(key);
  return verifiedValue;
};

export const clearSecureAuthValues = async (keys: SecureAuthKey[]): Promise<void> => {
  // Attempt every deletion, even when a different key fails.
  const results = await Promise.allSettled(keys.map(removeSecureAuthValue));
  if (results.some(result => result.status === 'rejected')) {
    // Never include credential values in the error.
    throw new Error('SECURE_AUTH_CLEAR_INCOMPLETE');
  }
};
