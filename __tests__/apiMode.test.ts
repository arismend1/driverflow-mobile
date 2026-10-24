import { selectApiMode } from '../src/api/apiMode';

describe('safe API target selection', () => {
    it('never points a debug build to production', () => {
        expect(selectApiMode(true)).toBe('DEVICE_ADB');
    });

    it('preserves the production target for release builds', () => {
        expect(selectApiMode(false)).toBe('PRODUCTION');
    });
});
