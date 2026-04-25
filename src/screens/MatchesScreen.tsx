import React, { useCallback, useContext, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Clipboard,
    FlatList,
    Image,
    Linking,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { initPaymentSheet, initStripe, presentPaymentSheet } from '@stripe/stripe-react-native';
import RNPrint from 'react-native-print';
import { API_URL } from '../api/config';
import { postPayAndShare } from '../api/client';
import { AuthContext } from '../context/AuthContext';

const PAYMENT_POLL_INTERVAL_MS = 2500;
const PAYMENT_POLL_MAX_RETRIES = 3;
const STRIPE_URL_SCHEME = 'driverflow';
const STRIPE_RETURN_URL = 'driverflow://stripe-redirect';

const parseList = (value: any) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export default function MatchesScreen() {
    const { userInfo: user, token, suppressPinLock, resumePinLock } = useContext(AuthContext);
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('NUEVOS');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCardId, setExpandedCardId] = useState<any>(null);
    const [payingMatchId, setPayingMatchId] = useState<any>(null);
    const [pendingPaymentMatchId, setPendingPaymentMatchId] = useState<any>(null);

    const fetchMatches = useCallback(async (options: { silent?: boolean } = {}) => {
        try {
            setError(null);
            const endpoint = user?.type === 'driver' ? 'matches/opportunities' : 'matches/candidates';
            const resp = await fetch(`${API_URL}/${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const rawBody = await resp.text();
            let data: any = null;
            if (rawBody) {
                try {
                    data = JSON.parse(rawBody);
                } catch {
                    data = rawBody;
                }
            }
            if (!resp.ok) {
                const message = typeof data === 'object' && data
                    ? data.message || data.error || `Failed to load results (${resp.status})`
                    : `Failed to load results (${resp.status})`;
                console.error('[MATCHES][ERROR]', resp.status, rawBody);
                throw new Error(String(message));
            }
            if (!Array.isArray(data)) {
                console.error('[MATCHES][INVALID_RESPONSE]', data);
                throw new Error('Invalid matches response');
            }
            setMatches(data);
            return data;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load matches';
            console.error('[MATCHES][ERROR]', error);
            setError(message);
            if (!options.silent) {
                Alert.alert('Error', message);
            }
            return [];
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token, user?.type]);

    useFocusEffect(
        useCallback(() => {
            fetchMatches({ silent: true });
        }, [fetchMatches])
    );

    const refreshMatchesUntilUnlocked = useCallback(async (matchId: any) => {
        for (let attempt = 0; attempt < PAYMENT_POLL_MAX_RETRIES; attempt++) {
            const latestMatches = await fetchMatches({ silent: true });
            const refreshedMatch = latestMatches.find(candidate => String(candidate.match_id || candidate.id) === String(matchId));
            if (refreshedMatch?.status === 'INFO_SHARED') return true;
            if (attempt < PAYMENT_POLL_MAX_RETRIES - 1) {
                await new Promise<void>(resolve => setTimeout(() => resolve(), PAYMENT_POLL_INTERVAL_MS));
            }
        }
        return false;
    }, [fetchMatches]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchMatches();
    };

    const handleStatusChange = async (matchId: any, newStatus: string) => {
        try {
            const endpointSuffix = newStatus === 'ACCEPTED' ? '/accept' : '';
            if (!endpointSuffix) {
                Alert.alert('Error', newStatus === 'DECLINED' ? 'Decline action is not supported by the server yet.' : 'Unknown action');
                return;
            }
            const resp = await fetch(`${API_URL}/matches/${matchId}${endpointSuffix}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
            });
            if (resp.ok) {
                fetchMatches();
                return;
            }
            try {
                const err = await resp.json();
                Alert.alert('Server Error', err.error || 'Failed to update status');
            } catch {
                Alert.alert('Server Error', `HTTP Error ${resp.status}`);
            }
        } catch (error: any) {
            Alert.alert('Network Failure', `Details: ${error.message}`);
        }
    };

    const handleConfirmShare = async (matchId: any) => {
        const legalText = user?.type === 'driver'
            ? 'By confirming, you authorize sharing your email and phone number with the company for work contact purposes. This action is irreversible.'
            : 'By confirming, you authorize sharing your contact info with the driver. If payment is required for this match, the information exchange charges will be presented separately.';

        Alert.alert('Legal Consent', legalText, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Authorize',
                onPress: async () => {
                    try {
                        const endpoint = user?.type === 'driver' ? 'driver/confirm-share' : 'company/confirm-share';
                        const resp = await fetch(`${API_URL}/matches/${matchId}/${endpoint}`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        if (resp.ok) {
                            fetchMatches();
                            return;
                        }
                        const error = await resp.json();
                        if (error?.error === 'driver_locked') {
                            Alert.alert('Profile Temporarily Unavailable', `You are currently in an evaluation period with another company.\n\n⏳ Available again: ${error.exclusive_until || 'soon'}`);
                            return;
                        }
                        Alert.alert(error?.error || 'Error', error?.message || 'Failed to process consent');
                    } catch {
                        Alert.alert('Error', 'Network Failure');
                    }
                }
            }
        ]);
    };

    const handleResolveMatch = async (matchId: any, resolution: string) => {
        try {
            const resp = await fetch(`${API_URL}/api/matches/${matchId}/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ resolution })
            });
            const data = await resp.json();
            if (resp.ok) {
                Alert.alert('Notice', data.message);
                fetchMatches();
            } else {
                Alert.alert('Error', data.message || data.error || 'Failed to resolve match');
            }
        } catch {
            Alert.alert('Network Failure', 'Could not access the server.');
        }
    };

    const handlePayAndShare = async (item: any) => {
        const matchId = item.match_id || item.id;
        if (!token || payingMatchId === matchId || pendingPaymentMatchId === matchId) return;
        if (item.status !== 'PAYMENT_REQUIRED') {
            await fetchMatches({ silent: true });
            return;
        }

        let pinLockSuppressed = false;
        setPayingMatchId(matchId);
        try {
            const response = await postPayAndShare(matchId, token);
            console.log("[PAYWALL DEBUG] response.data:", JSON.stringify(response.data));
            if (!response.ok || !response.data) {
                const errorCode = response.error || 'unknown_error';
                if (errorCode === 'stripe_unavailable' || errorCode === 'stripe_publishable_key_missing') {
                    Alert.alert('Payments Unavailable', 'Payment processing is temporarily unavailable. Please try again shortly.');
                } else if (response.status === 409 || errorCode === 'already_paid' || errorCode === 'invalid_state') {
                    await fetchMatches({ silent: true });
                } else {
                    Alert.alert('Error', response.error || 'Could not initiate payment.');
                }
                return;
            }

            const { publishable_key: publishableKey, client_secret: clientSecret } = response.data;
            if (!publishableKey || !clientSecret) {
                Alert.alert('Payments Unavailable', 'Payment initialization data is missing. Please try again shortly.');
                return;
            }

            await initStripe({
                publishableKey,
                urlScheme: STRIPE_URL_SCHEME,
                setReturnUrlSchemeOnAndroid: true
            });

            const paymentSheet = await initPaymentSheet({
                merchantDisplayName: 'DriverFlow',
                paymentIntentClientSecret: clientSecret,
                returnURL: STRIPE_RETURN_URL
            });
            console.log("[PAYWALL DEBUG] initPaymentSheet result:", JSON.stringify(paymentSheet));
            if (paymentSheet.error) {
                console.log("[PAYWALL ERROR] initPaymentSheet code:", paymentSheet.error.code);
                console.log("[PAYWALL ERROR] initPaymentSheet message:", paymentSheet.error.message);

                Alert.alert(
                    'Payment Error',
                    paymentSheet.error.message || 'Unable to initialize payment sheet.'
                );
                return;
            }

            suppressPinLock();
            pinLockSuppressed = true;
            const paymentResult = await presentPaymentSheet();
            console.log("[PAYWALL DEBUG] presentPaymentSheet result:", JSON.stringify(paymentResult));
            if (paymentResult.error) {
                console.log("[PAYWALL ERROR] presentPaymentSheet code:", paymentResult.error.code);
                console.log("[PAYWALL ERROR] presentPaymentSheet message:", paymentResult.error.message);

                if (paymentResult.error.code === 'Canceled') return;
                Alert.alert('Payment Error', paymentResult.error.message || 'Unable to complete payment.');
                return;
            }

            Alert.alert('Payment received', 'Payment received. Unlocking contact info...');
            setPendingPaymentMatchId(matchId);
            const unlocked = await refreshMatchesUntilUnlocked(matchId);
            if (!unlocked) {
                Alert.alert('Payment processing', 'We are waiting for the backend to confirm payment. Pull to refresh if contact info is still locked.');
            }
        } catch {
            Alert.alert('Error', 'Unable to start payment. Check your connection.');
        } finally {
            if (pinLockSuppressed) {
                resumePinLock();
            }
            setPayingMatchId(null);
            setPendingPaymentMatchId((current: any) => current === matchId ? null : current);
        }
    };

    const printDriverProfile = async (item: any) => {
        const reportDate = new Date().toLocaleDateString();
        const sectionTitleStyle = 'font-size: 15px; letter-spacing: 0.08em; color: #0f172a; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid #dbe4ee;';
        const itemRowStyle = 'margin: 0 0 8px; font-size: 13px; color: #334155;';
        const cardStyle = 'margin-bottom: 20px; padding: 18px 20px; border: 1px solid #dbe4ee; border-radius: 14px; background: #ffffff;';
        const snapshotCardStyle = 'flex: 1; min-width: 140px; padding: 14px; border-radius: 12px; background: #eff6ff; border: 1px solid #bfdbfe;';
        const profilePhoto = item.profile_photo_base64
            ? `<img src="${item.profile_photo_base64}" style="width: 96px; height: 96px; object-fit: cover; border-radius: 12px; border: 1px solid #cbd5e1;" />`
            : '';

        const driverName = item.driver_name || item.display_name || 'Driver Profile';
        const location = [item.driver_city, item.driver_state].filter(Boolean).join(', ');
        const licenseTypes = parseList(item.license_summ).join(', ');
        const endorsements = parseList(item.endorsements).join(', ');
        const operationTypes = parseList(item.op_types).join(', ');
        const trailerExperience = parseList(item.trailer_experience).join(', ');
        const paymentMethods = parseList(item.pay_methods).join(', ');

        const qualificationsSection = [
            `<p style="${itemRowStyle}"><strong>CDL:</strong> ${item.has_cdl ? 'Yes' : 'No'}</p>`,
            licenseTypes ? `<p style="${itemRowStyle}"><strong>License Types:</strong> ${licenseTypes}</p>` : '',
            endorsements ? `<p style="${itemRowStyle}"><strong>Endorsements:</strong> ${endorsements}</p>` : '',
            operationTypes ? `<p style="${itemRowStyle}"><strong>Operation Types:</strong> ${operationTypes}</p>` : '',
            trailerExperience ? `<p style="${itemRowStyle}"><strong>Trailer Experience:</strong> ${trailerExperience}</p>` : ''
        ].filter(Boolean).join('');

        const experienceSection = [
            item.experience_years !== undefined && item.experience_years !== null ? `<p style="${itemRowStyle}"><strong>Experience Years:</strong> ${item.experience_years}</p>` : '',
            item.weekly_miles !== undefined && item.weekly_miles !== null ? `<p style="${itemRowStyle}"><strong>Weekly Miles:</strong> ${item.weekly_miles}</p>` : '',
            item.longest_otr ? `<p style="${itemRowStyle}"><strong>Longest OTR:</strong> ${item.longest_otr}</p>` : '',
            item.home_time ? `<p style="${itemRowStyle}"><strong>Home Time:</strong> ${item.home_time}</p>` : '',
            item.availability ? `<p style="${itemRowStyle}"><strong>Availability:</strong> ${item.availability}</p>` : ''
        ].filter(Boolean).join('');

        const accidentsValue = item.accidents_3y !== undefined && item.accidents_3y !== null ? Number(item.accidents_3y) : null;
        const drivingRecordSection = [
            accidentsValue !== null
                ? `<p style="${itemRowStyle}; color: ${accidentsValue === 0 ? '#15803d' : '#334155'};"><strong>Accidents (3y):</strong> ${accidentsValue}</p>`
                : '',
            item.tickets_3y !== undefined && item.tickets_3y !== null ? `<p style="${itemRowStyle}"><strong>Tickets (3y):</strong> ${item.tickets_3y}</p>` : ''
        ].filter(Boolean).join('');

        const preferenceSection = [
            item.preferred_freight ? `<p style="${itemRowStyle}"><strong>Preferred Freight:</strong> ${item.preferred_freight}</p>` : '',
            item.preferred_region ? `<p style="${itemRowStyle}"><strong>Preferred Region:</strong> ${item.preferred_region}</p>` : '',
            paymentMethods ? `<p style="${itemRowStyle}"><strong>Payment Methods:</strong> ${paymentMethods}</p>` : '',
            item.willing_to_relocate !== undefined && item.willing_to_relocate !== null
                ? `<p style="${itemRowStyle}"><strong>Willing to Relocate:</strong> ${item.willing_to_relocate ? 'Yes' : 'No'}</p>`
                : ''
        ].filter(Boolean).join('');

        const documentSection = [
            item.license_front_base64 ? `
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px; font-size: 13px; color: #1e293b;">License Front</h4>
                    <img src="${item.license_front_base64}" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #d1d5db;" />
                </div>` : '',
            item.license_back_base64 ? `
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px; font-size: 13px; color: #1e293b;">License Back</h4>
                    <img src="${item.license_back_base64}" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #d1d5db;" />
                </div>` : ''
        ].filter(Boolean).join('');

        const html = `
            <html>
                <body style="font-family: Helvetica, Arial, sans-serif; padding: 28px; color: #0f172a; background: #f8fafc;">
                    <div style="margin-bottom: 24px; padding: 22px 24px; border: 1px solid #cbd5e1; border-radius: 16px; background: #ffffff;">
                        <div style="display: flex; align-items: flex-start; gap: 20px;">
                            ${profilePhoto}
                            <div style="flex: 1;">
                                <p style="margin: 0 0 6px; font-size: 12px; letter-spacing: 0.12em; color: #475569;">Driver Resume</p>
                                <h1 style="margin: 0 0 10px; font-size: 28px; color: #0f172a;">${driverName}</h1>
                                <p style="margin: 0 0 8px; font-size: 14px; color: #334155; font-weight: 600;">Professional commercial driver available for hire</p>
                                ${location ? `<p style="margin: 0 0 4px; font-size: 13px; color: #475569;"><strong>Location:</strong> ${location}</p>` : ''}
                                ${item.status ? `<p style="margin: 0 0 4px; font-size: 13px; color: #475569;"><strong>Status:</strong> ${item.status}</p>` : ''}
                                <p style="margin: 0 0 10px; font-size: 13px; color: #475569;"><strong>Generated:</strong> ${reportDate}</p>
                                <p style="margin: 0; font-size: 12px; color: #1d4ed8; font-weight: 600;">Full contact details are available only inside DriverFlow after successful match confirmation.</p>
                            </div>
                        </div>
                    </div>

                    <section style="${cardStyle}">
                        <h2 style="${sectionTitleStyle}">PROFILE SNAPSHOT</h2>
                        <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                            ${item.experience_years !== undefined && item.experience_years !== null ? `<div style="${snapshotCardStyle}"><p style="margin: 0 0 6px; font-size: 11px; letter-spacing: 0.08em; color: #475569;">YEARS OF EXPERIENCE</p><p style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">${item.experience_years} yrs</p></div>` : ''}
                            <div style="${snapshotCardStyle}"><p style="margin: 0 0 6px; font-size: 11px; letter-spacing: 0.08em; color: #475569;">CDL</p><p style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">${item.has_cdl ? 'Yes' : 'No'}</p></div>
                            ${operationTypes ? `<div style="${snapshotCardStyle}"><p style="margin: 0 0 6px; font-size: 11px; letter-spacing: 0.08em; color: #475569;">OPERATION TYPES</p><p style="margin: 0; font-size: 14px; font-weight: 700; color: #0f172a;">${operationTypes}</p></div>` : ''}
                            ${trailerExperience ? `<div style="${snapshotCardStyle}"><p style="margin: 0 0 6px; font-size: 11px; letter-spacing: 0.08em; color: #475569;">TRAILER EXPERIENCE</p><p style="margin: 0; font-size: 14px; font-weight: 700; color: #0f172a;">${trailerExperience}</p></div>` : ''}
                        </div>
                    </section>

                    ${qualificationsSection ? `<section style="${cardStyle}"><h2 style="${sectionTitleStyle}">DRIVING QUALIFICATIONS</h2>${qualificationsSection}</section>` : ''}
                    ${experienceSection ? `<section style="${cardStyle}"><h2 style="${sectionTitleStyle}">EXPERIENCE & AVAILABILITY</h2>${experienceSection}</section>` : ''}
                    ${preferenceSection ? `<section style="${cardStyle}"><h2 style="${sectionTitleStyle}">PREFERENCES</h2>${preferenceSection}</section>` : ''}
                    ${drivingRecordSection ? `<section style="${cardStyle}"><h2 style="${sectionTitleStyle}">DRIVING RECORD</h2>${drivingRecordSection}</section>` : ''}
                    ${documentSection ? `<section style="${cardStyle}"><h2 style="${sectionTitleStyle}">LICENSE DOCUMENTS</h2><p style="margin: 0 0 12px; font-size: 12px; color: #64748b;">Driver-provided license images available after match confirmation</p>${documentSection}</section>` : ''}
                    <p style="margin: 24px 4px 0; font-size: 11px; color: #64748b; text-align: center;">
                        This driver profile is shared through DriverFlow. Direct contact information is only available within the platform after successful match confirmation.
                    </p>
                </body>
            </html>
        `;

        try {
            suppressPinLock();
            await RNPrint.print({ html });
        } catch (error) {
            console.error('[PRINT] PRINT FLOW ERROR:', error);
            Alert.alert('Error', 'Failed to generate PDF');
        } finally {
            resumePinLock();
        }
    };
    const renderProfilePreview = (item: any, anonymized: boolean) => {
        const isCompanyView = user?.type === 'driver';
        const tags = isCompanyView ? parseList(item.op_types) : parseList(item.op_types || item.operation_types);
        const secondaryTags = isCompanyView ? parseList(item.modalities) : parseList(item.endorsements);
        const title = anonymized
            ? (isCompanyView ? 'Verified Company' : `Driver #${String(item.driver_id || item.id).slice(-4).toUpperCase()}`)
            : (isCompanyView ? (item.company_name || item.display_name || 'Verified Company') : (item.driver_name || item.display_name || 'Driver Candidate'));
        const subtitle = anonymized
            ? 'Location Hidden'
            : (isCompanyView ? (item.ubicacion || [item.city, item.address_state].filter(Boolean).join(', ') || 'TBD') : ([item.driver_city, item.driver_state].filter(Boolean).join(', ') || 'TBD'));

        return (
            <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                    {item.profile_photo_base64 && !anonymized && !isCompanyView ? (
                        <Image source={{ uri: item.profile_photo_base64 }} style={styles.previewAvatar} />
                    ) : item.company_logo && !anonymized && isCompanyView ? (
                        <Image source={{ uri: item.company_logo }} style={styles.previewAvatar} />
                    ) : (
                        <View style={[styles.previewAvatar, styles.previewAvatarPlaceholder]}>
                            <Text style={styles.previewAvatarText}>{isCompanyView ? '🏢' : '👤'}</Text>
                        </View>
                    )}
                    <View style={styles.previewHeaderText}>
                        <Text style={styles.cardTitle}>{title}</Text>
                        <Text style={styles.cardSubtitle}>{subtitle}</Text>
                        {!isCompanyView && <Text style={styles.previewMeta}>{item.experience_years || 0} yrs experience</Text>}
                    </View>
                </View>

                {tags.length > 0 && (
                    <View style={styles.tagRow}>
                        {tags.slice(0, 4).map((tag: string) => (
                            <View key={tag} style={styles.tagChip}><Text style={styles.tagText}>{tag}</Text></View>
                        ))}
                    </View>
                )}

                {secondaryTags.length > 0 && <Text style={styles.previewLine}>{secondaryTags.slice(0, 4).join(', ')}</Text>}
                {!isCompanyView && <Text style={styles.previewLine}>Availability: {item.availability || 'TBD'}</Text>}
                {isCompanyView && <Text style={styles.previewLine}>Freight: {item.offered_freight_types || 'N/A'}</Text>}

                {!anonymized && !isCompanyView && (
                    <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => printDriverProfile(item)}>
                        <Text style={styles.buttonText}>🖨️ Print / Export PDF</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderContactActions = (item: any) => {
        const email = user?.type === 'empresa' ? item.driver_email : item.company_email;
        const phone = user?.type === 'empresa' ? item.driver_phone : item.contact_phone;
        return (
            <View style={styles.contactActions}>
                <TouchableOpacity style={[styles.actionButton, styles.actionPrimary]} onPress={() => email && Linking.openURL(`mailto:${email}`)}>
                    <Text style={styles.actionButtonText}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.actionMuted]} onPress={() => { if (email) { Clipboard.setString(email); Alert.alert('Copied'); } }}>
                    <Text style={styles.actionButtonText}>Copy</Text>
                </TouchableOpacity>
                {phone ? (
                    <TouchableOpacity style={[styles.actionButton, styles.actionSuccess]} onPress={() => Linking.openURL(`tel:${phone}`)}>
                        <Text style={styles.actionButtonText}>Call</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        );
    };

    const renderExpandedContent = (item: any) => {
        const matchId = item.match_id || item.id;
        const myAcceptDate = user?.type === 'empresa' ? item.company_step1_accepted_at : item.driver_step1_accepted_at;
        const otherAcceptDate = user?.type === 'empresa' ? item.driver_step1_accepted_at : item.company_step1_accepted_at;
        const myConsentDate = user?.type === 'empresa' ? item.company_share_consent_at : item.driver_share_consent_at;
        const isPaymentRequired = item.status === 'PAYMENT_REQUIRED';
        const isPaying = payingMatchId === matchId;
        const isPendingPayment = pendingPaymentMatchId === matchId;

        if (item.status === 'INFO_SHARED' || item.status === 'HIRED') {
            const consentDate = item.driver_share_consent_at ? new Date(item.driver_share_consent_at) : null;
            const extensionHours = item.exclusivity_extension_hours || 0;
            const expirationDate = consentDate ? new Date(consentDate.getTime() + ((72 + extensionHours) * 60 * 60 * 1000)) : null;
            const isExpired = expirationDate ? new Date() > expirationDate : false;
            const isMaxExtension = extensionHours >= 432;
            const myResolution = user?.type === 'empresa' ? item.resolution_company : item.resolution_driver;

            return (
                <View style={styles.sharedBlock}>
                    {item.billing_status === 'free_share' && (
                        <View style={styles.freeShareBanner}>
                            <Text style={styles.freeShareBannerText}>🎁 First contact unlocked for free</Text>
                        </View>
                    )}
                    <Text style={styles.sharedTitle}>{item.status === 'HIRED' ? '🎉 Driver Hired!' : '✅ Contact Shared'}</Text>
                    <Text style={styles.sharedText}>{item.status === 'HIRED' ? 'This driver has been successfully hired.' : 'You can now contact the other party!'}</Text>

                    {user?.type === 'empresa' ? (
                        <>
                            <Text style={styles.contactLine}>{item.driver_email}</Text>
                            {item.driver_phone ? <Text style={styles.contactLine}>{item.driver_phone}</Text> : null}
                        </>
                    ) : (
                        <>
                            {item.contact_person ? <Text style={styles.contactLine}>👤 {item.contact_person}</Text> : null}
                            <Text style={styles.contactLine}>📧 {item.company_email}</Text>
                            {item.contact_phone ? <Text style={styles.contactLine}>📞 {item.contact_phone}</Text> : null}
                        </>
                    )}

                    {renderContactActions(item)}
                    {renderProfilePreview(item, false)}

                    {item.status === 'INFO_SHARED' && expirationDate && !myResolution && (isExpired || user?.type === 'empresa') ? (
                        <View style={styles.resolutionBox}>
                            <Text style={styles.stageTitle}>{isExpired ? 'Timer Expired' : 'Match Resolution'}</Text>
                            <Text style={styles.stageText}>{isExpired ? 'Was the driver hired?' : 'Decide the outcome of this match:'}</Text>
                            <TouchableOpacity style={[styles.button, styles.successButton]} onPress={() => handleResolveMatch(matchId, 'HIRED')}>
                                <Text style={styles.buttonText}>Yes (Hired)</Text>
                            </TouchableOpacity>
                            {!isMaxExtension && (
                                <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={() => handleResolveMatch(matchId, 'IN_PROCESS')}>
                                    <Text style={styles.buttonText}>Still in Process</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={() => handleResolveMatch(matchId, 'REJECTED')}>
                                <Text style={styles.buttonText}>No (Closed)</Text>
                            </TouchableOpacity>
                        </View>
                    ) : myResolution ? (
                        <Text style={styles.mutedCentered}>Marked as: {myResolution}</Text>
                    ) : expirationDate ? (
                        <Text style={styles.mutedCentered}>Exclusivity ends: {expirationDate.toLocaleDateString()}</Text>
                    ) : null}
                </View>
            );
        }

        return (
            <View>
                {renderProfilePreview(item, true)}

                {isPaymentRequired ? (
                    <View style={styles.paywallBox}>
                        <Text style={styles.stageTitle}>🔒 Contact locked — payment required</Text>
                        <Text style={styles.stageText}>No contact info is revealed until Stripe succeeds and the backend flips the match to INFO_SHARED.</Text>
                        {user?.type === 'empresa' ? (
                            <>
                                <TouchableOpacity
                                    style={[styles.button, styles.primaryButton, (isPaying || isPendingPayment) && styles.disabledButton]}
                                    disabled={isPaying || isPendingPayment}
                                    onPress={() => handlePayAndShare(item)}
                                >
                                    {isPaying || isPendingPayment ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Pay & Share</Text>}
                                </TouchableOpacity>
                                <Text style={styles.mutedCentered}>
                                    {isPendingPayment ? 'Payment received. Unlocking contact info...' : 'DriverFlow will unlock contact info only after webhook confirmation.'}
                                </Text>
                            </>
                        ) : (
                            <Text style={styles.mutedCentered}>The company must complete payment before contact info can be shared.</Text>
                        )}
                    </View>
                ) : null}

                {!myAcceptDate ? (
                    <View style={styles.stageBox}>
                        <Text style={styles.stageTitle}>{otherAcceptDate ? 'Mutual Interest! They liked your profile.' : 'New Opportunity Detected'}</Text>
                        <View style={styles.row}>
                            <TouchableOpacity style={[styles.button, styles.successButton, styles.flexButton]} onPress={() => handleStatusChange(matchId, 'ACCEPTED')}>
                                <Text style={styles.buttonText}>Accept Interest</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, styles.dangerButton, styles.flexButton]} onPress={() => handleStatusChange(matchId, 'DECLINED')}>
                                <Text style={styles.buttonText}>Decline</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : !otherAcceptDate ? (
                    <View style={styles.stageBox}>
                        <Text style={styles.stageTitle}>⏳ Waiting for response...</Text>
                        <Text style={styles.stageText}>The other party has been notified of your interest.</Text>
                    </View>
                ) : !myConsentDate ? (
                    <View style={styles.stageBox}>
                        <Text style={styles.stageTitle}>🤝 Mutual Interest Confirmed!</Text>
                        <Text style={styles.stageText}>
                            {user?.type === 'empresa'
                                ? 'Review the profile and continue. If payment is required, contact info will remain locked until Stripe confirms payment.'
                                : 'Authorize sharing your contact details with the company to proceed.'}
                        </Text>
                        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={() => handleConfirmShare(matchId)}>
                            <Text style={styles.buttonText}>{user?.type === 'empresa' ? 'Continue' : '✅ Confirm Consent'}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.stageBox}>
                        <Text style={styles.stageTitle}>🔓 Final Authorization Pending...</Text>
                        <Text style={styles.stageText}>You have authorized the exchange. Waiting for the other party to confirm.</Text>
                    </View>
                )}
            </View>
        );
    };

    const filteredMatches = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const applySearch = (list: any[]) => {
            if (!query) return list;
            return list.filter(match =>
                (match.driver_name && match.driver_name.toLowerCase().includes(query)) ||
                (match.display_name && match.display_name.toLowerCase().includes(query)) ||
                (match.company_name && match.company_name.toLowerCase().includes(query)) ||
                (match.ubicacion && match.ubicacion.toLowerCase().includes(query)) ||
                (match.driver_city && match.driver_city.toLowerCase().includes(query)) ||
                (match.driver_state && match.driver_state.toLowerCase().includes(query))
            );
        };
        return {
            newMatches: applySearch(matches.filter(match => match.status === 'NEW')),
            processMatches: applySearch(matches.filter(match => ['ACCEPTED', 'PREMATCH_READY', 'SHARE_PENDING_COMPANY', 'SHARE_PENDING_DRIVER', 'PAYMENT_REQUIRED'].includes(match.status))),
            exclusiveMatches: applySearch(matches.filter(match => match.status === 'INFO_SHARED')),
            hiredMatches: applySearch(matches.filter(match => match.status === 'HIRED'))
        };
    }, [matches, searchQuery]);

    const displayMatches = activeTab === 'NUEVOS'
        ? filteredMatches.newMatches
        : activeTab === 'EN_PROCESO'
            ? filteredMatches.processMatches
            : activeTab === 'EXCLUSIVOS'
                ? filteredMatches.exclusiveMatches
                : filteredMatches.hiredMatches;

    const renderEmptyState = () => {
        if (activeTab === 'NUEVOS') {
            return <View style={styles.emptyState}><Text style={styles.emptyTitle}>Your radar is on!</Text><Text style={styles.emptyText}>We are looking for the best opportunities for you. Swipe down to refresh.</Text></View>;
        }
        if (activeTab === 'EN_PROCESO') {
            return <View style={styles.emptyState}><Text style={styles.emptyTitle}>Nothing in progress yet</Text><Text style={styles.emptyText}>Offers you accept will appear here while waiting for a final response.</Text></View>;
        }
        if (activeTab === 'EXCLUSIVOS') {
            return <View style={styles.emptyState}><Text style={styles.emptyTitle}>No exclusive contracts</Text><Text style={styles.emptyText}>When you share your info with a company, it will appear here for 72 hours.</Text></View>;
        }
        return <View style={styles.emptyState}><Text style={styles.emptyTitle}>No hires yet</Text><Text style={styles.emptyText}>When a driver is hired through DriverFlow, the record will appear here.</Text></View>;
    };

    const renderItem = ({ item }: { item: any }) => {
        const matchId = item.match_id || item.id;
        const isExpanded = expandedCardId === matchId;
        const myAcceptDate = user?.type === 'empresa' ? item.company_step1_accepted_at : item.driver_step1_accepted_at;
        const otherAcceptDate = user?.type === 'empresa' ? item.driver_step1_accepted_at : item.company_step1_accepted_at;
        const isAnonymized = item.status !== 'INFO_SHARED' && item.status !== 'HIRED';
        const driverShortId = String(item.driver_id || item.id).slice(-4).toUpperCase();
        const companyShortId = String(item.company_id || item.id).slice(-4).toUpperCase();
        const displayName = isAnonymized
            ? (user?.type === 'empresa' ? `Driver #${driverShortId}` : `Company #${companyShortId}`)
            : (user?.type === 'empresa' ? (item.driver_name || item.display_name || 'Driver Candidate') : (item.company_name || item.display_name || 'Verified Company'));
        const displayLocation = isAnonymized
            ? (user?.type === 'driver' ? 'Logistics View' : 'Location Hidden')
            : (item.ubicacion || [item.driver_city, item.driver_state].filter(Boolean).join(', ') || 'Available');
        const stageLabel = item.status === 'HIRED'
            ? 'Driver Hired'
            : item.status === 'INFO_SHARED'
                ? 'Exclusive Evaluation'
                : item.status === 'PAYMENT_REQUIRED'
                    ? '💳 Payment Required'
                    : (myAcceptDate && otherAcceptDate)
                        ? 'Confirm Exchange'
                        : myAcceptDate
                            ? 'Waiting for response'
                            : 'New Opportunity';

        return (
            <View style={styles.card}>
                <TouchableOpacity style={styles.cardHeader} onPress={() => setExpandedCardId(isExpanded ? null : matchId)} activeOpacity={0.8}>
                    <View style={styles.row}>
                        <View style={[styles.smallAvatar, styles.previewAvatarPlaceholder]}>
                            <Text style={styles.previewAvatarText}>👤</Text>
                        </View>
                        <View style={styles.flex}>
                            <Text style={styles.cardTitle}>{displayName}</Text>
                            <Text style={styles.cardSubtitle}>{displayLocation}</Text>
                        </View>
                        <View style={styles.scoreBadge}>
                            <Text style={styles.scoreBadgeText}>{Math.round((item.match_score || 0.85) * 100)}% Match</Text>
                            <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
                        </View>
                    </View>
                    {!isExpanded && <Text style={styles.stageSummary}>Stage: {stageLabel}</Text>}
                </TouchableOpacity>

                {isExpanded && <View style={styles.expandedBody}>{renderExpandedContent(item)}</View>}
            </View>
        );
    };

    if (loading) {
        return <ActivityIndicator style={styles.loading} size="large" />;
    }

    if (error) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>Error loading matches</Text>
                    <Text style={styles.emptyText}>{error}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.pageHeading}>Matches Dashboard</Text>

            {user?.type === 'empresa' && (
                <View style={styles.searchWrap}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search driver name, city or state..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        clearButtonMode="while-editing"
                    />
                </View>
            )}

            <View style={styles.tabs}>
                {[
                    { key: 'NUEVOS', label: 'New', count: filteredMatches.newMatches.length },
                    { key: 'EN_PROCESO', label: 'In Progress', count: filteredMatches.processMatches.length },
                    { key: 'EXCLUSIVOS', label: 'Exclusive', count: filteredMatches.exclusiveMatches.length },
                    { key: 'HIRED', label: 'Hired', count: filteredMatches.hiredMatches.length }
                ].map(tab => (
                    <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.activeTab]} onPress={() => setActiveTab(tab.key)}>
                        <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
                        {tab.count > 0 && <View style={styles.tabCount}><Text style={styles.tabCountText}>{tab.count}</Text></View>}
                    </TouchableOpacity>
                ))}
            </View>

            {displayMatches.length === 0 ? renderEmptyState() : (
                <FlatList
                    data={displayMatches}
                    keyExtractor={item => String(item.match_id || item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#fcfcfc' },
    loading: { flex: 1 },
    pageHeading: { fontSize: 24, fontWeight: 'bold', color: '#222', marginBottom: 16 },
    searchWrap: { marginBottom: 16 },
    searchInput: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 14, paddingVertical: 10 },
    tabs: { flexDirection: 'row', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#ddd' },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 6 },
    activeTab: { borderBottomColor: '#007bff' },
    tabText: { fontSize: 13, fontWeight: '700', color: '#666' },
    activeTabText: { color: '#007bff' },
    tabCount: { backgroundColor: '#007bff', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 },
    tabCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    listContent: { paddingBottom: 24 },
    emptyState: { alignItems: 'center', padding: 28, marginTop: 32 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: '#222', marginBottom: 8, textAlign: 'center' },
    emptyText: { fontSize: 15, color: '#666', textAlign: 'center' },
    card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 12, marginBottom: 16, padding: 14 },
    cardHeader: { gap: 8 },
    expandedBody: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    flex: { flex: 1 },
    flexButton: { flex: 1 },
    smallAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    previewAvatar: { width: 64, height: 64, borderRadius: 32 },
    previewAvatarPlaceholder: { backgroundColor: '#e5e7eb' },
    previewAvatarText: { fontSize: 24 },
    scoreBadge: { alignItems: 'flex-end', gap: 4 },
    scoreBadgeText: { backgroundColor: '#28a745', color: '#fff', fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    chevron: { color: '#999' },
    cardTitle: { fontSize: 18, fontWeight: '700', color: '#222' },
    cardSubtitle: { color: '#666', fontSize: 13 },
    stageSummary: { fontSize: 12, color: '#777', fontStyle: 'italic', paddingLeft: 54 },
    previewCard: { backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, gap: 8 },
    previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    previewHeaderText: { flex: 1 },
    previewMeta: { color: '#2563eb', fontWeight: '600', marginTop: 4 },
    previewLine: { color: '#475569', fontSize: 13 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tagChip: { backgroundColor: '#eef2ff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
    tagText: { color: '#4338ca', fontSize: 11, fontWeight: '600' },
    sharedBlock: { backgroundColor: '#e8f5e9', borderRadius: 10, borderWidth: 1, borderColor: '#c8e6c9', padding: 14, gap: 10 },
    freeShareBanner: { backgroundColor: '#fff7cc', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#ffe58f' },
    freeShareBannerText: { color: '#7a5600', fontWeight: '600', fontSize: 13 },
    sharedTitle: { color: '#2e7d32', fontWeight: '700', fontSize: 16 },
    sharedText: { color: '#444', fontSize: 13 },
    contactLine: { fontSize: 15, color: '#333', fontWeight: '600' },
    contactActions: { flexDirection: 'row', gap: 8 },
    actionButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    actionButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    actionPrimary: { backgroundColor: '#007bff' },
    actionMuted: { backgroundColor: '#6c757d' },
    actionSuccess: { backgroundColor: '#28a745' },
    paywallBox: { backgroundColor: '#fff7ed', borderRadius: 10, borderWidth: 1, borderColor: '#fed7aa', padding: 14, marginTop: 14, gap: 8 },
    stageBox: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 14, marginTop: 14, gap: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    resolutionBox: { backgroundColor: '#fff', borderRadius: 10, padding: 14, gap: 8, borderWidth: 1, borderColor: '#cbd5e1' },
    stageTitle: { fontWeight: '700', color: '#1f2937', textAlign: 'center' },
    stageText: { color: '#64748b', textAlign: 'center', fontSize: 13 },
    mutedCentered: { color: '#64748b', fontSize: 12, textAlign: 'center' },
    button: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center' },
    primaryButton: { backgroundColor: '#007bff' },
    successButton: { backgroundColor: '#28a745' },
    dangerButton: { backgroundColor: '#dc3545' },
    secondaryButton: { backgroundColor: '#6c757d' },
    disabledButton: { opacity: 0.6 },
    buttonText: { color: '#fff', fontWeight: '700' }
});
