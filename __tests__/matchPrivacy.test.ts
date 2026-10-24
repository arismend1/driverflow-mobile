import { sanitizeMatchForDisplay } from '../src/utils/matchPrivacy';

const privatePayload = {
    match_id: 700,
    status: 'SHARE_PENDING_DRIVER',
    first_name: 'D.',
    city: 'Orlando',
    state: 'FL',
    driver_name: 'Private Full Name',
    display_name: 'Private Full Name',
    driver_email: 'private@example.test',
    driver_phone: '555-0100',
    profile_photo_base64: 'data:image/png;base64,secret',
    license_front_base64: 'data:image/png;base64,front',
    license_back_base64: 'data:image/png;base64,back',
    company_email: 'company@example.test',
    contact_phone: '555-0101',
    driver_bio: 'Contact me directly',
};

describe('locked match privacy', () => {
    it.each(['NEW', 'PREMATCH_READY', 'SHARE_PENDING_DRIVER', 'SHARE_PENDING_COMPANY', 'PAYMENT_REQUIRED'])(
        'removes private fields in %s while keeping permitted preview metadata', status => {
            const sanitized = sanitizeMatchForDisplay({ ...privatePayload, status });
            expect(sanitized.match_id).toBe(700);
            expect(sanitized.first_name).toBe('D.');
            expect(sanitized.city).toBe('Orlando');
            for (const field of [
                'driver_name', 'display_name', 'driver_email', 'driver_phone',
                'profile_photo_base64', 'license_front_base64', 'license_back_base64',
                'company_email', 'contact_phone', 'driver_bio',
            ]) {
                expect(sanitized).not.toHaveProperty(field);
            }
        }
    );

    it.each(['INFO_SHARED', 'HIRED'])(
        'preserves the authorized profile in %s', status => {
            const payload = { ...privatePayload, status };
            expect(sanitizeMatchForDisplay(payload)).toEqual(payload);
        }
    );

    it('does not mutate the original API response', () => {
        const original = { ...privatePayload };
        sanitizeMatchForDisplay(original);
        expect(original.driver_email).toBe('private@example.test');
    });
});
