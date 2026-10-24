import {
    confirmRecordedAcceptanceAfterConflict,
    hasRecordedOwnAcceptance,
    isRecoverableAcceptanceConflict,
    parseMatchActionError,
    acquireMatchAction,
    releaseMatchAction,
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
        }, 700, 'driver')).toBe(false);
    });

    it('rejects closed, declined or expired match states', () => {
        for (const status of ['CLOSED', 'DECLINED', 'EXPIRED']) {
            expect(hasRecordedOwnAcceptance({ ...match, status }, 700, 'driver')).toBe(false);
        }
        expect(hasRecordedOwnAcceptance(null, 700, 'empresa')).toBe(false);
    });

    it('recognizes own recorded acceptance while the other actor is still pending', () => {
        for (const status of ['NEW', 'VIEWED', 'CONTACTED', 'ACCEPTED']) {
            expect(hasRecordedOwnAcceptance({ ...match, status, driver_step1_accepted_at: null }, 700, 'empresa')).toBe(true);
            expect(hasRecordedOwnAcceptance({ ...match, status, company_step1_accepted_at: null }, 700, 'empresa')).toBe(false);
        }
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

describe('fresh API check after an acceptance conflict', () => {
    it('reconciles only a 409 with confirmed own consent on the correct match', async () => {
        const load = jest.fn(async () => [match]);
        expect(await confirmRecordedAcceptanceAfterConflict(
            409, 'match_update_conflict', 700, 'empresa', load
        )).toBe(true);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it('never fetches for unrelated HTTP errors or unauthenticated actors', async () => {
        const load = jest.fn(async () => [match]);
        expect(await confirmRecordedAcceptanceAfterConflict(
            403, 'match_update_conflict', 700, 'empresa', load
        )).toBe(false);
        expect(await confirmRecordedAcceptanceAfterConflict(
            409, 'invalid_match_state', 700, null, load
        )).toBe(false);
        expect(load).not.toHaveBeenCalled();
    });

    it('does not treat a missing row, different match or wrong actor consent as success', async () => {
        for (const rows of [
            [],
            [{ ...match, match_id: 702 }],
            [{ ...match, company_step1_accepted_at: null }],
            [{ ...match, status: 'CLOSED' }],
        ]) {
            expect(await confirmRecordedAcceptanceAfterConflict(
                409, 'invalid_match_state', 700, 'empresa', async () => rows
            )).toBe(false);
        }
    });

    it('reconciles a 409 on NEW only after a fresh owned acceptance timestamp', async () => {
        const pending = { ...match, status: 'NEW', driver_step1_accepted_at: null };
        expect(await confirmRecordedAcceptanceAfterConflict(409, 'match_update_conflict', 700, 'empresa', async () => [pending])).toBe(true);
        expect(await confirmRecordedAcceptanceAfterConflict(409, 'match_update_conflict', 700, 'driver', async () => [pending])).toBe(false);
    });

    it('fails closed when refresh throws, or fails to return a list', async () => {
        expect(await confirmRecordedAcceptanceAfterConflict(
            409, 'match_update_conflict', 700, 'driver', async () => {
                throw new Error('offline');
            }
        )).toBe(false);
        expect(await confirmRecordedAcceptanceAfterConflict(
            409, 'match_update_conflict', 700, 'driver', async () => null
        )).toBe(false);
    });
});


describe('match consent HTTP error parsing', () => {
    it('preserves meaningful 403, 404 and 409 statuses even with non-JSON bodies', () => {
        expect(parseMatchActionError(403, '<html>Forbidden</html>').message).toContain('not authorized');
        expect(parseMatchActionError(404, '').message).toContain('no longer available');
        expect(parseMatchActionError(409, 'gateway error').message).toContain('changed');
    });

    it('preserves structured driver-lock details without granting consent', () => {
        expect(parseMatchActionError(409, JSON.stringify({
            error: 'driver_locked', exclusive_until: '2026-10-25T00:00:00Z'
        }))).toEqual({
            error: 'driver_locked',
            message: 'This opportunity changed. Refresh and try again.',
            exclusive_until: '2026-10-25T00:00:00Z',
        });
    });

    it('does not display arbitrary HTML bodies or invalid message values', () => {
        const result = parseMatchActionError(500, '<script>bad</script>');
        expect(result.message).toBe('The request could not be completed.');
        expect(parseMatchActionError(409, '{"message":42}').message).toContain('changed');
    });
});


describe('single-flight consent guard', () => {
    it('blocks duplicate confirmation until the first request settles', () => {
        const inFlight = new Set<string>();
        expect(acquireMatchAction(inFlight, 700)).toBe(true);
        expect(acquireMatchAction(inFlight, '700')).toBe(false);
        expect(acquireMatchAction(inFlight, 701)).toBe(true);
        releaseMatchAction(inFlight, 700);
        expect(acquireMatchAction(inFlight, 700)).toBe(true);
    });
});
