import {
    getMatchViewTab, isWaitingForOtherAcceptance, getMyMatchAcceptance,
} from '../src/utils/matchStages';

const newMatch = {
    status: 'NEW',
    company_step1_accepted_at: null,
    driver_step1_accepted_at: null,
};
const acceptedAt = '2026-10-23T19:00:00Z';

describe('match stage compatibility with one-sided acceptance', () => {
    it('shows a fresh unaccepted match in New for both actors', () => {
        expect(getMatchViewTab(newMatch, 'empresa')).toBe('NUEVOS');
        expect(getMatchViewTab(newMatch, 'driver')).toBe('NUEVOS');
        expect(isWaitingForOtherAcceptance(newMatch, 'empresa')).toBe(false);
        expect(isWaitingForOtherAcceptance(newMatch, 'driver')).toBe(false);
    });

    it('moves a company-accepted NEW match into In Progress and shows Waiting', () => {
        const match = { ...newMatch, company_step1_accepted_at: acceptedAt };
        expect(getMatchViewTab(match, 'empresa')).toBe('EN_PROCESO');
        expect(isWaitingForOtherAcceptance(match, 'empresa')).toBe(true);
        expect(getMatchViewTab(match, 'driver')).toBe('NUEVOS');
        expect(isWaitingForOtherAcceptance(match, 'driver')).toBe(false);
    });

    it('moves a driver-accepted NEW match into In Progress and shows Waiting', () => {
        const match = { ...newMatch, driver_step1_accepted_at: acceptedAt };
        expect(getMatchViewTab(match, 'driver')).toBe('EN_PROCESO');
        expect(isWaitingForOtherAcceptance(match, 'driver')).toBe(true);
        expect(getMatchViewTab(match, 'empresa')).toBe('NUEVOS');
        expect(isWaitingForOtherAcceptance(match, 'empresa')).toBe(false);
    });

    it('handles legacy viewed/contacted statuses consistently', () => {
        for (const status of ['VIEWED', 'CONTACTED']) {
            const accepted = { ...newMatch, status, driver_step1_accepted_at: acceptedAt };
            expect(getMatchViewTab(accepted, 'driver')).toBe('EN_PROCESO');
            expect(isWaitingForOtherAcceptance(accepted, 'driver')).toBe(true);
            expect(getMatchViewTab({ ...accepted, driver_step1_accepted_at: null }, 'driver')).toBe('NUEVOS');
        }
    });

    it('stops showing Waiting when both actors accepted', () => {
        for (const status of ['NEW', 'ACCEPTED', 'PREMATCH_READY']) {
            const match = {
                ...newMatch, status,
                company_step1_accepted_at: acceptedAt,
                driver_step1_accepted_at: acceptedAt,
            };
            expect(isWaitingForOtherAcceptance(match, 'driver')).toBe(false);
            expect(isWaitingForOtherAcceptance(match, 'empresa')).toBe(false);
            expect(getMatchViewTab(match, 'driver')).toBe('EN_PROCESO');
            expect(getMatchViewTab(match, 'empresa')).toBe('EN_PROCESO');
        }
    });

    it('keeps mutual consent, payment, shared and hired states in their proper tabs', () => {
        for (const status of [
            'ACCEPTED', 'PREMATCH_READY', 'SHARE_PENDING_DRIVER',
            'SHARE_PENDING_COMPANY', 'PAYMENT_REQUIRED',
        ]) {
            expect(getMatchViewTab({ ...newMatch, status }, 'empresa')).toBe('EN_PROCESO');
        }
        expect(getMatchViewTab({ ...newMatch, status: 'INFO_SHARED' }, 'empresa')).toBe('EXCLUSIVOS');
        expect(getMatchViewTab({ ...newMatch, status: 'HIRED' }, 'driver')).toBe('HIRED');
        expect(isWaitingForOtherAcceptance({ ...newMatch, status: 'PAYMENT_REQUIRED', driver_step1_accepted_at: acceptedAt }, 'driver')).toBe(false);
    });

    it('never treats missing actors, blank acceptance or closed states as valid waiting', () => {
        expect(getMyMatchAcceptance({ ...newMatch, company_step1_accepted_at: '   ' }, 'empresa')).toBe(false);
        expect(isWaitingForOtherAcceptance({ ...newMatch, company_step1_accepted_at: acceptedAt }, null)).toBe(false);
        expect(getMatchViewTab({ ...newMatch, status: 'CLOSED' }, 'empresa')).toBeNull();
        expect(getMatchViewTab({ ...newMatch, status: 'DECLINED' }, 'driver')).toBeNull();
        expect(getMatchViewTab({ ...newMatch, status: 'EXPIRED' }, 'empresa')).toBeNull();
    });
});
