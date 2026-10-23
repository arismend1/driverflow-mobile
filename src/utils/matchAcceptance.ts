// Pure client-side reconciliation helpers for a 409 on POST /matches/:id/accept.
// Never infer consent from an HTTP error alone. Only a fresh owned API result
// with an existing actor-specific acceptance timestamp may clear the warning.

export type MatchActorType = 'driver' | 'empresa' | null | undefined;

export type MatchAcceptanceSnapshot = {
    id?: string | number | null;
    match_id?: string | number | null;
    status?: string | null;
    company_step1_accepted_at?: string | null;
    driver_step1_accepted_at?: string | null;
};

const recordedConsentStates = new Set([
    'PREMATCH_READY',
    'SHARE_PENDING_DRIVER',
    'SHARE_PENDING_COMPANY',
    'PAYMENT_REQUIRED',
    'INFO_SHARED',
    'HIRED',
]);

export const isRecoverableAcceptanceConflict = (
    httpStatus: number,
    errorCode?: string | null
): boolean => (
    httpStatus === 409 &&
    (errorCode === 'match_update_conflict' || errorCode === 'invalid_match_state')
);

export const hasRecordedOwnAcceptance = (
    match: MatchAcceptanceSnapshot | null | undefined,
    requestedMatchId: string | number,
    actorType: MatchActorType
): boolean => {
    if (!match || (actorType !== 'driver' && actorType !== 'empresa')) return false;
    const id = match.match_id ?? match.id;
    if (id === undefined || id === null || String(id) !== String(requestedMatchId)) return false;
    if (!recordedConsentStates.has(match.status || '')) return false;
    const acceptance = actorType === 'driver'
        ? match.driver_step1_accepted_at
        : match.company_step1_accepted_at;
    return typeof acceptance === 'string' && acceptance.trim().length > 0;
};


export const confirmRecordedAcceptanceAfterConflict = async (
    httpStatus: number,
    errorCode: string | null | undefined,
    requestedMatchId: string | number,
    actorType: MatchActorType,
    fetchLatestMatches: () => Promise<MatchAcceptanceSnapshot[] | null | undefined>
): Promise<boolean> => {
    if (!isRecoverableAcceptanceConflict(httpStatus, errorCode)) return false;
    if (actorType !== 'driver' && actorType !== 'empresa') return false;
    try {
        const refreshed = await fetchLatestMatches();
        return Array.isArray(refreshed) && refreshed.some(item =>
            hasRecordedOwnAcceptance(item, requestedMatchId, actorType)
        );
    } catch {
        // A failed refresh must never turn an HTTP 409 into a success.
        return false;
    }
};
