import { hasRestoredSecureSession } from './pinStartupState';
import { getSecureAuthValue } from './secureAuthStorage';
import { renewStoredSession } from './renewableSession';

/** Called only after verifyStoredPin reports a correct local PIN. */
export const resumePinSession = async (
    activeAccessToken: string | null,
): Promise<string | null> => {
    const persisted = await getSecureAuthValue('auth_token');
    if (hasRestoredSecureSession(activeAccessToken, persisted)) return persisted;
    return renewStoredSession(persisted);
};
