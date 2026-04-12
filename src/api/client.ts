import { API_URL } from './config';

// --- TYPES ---
export interface ApiResponse<T = any> {
    ok: boolean;
    status: number;
    data?: T;
    error?: string;       // error code or short label
    raw?: string;         // raw body / extra detail
    requestId?: string;
    endpoint?: string;
}

// DIAGNOSTICS STATE
export const DiagnosticsState = {
    lastRequestId: 'N/A',
    lastError: null as { status: number; endpoint: string; message: string; timestamp: string } | null,
    baseUrl: API_URL
};

// --- GLOBAL LEGAL INTERCEPTOR ---
export type LegalAcceptanceInterceptor = (token: string) => void;
let onRequiresLegalAcceptance: LegalAcceptanceInterceptor | null = null;

export const setLegalAcceptanceInterceptor = (interceptor: LegalAcceptanceInterceptor) => {
    onRequiresLegalAcceptance = interceptor;
};

// --- CORE REQUEST HELPER ---
export const request = async <T = any>(
    endpoint: string,
    method: string,
    body?: any,
    token?: string
): Promise<ApiResponse<T>> => {
    try {
        const headers: any = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'DriverFlowApp/1.0.0 (Android)',
        };

        if (token) headers.Authorization = `Bearer ${token}`;

        const fullUrl = `${API_URL}${endpoint}`;
        // console.log("[REQ] URL", fullUrl); 
        // console.log("[REQ] METHOD", method);

        const response = await fetch(fullUrl, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        const status = response.status;
        const requestId = response.headers.get('x-request-id') || undefined;
        if (requestId) DiagnosticsState.lastRequestId = requestId;

        // Always read text first (prevents crash if backend returns HTML or plain text)
        const text = await response.text();

        let data: any = {};
        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                // Non-JSON response (HTML error page, proxy page, etc.)
                if (!response.ok) {
                    console.error(`[REQUEST] failure ${status} on ${endpoint}:`, text);
                }
                console.warn("[REQ] NON_JSON_RESPONSE on", endpoint);
                const snippet = text.replace(/\n|\r/g, ' ').trim().slice(0, 200);

                DiagnosticsState.lastError = {
                    status,
                    endpoint,
                    message: 'NON_JSON_RESPONSE',
                    timestamp: new Date().toISOString(),
                };

                return {
                    ok: false,
                    status,
                    error: 'NON_JSON_RESPONSE',
                    raw: snippet,
                    requestId,
                    endpoint,
                };
            }
        }

        // 1) HTTP-level error (non-2xx)
        if (!response.ok) {
            const message = data?.error || data?.message || 'HTTP_ERROR';
            const isLegalGate = status === 403 && data?.requires_legal_acceptance === true;

            if (isLegalGate) {
                // Silence RedBox for legal gate (it's an expected flow, not a system failure)
                console.log(`[REQUEST] legal gate ${status} on ${endpoint}`);
            } else {
                console.error(`[REQUEST] failure ${status} on ${endpoint}:`, text);
            }

            // GLOBAL LEGAL INTERCEPTOR CHECK
            if (isLegalGate) {
                if (onRequiresLegalAcceptance) {
                    const fallbackToken = data.token || token;
                    if (fallbackToken) onRequiresLegalAcceptance(fallbackToken);
                }
            }

            DiagnosticsState.lastError = {
                status,
                endpoint,
                message,
                timestamp: new Date().toISOString(),
            };

            return {
                ok: false,
                status,
                error: message,
                data,
                requestId,
                endpoint,
            };
        }

        // 2) App-level error even with 200 (backend may return { ok:false, error:"..." })
        if (data && typeof data === 'object' && data.ok === false) {
            const message = data?.error || data?.message || 'APP_ERROR';

            DiagnosticsState.lastError = {
                status,
                endpoint,
                message,
                timestamp: new Date().toISOString(),
            };

            return {
                ok: false,
                status,
                error: message,
                data,
                requestId,
                endpoint,
            };
        }

        // Success
        return {
            ok: true,
            status,
            data,
            requestId,
            endpoint,
        };
    } catch (networkError: any) {
        DiagnosticsState.lastError = {
            status: 0,
            endpoint,
            message: networkError?.message || 'NETWORK_ERROR',
            timestamp: new Date().toISOString(),
        };

        return {
            ok: false,
            status: 0,
            error: 'NETWORK_ERROR',
            raw: networkError?.message,
            endpoint,
        };
    }
};

// Helper for GET requests
export const get = async (endpoint: string, token: string | null = null) => {
    return request(endpoint, 'GET', undefined, token || undefined);
};

