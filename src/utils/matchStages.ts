// Presentation only: the backend deliberately keeps NEW while just one actor
// has accepted. Use the *actor's* timestamp to place it under In Progress,
// without modifying the persisted match state or consent/payment rules.

export type MatchViewActor = 'empresa' | 'driver' | null | undefined;
export type MatchViewTab = 'NUEVOS' | 'EN_PROCESO' | 'EXCLUSIVOS' | 'HIRED';

export type MatchViewSnapshot = {
    status?: string | null;
    company_step1_accepted_at?: string | null;
    driver_step1_accepted_at?: string | null;
};

const pendingInterestStates = new Set(['NEW', 'VIEWED', 'CONTACTED', 'ACCEPTED']);
const newInterestStates = new Set(['NEW', 'VIEWED', 'CONTACTED']);
const activeStates = new Set([
    'ACCEPTED', 'PREMATCH_READY', 'SHARE_PENDING_COMPANY',
    'SHARE_PENDING_DRIVER', 'PAYMENT_REQUIRED',
]);

const validDate = (date: string | null | undefined): boolean =>
    typeof date === 'string' && date.trim().length > 0;

export const getMyMatchAcceptance = (
    match: MatchViewSnapshot,
    actor: MatchViewActor
): boolean => {
    if (actor === 'empresa') return validDate(match.company_step1_accepted_at);
    if (actor === 'driver') return validDate(match.driver_step1_accepted_at);
    return false;
};

export const isWaitingForOtherAcceptance = (
    match: MatchViewSnapshot,
    actor: MatchViewActor
): boolean => {
    if (!pendingInterestStates.has(match.status || '') || !getMyMatchAcceptance(match, actor)) {
        return false;
    }
    return actor === 'empresa'
        ? !validDate(match.driver_step1_accepted_at)
        : actor === 'driver'
            ? !validDate(match.company_step1_accepted_at)
            : false;
};

export const getMatchViewTab = (
    match: MatchViewSnapshot,
    actor: MatchViewActor
): MatchViewTab | null => {
    const status = match.status || '';
    if (status === 'INFO_SHARED') return 'EXCLUSIVOS';
    if (status === 'HIRED') return 'HIRED';
    if (newInterestStates.has(status)) {
        return getMyMatchAcceptance(match, actor) ? 'EN_PROCESO' : 'NUEVOS';
    }
    if (activeStates.has(status)) return 'EN_PROCESO';
    // Unknown, declined and closed states are not given an actionable tab.
    return null;
};
