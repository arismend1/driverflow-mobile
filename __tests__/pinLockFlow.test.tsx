import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/context/AuthContext';
import PinScreen from '../src/screens/PinScreen';
import PinLockOverlay from '../src/components/PinLockOverlay';

jest.mock('../src/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), reset: jest.fn() }),
  useRoute: () => ({ params: { mode: 'enter' } }),
}));

const verifyPin = jest.fn();
const unlockApp = jest.fn();
let view: ReactTestRenderer.ReactTestRenderer;

const visibleText = (): string =>
  view.root.findAllByType(Text).map(node => {
    const children = node.props.children;
    return Array.isArray(children) ? children.join('') : String(children);
  }).join(' ');

const pressDigit = async (digit: string) => {
  const key = view.root.findAllByType(TouchableOpacity).find(button =>
    button.findAllByType(Text).some(label => label.props.children === digit),
  );
  if (!key) throw new Error('MISSING_PIN_DIGIT:' + digit);
  await act(async () => {
    key.props.onPress();
  });
};

const enterPin = async (pin: string) => {
  for (const digit of pin) await pressDigit(digit);
};

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-09T18:00:00Z'));
  await AsyncStorage.clear();
  verifyPin.mockReset();
  unlockApp.mockReset();
  jest.mocked(useAuth).mockReturnValue({
    hasPin: true,
    userInfo: { id: 1, name: 'QA', type: 'driver' },
    verifyPinAndLogin: verifyPin,
    unlockApp,
    logout: jest.fn(async () => {}),
    clearSavedCredentials: jest.fn(async () => {}),
    clearPinGate: jest.fn(async () => {}),
    savePin: jest.fn(async () => {}),
  } as unknown as ReturnType<typeof useAuth>);
});

afterEach(async () => {
  if (view) {
    await act(async () => { view.unmount(); });
  }
  jest.useRealTimers();
});

describe('same PIN lockout UI on restored and unauthenticated entry routes', () => {
  it('renders the lockout-capable component from PinScreen enter mode', async () => {
    verifyPin.mockResolvedValue('invalid_pin');
    await act(async () => { view = ReactTestRenderer.create(<PinScreen />); });
    expect(visibleText()).toContain('Unlock DriverFlow');
    expect(visibleText()).not.toContain('Enter your PIN');
  });

  it('locks after five incorrect attempts, shows a 30-second countdown, then re-enables entry', async () => {
    verifyPin.mockResolvedValue('invalid_pin');
    await act(async () => { view = ReactTestRenderer.create(<PinScreen />); });

    for (let i = 0; i < 5; i++) {
      await enterPin('9999');
    }
    expect(verifyPin).toHaveBeenCalledTimes(5);
    expect(visibleText()).toContain('Too many attempts. Try again in 30s.');
    expect(await AsyncStorage.getItem('pin_failed_attempts')).toBe('5');
    expect(Number(await AsyncStorage.getItem('pin_lock_until'))).toBeGreaterThan(Date.now());

    await pressDigit('9');
    expect(verifyPin).toHaveBeenCalledTimes(5);

    await act(async () => { jest.advanceTimersByTime(31_000); });
    expect(visibleText()).not.toContain('Too many attempts.');
    expect(await AsyncStorage.getItem('pin_failed_attempts')).toBeNull();

    await enterPin('9999');
    expect(verifyPin).toHaveBeenCalledTimes(6);
  });

  it('does not penalize a correct PIN if the session must be reauthenticated', async () => {
    verifyPin.mockResolvedValue('reauth_required');
    await act(async () => { view = ReactTestRenderer.create(<PinLockOverlay />); });
    await enterPin('4932');
    expect(visibleText()).toContain('Session expired or unavailable.');
    expect(await AsyncStorage.getItem('pin_failed_attempts')).toBeNull();
    expect(unlockApp).not.toHaveBeenCalled();
  });

  it('unlocks only after an explicit verified result', async () => {
    verifyPin.mockResolvedValue('verified');
    await act(async () => { view = ReactTestRenderer.create(<PinLockOverlay />); });
    await enterPin('4932');
    expect(unlockApp).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem('pin_failed_attempts')).toBeNull();
  });
});