// Helper for POST requests
export const post = async (endpoint: string, body: any, token: string | null = null) => {
    return request(endpoint, 'POST', body, token || undefined);
};

export const getDriverSearchStatus = async (token: string) => {
    return request('/api/driver/search_status', 'GET', undefined, token);
};

export const updateDriverSearchStatus = async (token: string, status: 'ON' | 'OFF') => {
    return request('/api/driver/search_status', 'POST', { status }, token);
};

export const requestDriverReactivation = async (token: string, notes?: string) => {
    return request('/api/driver/reactivation-requests', 'POST', notes ? { notes } : {}, token);
};

export const getCompanySearchStatus = async (token: string) => {
    return request('/api/company/search_status', 'GET', undefined, token);
};

export const updateCompanySearchStatus = async (token: string, status: 'ON' | 'OFF') => {
    return request('/api/company/search_status', 'POST', { status }, token);
};

export const getCompanyReactivationRequests = async (token: string) => {
    return request('/api/company/reactivation-requests', 'GET', undefined, token);
};

export const respondToCompanyReactivationRequest = async (
    token: string,
    requestId: number,
    response: 'still_employed' | 'no_longer_employed',
    notes?: string
) => {
    return request(`/api/company/reactivation-requests/${requestId}/respond`, 'POST', notes ? { response, notes } : { response }, token);
};

// --- AUTH API WRAPPERS ---
export const checkHealth = async () => {
    return request('/health', 'GET');
};

export const login = async (contacto: string, password: string, type: 'driver' | 'empresa') => {
    return request('/login', 'POST', { contacto, password, type });
};

export const register = async (userData: any) => {
    return request('/register', 'POST', userData);
};

export const forgotPassword = async (email: string) => {
    return request('/forgot_password', 'POST', { email });
};

// Alias used by ForgotPasswordScreen.tsx
export const recoverPassword = forgotPassword;

export const verifyEmail = async (token: string) => {
    return request('/verify-email', 'POST', { token });
};

// Mantengo firma por compatibilidad. Backend espera { email }.
export const resendVerification = async (_type: 'driver' | 'empresa', contact: string) => {
    return request('/resend-verification', 'POST', { email: contact });
};

// ✅ FIX: reset_password payload correcto para backend
export const resetPassword = async (token: string, newPassword: string) => {
    return request('/reset_password', 'POST', { token, newPassword });
};

// --- TICKETS ---
export const getTickets = async (token: string) => {
    // console.log("[TICKETS] calling getTickets tokenLen", token?.length);
    const res = await request('/api/tickets/my', 'GET', undefined, token);
    if (!res.ok) throw new Error(res.error || 'Failed to fetch tickets');
    return res.data;
};

// --- DRIVER PROFILE ---
export const getDriverProfile = async (token: string) => {
    return request('/api/drivers/profile', 'GET', undefined, token);
};

export const updateDriverProfile = async (payload: any, token: string) => {
    return request('/api/drivers/profile', 'PUT', payload, token);
};

// --- REQUESTS API (Phase 2) ---
// ✅ Sincronizados con backend server.js
export const createRequest = async (
    data: { licencia_req: string; ubicacion: string; tiempo_estimado: number },
    token: string
) => {
    return request('/create_request', 'POST', data, token);
};

export const getAvailableRequests = async (token: string) => {
    const res = await request('/list_available_requests', 'GET', undefined, token);
    if (!res.ok) throw new Error(res.error || 'Error fetching requests');
    return res.data;
};

export const applyToRequest = async (requestId: number, token: string) => {
    return request('/apply_for_request', 'POST', { request_id: requestId }, token);
};

export const confirmRequest = async (requestId: number, token: string) => {
    return request('/approve_driver', 'POST', { request_id: requestId }, token);
};

// --- BILLING API (Phase 4.1) ---
export interface BillingSummary {
    pending_count: number;
    pending_amount_cents: number;
    paid_count: number;
    paid_amount_cents: number;
    currency: string;
}

export const getBillingSummary = async (token: string): Promise<BillingSummary> => {
    const res = await request('/api/billing/invoices/me?limit=100', 'GET', undefined, token);
    if (!res.ok) throw new Error(res.error || 'Failed to fetch summary');

    const invoices = (res.data as any[]) || [];
    let pendingCount = 0;
    let pendingCents = 0;
    let paidCount = 0;
    let paidCents = 0;

    invoices.forEach((inv: any) => {
        if (inv.status === 'charged' || inv.status === 'paid') {
            paidCount++;
            paidCents += inv.amount_cents || 0;
        } else if (inv.status === 'pending') {
            pendingCount++;
            pendingCents += inv.amount_cents || 0;
        }
    });

    return {
        pending_count: pendingCount,
        pending_amount_cents: pendingCents,
        paid_count: paidCount,
        paid_amount_cents: paidCents,
        currency: invoices.length > 0 ? invoices[0].currency : 'usd',
    };
};

