/** Phase 2: bounded transport behavior, without replaying writes. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

export const isReadOnlyRequest = (method: string): boolean =>
    method.toUpperCase() === 'GET';

export const isRetryableStatus = (status: number): boolean =>
    status === 502 || status === 503 || status === 504;

export const fetchWithPolicy = async (
    url: string,
    init: RequestInit,
    transport: typeof fetch = fetch,
    timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> => {
    const readOnly = isReadOnlyRequest(init.method || 'GET');
    const attempts = readOnly ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await transport(url, { ...init, signal: controller.signal });
            if (readOnly && attempt + 1 < attempts && isRetryableStatus(response.status)) {
                continue;
            }
            return response;
        } catch (error) {
            // A manual/server abort is not automatically replayed.
            if (!readOnly || attempt + 1 >= attempts ||
                (error as Error)?.name === 'AbortError') {
                throw error;
            }
        } finally {
            clearTimeout(timeout);
        }
    }
    throw new Error('NETWORK_ERROR');
};
