// Jest runs in Node; the RN TypeScript config deliberately omits @types/node.
// Declare the Node test harness boundary without changing application typings.
declare const require: (id: string) => any;
declare const __dirname: string;
const fs = require('node:fs');
const path = require('node:path');

const file = (relative: string) => fs.readFileSync(path.resolve(__dirname,'..',relative),'utf8');

describe('Phase 2 caller archaeology and safe deletion',()=>{
    it('boots current AuthProvider and has no stale alternative context',()=>{
        expect(file('App.tsx')).toMatch(/from ['"]\.\/src\/context\/AuthContext['"]/);
        expect(fs.existsSync(path.resolve(__dirname,'../src/context/AuthContext.stable.tsx'))).toBe(false);
        expect(file('src/context/AuthContext.tsx')).toContain('export const AuthProvider');
    });
    it('retains live legacy request APIs with real UI callsites',()=>{
        const api=file('src/api/client.ts');
        const create=file('src/screens/CreateRequestScreen.tsx');
        const available=file('src/screens/AvailableRequestsScreen.tsx');
        expect(api).toContain("request('/create_request'");
        expect(api).toContain("request('/list_available_requests'");
        expect(api).toContain("request('/apply_for_request'");
        expect(create).toMatch(/\bcreateRequest\b/);
        expect(available).toMatch(/\bgetAvailableRequests\b/);
        expect(available).toMatch(/\bapplyToRequest\b/);
    });
    it('uses modern match acceptance and retires only unused mobile wrapper',()=>{
        const api=file('src/api/client.ts');
        const matches=file('src/screens/MatchesScreen.tsx');
        expect(api).not.toContain('confirmRequest =');
        expect(api).not.toContain("request('/approve_driver'");
        expect(matches).toContain('/matches/${matchId}/accept');
    });
    it('keeps NotificationService while its screen subscribes',()=>{
        expect(file('src/screens/NotificationsScreen.tsx')).toContain('notifications.addListener');
        expect(file('src/api/NotificationsService.ts')).toContain('export const notifications');
    });
});
