// Defense in depth: locked matches may contain preview fields, but must never
// retain direct contact details, legal names, or document images in UI state.
// The backend remains the authoritative access-control boundary.
const privateMatchFields = new Set([
    'driver_name', 'display_name', 'nombre', 'full_name', 'last_name',
    'driver_email', 'driver_phone', 'email', 'phone', 'contacto',
    'contact_email', 'contact_number', 'phone_number',
    'company_name', 'company_email', 'contact_phone', 'contact_person',
    'profile_photo_base64', 'license_front_base64', 'license_back_base64',
    'profile_photo', 'license_front', 'license_back', 'company_logo',
    'driver_bio',
]);

export const sanitizeMatchForDisplay = <T extends Record<string, any>>(match: T): T => {
    if (match.status === 'INFO_SHARED' || match.status === 'HIRED') return match;
    const safe: Record<string, any> = {};
    for (const [key, value] of Object.entries(match)) {
        if (!privateMatchFields.has(key)) safe[key] = value;
    }
    return safe as T;
};
