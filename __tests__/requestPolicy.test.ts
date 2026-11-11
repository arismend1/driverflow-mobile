import { fetchWithPolicy, isReadOnlyRequest, isRetryableStatus } from '../src/api/requestPolicy';
import { request, DiagnosticsState } from '../src/api/client';

jest.mock('../src/api/config', () => ({ API_URL: 'http://127.0.0.1:3000' }));

const simulatedResponse = (status: number, content: string = '{}') => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: () => null },
  text: async () => content,
}) as unknown as Response;

describe('Phase 2 transport reliability contract', () => {
  it('retries a transient GET exactly once and returns the successful response', async () => {
    const transport = jest.fn()
      .mockResolvedValueOnce(simulatedResponse(503))
      .mockResolvedValueOnce(simulatedResponse(200));
    const result = await fetchWithPolicy('/test', { method: 'GET' }, transport as any);
    expect(result.status).toBe(200);
    expect(transport).toHaveBeenCalledTimes(2);
    for (const [, options] of transport.mock.calls) {
      expect(options.signal).toBeDefined();
    }
  });

  it('never retries POST writes, including 503 responses or network errors', async () => {
    const failed = jest.fn().mockResolvedValue(simulatedResponse(503));
    const response = await fetchWithPolicy('/accept', { method: 'POST' }, failed as any);
    expect(response.status).toBe(503);
    expect(failed).toHaveBeenCalledTimes(1);
    const offline = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(fetchWithPolicy('/payment', { method: 'POST' }, offline as any))
      .rejects.toThrow('offline');
    expect(offline).toHaveBeenCalledTimes(1);
  });

  it('retries only safe transient GET status codes', async () => {
    expect(isReadOnlyRequest('get')).toBe(true);
    expect(isReadOnlyRequest('POST')).toBe(false);
    expect([502, 503, 504].every(isRetryableStatus)).toBe(true);
    expect([400, 401, 403, 409, 429, 500].some(isRetryableStatus)).toBe(false);
    const transport = jest.fn().mockResolvedValue(simulatedResponse(401));
    await fetchWithPolicy('/me', { method: 'GET' }, transport as any);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('retries a GET after one network disconnect but not after abort', async () => {
    const transport = jest.fn()
      .mockRejectedValueOnce(new Error('temporary disconnect'))
      .mockResolvedValueOnce(simulatedResponse(200));
    expect((await fetchWithPolicy('/me', { method: 'GET' }, transport as any)).status).toBe(200);
    expect(transport).toHaveBeenCalledTimes(2);
    const aborted = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const reject = jest.fn().mockRejectedValue(aborted);
    await expect(fetchWithPolicy('/me', { method: 'GET' }, reject as any)).rejects.toMatchObject({name:'AbortError'});
    expect(reject).toHaveBeenCalledTimes(1);
  });

  it('aborts a hung GET and does not issue a duplicate request', async () => {
    const transport = jest.fn().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () =>
        reject(Object.assign(new Error('timeout'), {name:'AbortError'})), {once:true});
    }));
    await expect(fetchWithPolicy('/hang', {method:'GET'}, transport as any, 10))
      .rejects.toMatchObject({name:'AbortError'});
    expect(transport).toHaveBeenCalledTimes(1);
  });
});

describe('Phase 2 shared API client error hygiene', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; DiagnosticsState.lastError = null; });

  it('returns a stable timeout code without exposing internal network diagnostics', async () => {
    global.fetch = jest.fn().mockRejectedValue(Object.assign(
      new Error('SECRET_LOCAL_NETWORK_ADDRESS'), {name:'AbortError'})) as any;
    const result = await request('/test', 'POST', {safe:true});
    expect(result).toMatchObject({ok:false,status:0,error:'REQUEST_TIMEOUT'});
    expect(result.raw).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('SECRET_LOCAL_NETWORK_ADDRESS');
    expect(DiagnosticsState.lastError?.message).toBe('REQUEST_TIMEOUT');
  });

  it('does not expose HTML error bodies from proxy or backend', async () => {
    global.fetch = jest.fn().mockResolvedValue(simulatedResponse(500,
      '<html>SECRET_STACK_TRACE</html>')) as any;
    const result = await request('/test', 'POST', {});
    expect(result).toMatchObject({ok:false,status:500,error:'NON_JSON_RESPONSE'});
    expect(result.raw).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('SECRET_STACK_TRACE');
  });
});
