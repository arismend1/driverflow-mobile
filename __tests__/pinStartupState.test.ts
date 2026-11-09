import { hasRestoredSecureSession, resolvePinStartupState } from '../src/security/pinStartupState';

describe('PIN startup regression (restored QA session)', () => {
  it('shows only PinLockOverlay when token and PIN are restored', () => {
    expect(resolvePinStartupState(true, true, true)).toEqual({
      appLocked: true, pinGate: null,
    });
    expect(resolvePinStartupState(true, true, false)).toEqual({
      appLocked: true, pinGate: null,
    });
  });

  it('forces PIN creation for a restored session with no PIN', () => {
    expect(resolvePinStartupState(true, false, true)).toEqual({
      appLocked: false, pinGate: 'create',
    });
  });

  it('shows an entry gate, but no app-lock modal, for credentials without a token', () => {
    expect(resolvePinStartupState(false, true, true)).toEqual({
      appLocked: false, pinGate: 'enter',
    });
  });

  it('does not lock an unauthenticated device with no remembered account', () => {
    expect(resolvePinStartupState(false, true, false)).toEqual({
      appLocked: false, pinGate: null,
    });
    expect(resolvePinStartupState(false, false, false)).toEqual({
      appLocked: false, pinGate: null,
    });
  });
});

describe('PIN unlock with an already authenticated Keychain session', () => {
  it('allows a matching persisted session without retrying remembered credentials', () => {
    expect(hasRestoredSecureSession('synthetic-session', 'synthetic-session')).toBe(true);
  });

  it('never treats a missing or different persisted token as authorization', () => {
    expect(hasRestoredSecureSession(null, 'synthetic-session')).toBe(false);
    expect(hasRestoredSecureSession('synthetic-session', null)).toBe(false);
    expect(hasRestoredSecureSession('synthetic-session', 'different-session')).toBe(false);
    expect(hasRestoredSecureSession('', '')).toBe(false);
  });
});