export const getBillingTickets = async (token: string, status?: string) => {
    const res = await request('/api/billing/invoices/me?limit=100', 'GET', undefined, token);
    if (!res.ok) throw new Error(res.error || 'Failed to fetch invoices');

    let invoices = (res.data as any[]) || [];
    if (status) {
        if (status === 'paid') {
            invoices = invoices.filter((inv: any) => inv.status === 'charged' || inv.status === 'paid');
        } else if (status === 'pending') {
            invoices = invoices.filter((inv: any) => inv.status === 'pending');
        }
    }

    return invoices.map((inv: any) => ({
        ...inv,
        billing_status: inv.status === 'charged' ? 'paid' : inv.status,
        request_id: `${inv.week_start} to ${inv.week_end}`,
    }));
};

// Legacy endpoints (si todavía existen en backend viejo)
export const markTicketPaid = async (
    ticketId: number,
    paymentRef: string,
    notes: string,
    adminToken: string,
    userToken: string
) => {
    const response = await fetch(`${API_URL}/billing/tickets/${ticketId}/mark_paid`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
            'X-Admin-Token': adminToken,
        },
        body: JSON.stringify({ payment_ref: paymentRef, billing_notes: notes }),
    });

    const text = await response.text();
    if (!response.ok) throw new Error(text || 'Failed to mark paid');

    try {
        return JSON.parse(text);
    } catch {
        throw new Error('NON_JSON_RESPONSE');
    }
};

export const voidTicket = async (
    ticketId: number,
    notes: string,
    adminToken: string,
    userToken: string
) => {
    const response = await fetch(`${API_URL}/billing/tickets/${ticketId}/void`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
            'X-Admin-Token': adminToken,
        },
        body: JSON.stringify({ billing_notes: notes }),
    });

    const text = await response.text();
    if (response.status === 409) throw new Error('CONFLICT: Cannot void paid ticket');
    if (!response.ok) throw new Error(text || 'Failed to void ticket');

    try {
        return JSON.parse(text);
    } catch {
        throw new Error('NON_JSON_RESPONSE');
    }
};

// --- BILLING / STRIPE ---
export const createCheckoutSession = async (token: string, ticketId: number) => {
    return request(`/billing/tickets/${ticketId}/checkout`, 'POST', undefined, token);
};

export const createInvoiceCheckoutSession = async (token: string, invoiceId: number) => {
    const res = await request(`/api/billing/invoices/${invoiceId}/checkout`, 'POST', undefined, token);
    if (!res.ok) throw new Error(res.error || 'Failed to create checkout session');
    return res.data;
};

// Helper to map error codes to user-friendly messages
export const mapErrorToMessage = (error?: string): string => {
    switch (error) {
        case 'PASSWORDS_DO_NOT_MATCH': return 'Passwords do not match.';
        case 'USER_ALREADY_EXISTS': return 'That user already exists.';
        case 'USER_NOT_FOUND': return 'User not found.';
        case 'INVALID_CREDENTIALS': return 'Invalid credentials (incorrect password).';
        case 'TOKEN_INVALID_OR_EXPIRED': return 'The link has expired or is invalid.';
        case 'MISSING_FIELDS': return 'Missing required fields.';
        case 'NON_JSON_RESPONSE': return 'Server error (invalid response).';
        case 'NETWORK_ERROR': return 'No connection. Try again.';
        case 'CONTACT_REQUIRED': return 'Contact is required.';
        case 'PASSWORD_REQUIRED': return 'Password is required.';
        case 'EMAIL_NOT_VERIFIED': return 'Email not verified. Check your inbox.';
        case 'EMAIL_REQUIRED_FOR_VERIFICATION': return 'A valid email is required for verification.';
        case 'ALREADY_VERIFIED': return 'Your account is already verified. Please log in.';
        case 'NOT_FOUND': return 'Element not found.';
        case 'COMPANY_BLOCKED': return 'Your company has operational restrictions.';
        case 'DRIVER_OFFLINE': return 'You must be online (ON) to apply.';
        case 'NO_APPLICANT': return 'No applied driver to confirm.';
        case 'NOT_PENDING': return 'This request is no longer available.';
        default: return error || 'An unexpected error occurred.';
    }
};

// Legacy default export (compatibility)
const client = {
    get: (endpoint: string, token?: string) => get(endpoint, token || null),
    post: (endpoint: string, body: any, token?: string) => post(endpoint, body, token || null),
};

export default client;
