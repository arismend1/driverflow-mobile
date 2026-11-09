import { resolvePinStartupState } from '../src/security/pinStartupState';

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
