import {
    hasRecordedOwnAcceptance,
    isRecoverableAcceptanceConflict,
} from '../src/utils/matchAcceptance';

const match = {
    match_id: 700,
    status: 'PREMATCH_READY',
    company_step1_accepted_at: '2026-10-22T12:00:00.000Z',
    driver_step1_accepted_at: '2026-10-22T12:00:01.000Z',
};

describe('match acceptance conflict reconciliation', () => {
    it('permits refresh only on relevant 409 backend conflicts', () => {
        expect(isRecoverableAcceptanceConflict(409, 'match_update_conflict')).toBe(true);
        expect(isRecoverableAcceptanceConflict(409, 'invalid_match_state')).toBe(true);
        expect(isRecoverableAcceptanceConflict(403, 'match_update_conflict')).toBe(false);
        expect(isRecoverableAcceptanceConflict(404, 'invalid_match_state')).toBe(false);
        expect(isRecoverableAcceptanceConflict(500, 'match_update_conflict')).toBe(false);
        expect(isRecoverableAcceptanceConflict(409, 'PAYMENT_REQUIRED')).toBe(false);
        expect(isRecoverableAcceptanceConflict(409, undefined)).toBe(false);
    });

    it('accepts an already-recorded driver or company acceptance on the same match', () => {
        expect(hasRecordedOwnAcceptance(match, '700', 'driver')).toBe(true);
        expect(hasRecordedOwnAcceptance(match, 700, 'empresa')).toBe(true);
    });

    it('never validates a different match or a missing actor', () => {
        expect(hasRecordedOwnAcceptance(match, 701, 'empresa')).toBe(false);
        expect(hasRecordedOwnAcceptance(match, 700, null)).toBe(false);
        expect(hasRecordedOwnAcceptance(match, 700, undefined)).toBe(false);
        expect(hasRecordedOwnAcceptance({ ...match, id: 701, match_id: undefined }, 700, 'driver')).toBe(false);
    });

    it('never assumes acceptance from the other party or invents missing consent', () => {
        expect(hasRecordedOwnAcceptance({
            ...match, driver_step1_accepted_at: null,
        }, 700, 'driver')).toBe(false);
        expect(hasRecordedOwnAcceptance({
            ...match, company_step1_accepted_at: null,
        }, 700, 'empresa')).toBe(false);
        expect(hasRecordedOwnAcceptance({
            ...match, driver_step1_accepted_at: '   ',
        }, 700, 'driver')).toBe(true);
    });

    it('rejects closed, declined, stale or pre-confirmation match states', () => {
        for (const status of ['NEW', 'VIEWED', 'CONTACTED', 'ACCEPTED', 'CLOSED', 'DECLINED', 'EXPIRED']) {
            expect(hasRecordedOwnAcceptance({ ...match, status }, 700, 'driver')).toBe(false);
        }
        expect(hasRecordedOwnAcceptance(null, 700, 'empresa')).toBe(false);
    });

    it('accepts already-completed consent/payment states but does not authorize payment', () => {
        for (const status of [
            'PREMATCH_READY',
            'SHARE_PENDING_DRIVER',
            'SHARE_PENDING_COMPANY',
            'PAYMENT_REQUIRED',
            'INFO_SHARED',
            'HIRED',
        ]) {
            expect(hasRecordedOwnAcceptance({ ...match, status }, 700, 'empresa')).toBe(true);
        }
    });
});
