import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import {
  clearSecureAuthValues,
  getSecureAuthValue,
  migrateLegacyAuthValue,
  removeSecureAuthValue,
  setSecureAuthValue,
} from '../src/security/secureAuthStorage';

// Synthetic values only. Mock the Android Keychain boundary; never use a device,
// real credentials, or production data in CI.
const mockSecrets = new Map<string, string>();

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(async ({ service }: { service: string }) => {
    const value = mockSecrets.get(service);
    return value === undefined ? false : { username: 'driverflow', password: value };
  }),
  setGenericPassword: jest.fn(async (
    _username: string,
    password: string,
    { service }: { service: string },
  ) => {
    mockSecrets.set(service, password);
    return true;
  }),
  resetGenericPassword: jest.fn(async ({ service }: { service: string }) => {
    mockSecrets.delete(service);
    return true;
  }),
}));

const keys = [
  'auth_token',
  'restricted_token',
  'saved_pin',
  'saved_email',
  'saved_password',
  'saved_type',
] as const;
const service = (key: string) => `com.driverflow.official.auth.${key}`;

beforeEach(async () => {
  mockSecrets.clear();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('secure authentication storage migration', () => {
  it.each(keys)('moves plaintext %s to a dedicated Keychain service before deleting it', async key => {
    const synthetic = `synthetic-${key}`;
    await AsyncStorage.setItem(key, synthetic);

    expect(await migrateLegacyAuthValue(key)).toBe(synthetic);
    expect(mockSecrets.get(service(key))).toBe(synthetic);
    expect(await AsyncStorage.getItem(key)).toBeNull();
    expect(await getSecureAuthValue(key)).toBe(synthetic);
  });

  it('keeps distinct auth values in separate secure services, never in plaintext', async () => {
    await setSecureAuthValue('saved_pin', '1234');
    await setSecureAuthValue('auth_token', 'synthetic-token');

    expect(await getSecureAuthValue('saved_pin')).toBe('1234');
    expect(await getSecureAuthValue('auth_token')).toBe('synthetic-token');
    expect(await AsyncStorage.getItem('saved_pin')).toBeNull();
    expect(await AsyncStorage.getItem('auth_token')).toBeNull();
    expect(mockSecrets.size).toBe(2);
  });

  it('prefers an existing secure value and erases an obsolete plaintext copy', async () => {
    await setSecureAuthValue('auth_token', 'current-synthetic-token');
    await AsyncStorage.setItem('auth_token', 'stale-synthetic-token');

    expect(await migrateLegacyAuthValue('auth_token')).toBe('current-synthetic-token');
    expect(await AsyncStorage.getItem('auth_token')).toBeNull();
  });

  it('preserves legacy plaintext when secure storage fails instead of silently losing sign-in data', async () => {
    await AsyncStorage.setItem('saved_pin', '1234');
    jest.mocked(Keychain.setGenericPassword).mockRejectedValueOnce(new Error('synthetic-keystore-failure'));

    await expect(migrateLegacyAuthValue('saved_pin')).rejects.toThrow('synthetic-keystore-failure');
    expect(await AsyncStorage.getItem('saved_pin')).toBe('1234');
    expect(mockSecrets.has(service('saved_pin'))).toBe(false);
  });

  it('refuses to delete legacy data unless the secure write can be read back', async () => {
    await AsyncStorage.setItem('auth_token', 'synthetic-token');
    jest.mocked(Keychain.setGenericPassword).mockImplementationOnce(async () => false);

    await expect(migrateLegacyAuthValue('auth_token')).rejects.toThrow('SECURE_AUTH_MIGRATION_FAILED:auth_token');
    expect(await AsyncStorage.getItem('auth_token')).toBe('synthetic-token');
  });

  it('deletes both a secure secret and any possible legacy copy on explicit removal', async () => {
    await setSecureAuthValue('saved_password', 'synthetic-password');
    await AsyncStorage.setItem('saved_password', 'old-synthetic-password');

    await removeSecureAuthValue('saved_password');

    expect(await getSecureAuthValue('saved_password')).toBeNull();
    expect(await AsyncStorage.getItem('saved_password')).toBeNull();
  });

  it('attempts every cleanup but reports an incomplete logout if one secure delete fails', async () => {
    await setSecureAuthValue('saved_pin', '1234');
    await setSecureAuthValue('auth_token', 'synthetic-token');
    jest.mocked(Keychain.resetGenericPassword).mockRejectedValueOnce(new Error('synthetic-delete-failure'));

    await expect(clearSecureAuthValues(['saved_pin', 'auth_token']))
      .rejects.toThrow('SECURE_AUTH_CLEAR_INCOMPLETE');
    expect(await getSecureAuthValue('auth_token')).toBeNull();
    expect(await getSecureAuthValue('saved_pin')).toBe('1234');
  });
});
