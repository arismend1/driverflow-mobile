import { API_URL } from '../api/config';
import { fetchWithPolicy } from '../api/requestPolicy';
import {
    getSecureAuthValue,
    removeSecureAuthValue,
    setSecureAuthValue,
} from './secureAuthStorage';

let refreshFlight: Promise<string | null> | null = null;

/** Refresh tokens belong only in Keychain; never use the PIN or saved password here. */
const performRenewal = async (expectedAccessToken?: string | null): Promise<string | null> => {
    const current = await getSecureAuthValue('auth_token');
    if (expectedAccessToken && current && current !== expectedAccessToken) return current;

    const refreshToken = await getSecureAuthValue('refresh_token');
    if (!refreshToken) return null;
    try {
        const response = await fetchWithPolicy(`${API_URL}/api/session/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ refreshToken }),
        }, fetch, 10000);
        if (!response.ok) {
            if (response.status === 401 &&
                (await getSecureAuthValue('refresh_token')) === refreshToken) {
                await removeSecureAuthValue('refresh_token');
            }
            return null;
        }
        const data = await response.json();
        if (data?.ok !== true || typeof data.token !== 'string' ||
            typeof data.refreshToken !== 'string') return null;
        // Signout or account switches may happen while the request is in flight.
        if ((await getSecureAuthValue('refresh_token')) !== refreshToken) return null;
        await setSecureAuthValue('refresh_token', data.refreshToken);
        await setSecureAuthValue('auth_token', data.token);
        return data.token;
    } catch {
        // Offline and timeouts do not erase the refresh credential.
        return null;
    }
};

/** Single-flight: concurrent GETs must not replay a rotated refresh token. */
export const renewStoredSession = (expectedAccessToken?: string | null): Promise<string | null> => {
    if (!refreshFlight) {
        refreshFlight = performRenewal(expectedAccessToken).finally(() => {
            refreshFlight = null;
        });
    }
    return refreshFlight;
};

export const saveLoginRefreshToken = async (value: unknown): Promise<void> => {
    // Preserve saved_password during transition, but never keep a prior account's refresh.
    if (typeof value === 'string' && value.length === 43) {
        await setSecureAuthValue('refresh_token', value);
    } else {
        await removeSecureAuthValue('refresh_token');
    }
};

export const revokeStoredSessionBestEffort = async (): Promise<boolean> => {
    const refreshToken = await getSecureAuthValue('refresh_token');
    if (!refreshToken) return true;
    try {
        const response = await fetchWithPolicy(`${API_URL}/api/session/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        }, fetch, 5000);
        return response.ok;
    } catch {
        return false;
    }
};
