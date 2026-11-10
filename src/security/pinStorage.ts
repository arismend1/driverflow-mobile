import { getSecureAuthValue, migrateLegacyAuthValue, setSecureAuthValue } from './secureAuthStorage';

// Always use the same Keychain service for create, restart and unlock.
const PIN_KEY = 'saved_pin' as const;

export const restoreStoredPin = (): Promise<string | null> =>
  migrateLegacyAuthValue(PIN_KEY);

export const saveAndVerifyPin = async (pin: string): Promise<void> => {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN_INVALID_FORMAT');
  }
  await setSecureAuthValue(PIN_KEY, pin);
  const persisted = await getSecureAuthValue(PIN_KEY);
  if (persisted !== pin) {
    throw new Error('PIN_NOT_PERSISTED');
  }
};

export const verifyStoredPin = async (
  enteredPin: string,
): Promise<'correct' | 'incorrect' | 'unavailable'> => {
  const saved = await getSecureAuthValue(PIN_KEY);
  if (saved === null) return 'unavailable';
  return saved === enteredPin ? 'correct' : 'incorrect';
};
