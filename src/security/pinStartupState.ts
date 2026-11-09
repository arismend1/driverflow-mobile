// Pure startup decision. A restored authenticated session has a single PIN gate:
// the app-lock modal. Never mount both PinScreen and PinLockOverlay for the same PIN.
export type PinStartupState = {
  appLocked: boolean;
  pinGate: 'enter' | 'create' | null;
};

export const resolvePinStartupState = (
  hasStoredSession: boolean,
  hasStoredPin: boolean,
  hasRememberedCredentials: boolean,
): PinStartupState => {
  if (hasStoredSession) {
    return hasStoredPin
      ? { appLocked: true, pinGate: null }
      : { appLocked: false, pinGate: 'create' };
  }
  if (hasRememberedCredentials) {
    return { appLocked: false, pinGate: hasStoredPin ? 'enter' : 'create' };
  }
  return { appLocked: false, pinGate: null };
};

/**
 * A correct PIN can unlock the locally restored session without another
 * password login. The backend still verifies the bearer token on API calls.
 * Never use a mismatched, missing or non-persisted token to unlock.
 */
export const hasRestoredSecureSession = (
  activeToken: string | null,
  persistedToken: string | null,
): boolean => Boolean(activeToken && persistedToken && activeToken === persistedToken);
