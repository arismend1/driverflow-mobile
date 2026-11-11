import { getSecureAuthValue, setSecureAuthValue } from '../src/security/secureAuthStorage';
import { renewStoredSession, saveLoginRefreshToken } from '../src/security/renewableSession';
import { resumePinSession } from '../src/security/resumePinSession';
import { saveAndVerifyPin, verifyStoredPin } from '../src/security/pinStorage';
import { request, setSessionRenewalHandler } from '../src/api/client';

jest.mock('../src/api/config', () => ({ API_URL: 'http://127.0.0.1:3000' }));
jest.mock('../src/security/secureAuthStorage', () => {
    const secrets: Record<string,string> = {};
    return {
        __secrets:secrets,
        getSecureAuthValue:jest.fn(async(key:string) => secrets[key]??null),
        setSecureAuthValue:jest.fn(async(key:string,value:string) => {secrets[key]=value;}),
        removeSecureAuthValue:jest.fn(async(key:string) => {delete secrets[key];}),
    };
});
const secrets = require('../src/security/secureAuthStorage').__secrets as Record<string,string>;
const response = (status:number, data:any) => ({
    ok:status>=200&&status<300,status,headers:{get:()=>null},
    json:async()=>data,text:async()=>JSON.stringify(data),
}) as unknown as Response;
const originalFetch=globalThis.fetch;
beforeEach(()=>{Object.keys(secrets).forEach(k=>delete secrets[k]);setSessionRenewalHandler(null);});
afterEach(()=>{globalThis.fetch=originalFetch;setSessionRenewalHandler(null);});

test('mobile renew: two simultaneous calls use one rotated refresh and store both tokens',async()=>{
    secrets.auth_token='oldAccess'; secrets.refresh_token='r'.repeat(43);
    const fetcher=jest.fn().mockResolvedValue(response(200,
        {ok:true,token:'newAccess',refreshToken:'s'.repeat(43)}));
    globalThis.fetch=fetcher as any;
    const [a,b]=await Promise.all([renewStoredSession('oldAccess'),renewStoredSession('oldAccess')]);
    expect(a).toBe('newAccess');expect(b).toBe('newAccess');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await getSecureAuthValue('refresh_token')).toBe('s'.repeat(43));
    expect(await getSecureAuthValue('auth_token')).toBe('newAccess');
    expect(secrets.saved_password).toBeUndefined();
});

test('mobile renew: server-revoked refresh requires login and does not resurrect access',async()=>{
    secrets.auth_token='oldAccess';secrets.refresh_token='r'.repeat(43);
    globalThis.fetch=jest.fn().mockResolvedValue(response(401,{error:'REFRESH_REPLAY'})) as any;
    expect(await renewStoredSession('oldAccess')).toBeNull();
    expect(secrets.refresh_token).toBeUndefined();
    expect(secrets.auth_token).toBe('oldAccess');
});

test('mobile renew: offline error retains token and remembered password',async()=>{
    secrets.refresh_token='r'.repeat(43);
    secrets.saved_password='legacy-transition-fallback';
    globalThis.fetch=jest.fn().mockRejectedValue(new Error('offline')) as any;
    expect(await renewStoredSession('oldAccess')).toBeNull();
    expect(secrets.refresh_token).toBe('r'.repeat(43));
    expect(secrets.saved_password).toBe('legacy-transition-fallback');
});

test('PIN restart: correct PIN restores backend session with no saved email/password',async()=>{
    await saveAndVerifyPin('4932');
    expect(await verifyStoredPin('4932')).toBe('correct');
    expect(await verifyStoredPin('0000')).toBe('incorrect');
    await saveLoginRefreshToken('r'.repeat(43));
    expect(secrets.saved_email).toBeUndefined();
    expect(secrets.saved_password).toBeUndefined();
    globalThis.fetch=jest.fn().mockResolvedValue(response(200,{ok:true,
        token:'jwtAccessAfterPin',refreshToken:'s'.repeat(43)})) as any;
    expect(await resumePinSession(null)).toBe('jwtAccessAfterPin');
    expect(secrets.auth_token).toBe('jwtAccessAfterPin');
});

test('mobile GET: expired access renewed and replayed once, never POST',async()=>{
    const refresh=jest.fn().mockResolvedValue('replacementJWT');
    setSessionRenewalHandler(refresh);
    const fetcher=jest.fn().mockResolvedValueOnce(response(403,{is_expired:true}))
        .mockResolvedValueOnce(response(200,{ok:true,list:[1]}))
        .mockResolvedValueOnce(response(403,{is_expired:true}));
    globalThis.fetch=fetcher as any;
    const res=await request('/matches/candidates','GET',undefined,'oldJWT');
    expect(res.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe('Bearer replacementJWT');
    const post=await request('/matches/5/accept','POST',{},'oldJWT');
    expect(post.ok).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(refresh).toHaveBeenCalledTimes(1);
});

test('mobile GET: expired access never loops renewal indefinitely',async()=>{
    const refresh=jest.fn().mockResolvedValue('newJWT');
    setSessionRenewalHandler(refresh);
    globalThis.fetch=jest.fn().mockResolvedValue(response(403,{is_expired:true})) as any;
    const result=await request('/protected','GET',undefined,'oldJWT');
    expect(result.ok).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
});

test('new login refresh clears previous-account refresh but preserves remembered password',async()=>{
    secrets.saved_password='legacy-password-kept';
    secrets.refresh_token='old'.repeat(15).slice(0,43);
    await saveLoginRefreshToken('s'.repeat(43));
    expect(secrets.refresh_token).toBe('s'.repeat(43));
    expect(secrets.saved_password).toBe('legacy-password-kept');
});
