import React, { useEffect, useState, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl, Clipboard, Linking, Image, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../api/config';
import RNPrint from 'react-native-print';

export default function MatchesScreen() {
    const { userInfo: user, token, suppressPinLock, resumePinLock } = useContext(AuthContext);
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('NUEVOS');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCardId, setExpandedCardId] = useState<any>(null);

    const fetchMatches = async () => {
        try {
            const endpoint = user?.type === 'driver' ? 'matches/opportunities' : 'matches/candidates';
            const resp = await fetch(`${API_URL}/${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await resp.json();
            setMatches(data || []);
        } catch (e) {
            console.error('Fetch Matches Error:', e);
            Alert.alert('Error', 'Failed to load results');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchMatches();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchMatches();
    };

    const handleStatusChange = async (matchId: any, newStatus: string) => {
        try {
            let endpointSuffix = '';
            if (newStatus === 'ACCEPTED') {
                endpointSuffix = '/accept';
            } else if (newStatus === 'DECLINED') {
                Alert.alert('Error', 'Decline action is not supported by the server yet.');
                return;
            } else {
                Alert.alert('Error', 'Unknown action');
                return;
            }

            const resp = await fetch(`${API_URL}/matches/${matchId}${endpointSuffix}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            });

            if (resp.ok) {
                fetchMatches();
            } else {
                let errStr = 'Unknown error';
                try {
                    const err = await resp.json();
                    errStr = err.error || 'Failed to update status';
                } catch (jsonErr) {
                    errStr = `HTTP Error ${resp.status}`;
                }
                Alert.alert('Server Error', errStr);
            }
        } catch (e: any) {
            Alert.alert('Network Failure', `Details: ${e.message}`);
        }
    };

    const handleConfirmShare = async (matchId: any) => {
        // Legal Consent Text
        const legalText = user?.type === 'driver'
            ? "By confirming, you authorize sharing your email and phone number with the company for work contact purposes. This action is irreversible."
            : "By confirming, you authorize sharing your contact info with the driver and accept the charges for the information exchange.";

        Alert.alert(
            'Legal Consent',
            legalText,
            [
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
                            } else {
                                const err = await resp.json();
                                Alert.alert(err.error || 'Error', err.message || 'Failed to process consent');
                            }
                        } catch (e) {
                            Alert.alert('Error', 'Network Failure');
                        }
                    }
                }
            ]
        );
    };

    const handleResolveMatch = async (matchId: any, resolution: string) => {
        try {
            const resp = await fetch(`${API_URL}/api/matches/${matchId}/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ resolution })
            });
            const data = await resp.json();
            if (resp.ok) {
                Alert.alert('Notice', data.message);
                fetchMatches();
            } else {
                Alert.alert('Error', data.message || data.error || 'Failed to resolve match');
            }
        } catch (e) {
            Alert.alert('Network Failure', 'Could not access the server.');
        }
    };

    const printDriverProfile = async (item: any) => {
        try {
            const safeArr = (val: any) => {
                if (Array.isArray(val)) return val;
                if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; } }
                return [];
            };
            const trailers = safeArr(item.trailer_experience);
            const endors = safeArr(item.endorsements);

            let photoHtml = item.profile_photo_base64
                ? `<img src="${item.profile_photo_base64}" class="photo" />`
                : '<div class="photo-placeholder">👤</div>';

            let bioHtml = item.driver_bio ? `
                <div class="section">
                    <div class="section-title">📝 Professional Bio</div>
                    <div class="bio">${item.driver_bio}</div>
                </div>
            ` : '';

            let cdlDocsHtml = (item.license_front_base64 || item.license_back_base64) ? `
                <div class="section">
                    <div class="section-title">📸 CDL Documents</div>
                    <div class="license-images">
                        ${item.license_front_base64 ? `<img src="${item.license_front_base64}" class="license-img" />` : ''}
                        ${item.license_back_base64 ? `<img src="${item.license_back_base64}" class="license-img" />` : ''}
                    </div>
                </div>
            ` : '';

            const html = `
                <html>
                <head>
                    <style>
                        body { font-family: 'Helvetica', sans-serif; color: #333; padding: 20px; }
                        .header { display: flex; align-items: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 20px; }
                        .photo { width: 120px; height: 120px; border-radius: 60px; object-fit: cover; border: 3px solid #eee; margin-right: 20px; }
                        .photo-placeholder { width: 120px; height: 120px; border-radius: 60px; background: #eee; display: flex; align-items: center; justify-content: center; font-size: 40px; margin-right: 20px; }
                        .title-section { flex: 1; }
                        .name { font-size: 28px; font-weight: bold; margin: 0; }
                        .location { color: #666; font-size: 18px; margin-top: 5px; }
                        .badge { display: inline-block; background: #007bff; color: white; padding: 4px 12px; border-radius: 12px; font-size: 14px; margin-top: 8px; }
                        .section { margin-bottom: 25px; }
                        .section-title { font-size: 20px; font-weight: bold; color: #007bff; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 12px; }
                        .grid { display: flex; flex-wrap: wrap; gap: 20px; }
                        .field { width: 45%; margin-bottom: 8px; font-size: 15px; }
                        .label { font-weight: bold; color: #555; }
                        .bio { line-height: 1.6; font-size: 15px; white-space: pre-wrap; background: #f9f9f9; padding: 15px; border-radius: 8px; }
                        .license-images { display: flex; gap: 20px; margin-top: 20px; }
                        .license-img { width: 300px; height: 200px; object-fit: contain; border: 1px solid #ddd; border-radius: 8px; }
                        .footer { margin-top: 40px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        ${photoHtml}
                        <div class="title-section">
                            <h1 class="name">${item.driver_name || item.display_name || 'Driver Profile'}</h1>
                            <p class="location">📍 ${[item.driver_city, item.driver_state].filter(Boolean).join(', ') || 'Location not specified'}</p>
                            <span class="badge">${item.experience_years || 0} years experience</span>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">🪪 License & Verification</div>
                        <div class="grid">
                            <div class="field"><span class="label">CDL:</span> ${item.has_cdl ? 'Yes' : 'No'}</div>
                            <div class="field"><span class="label">License Tag:</span> ${item.driver_license || 'N/A'}</div>
                            <div class="field"><span class="label">Endorsements:</span> ${endors.join(', ') || 'None'}</div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">🚛 Work Experience</div>
                        <div class="grid">
                            <div class="field"><span class="label">Weekly Miles:</span> ${item.weekly_miles || 'N/A'}</div>
                            <div class="field"><span class="label">Longest OTR:</span> ${item.longest_otr || 'N/A'}</div>
                            <div class="field"><span class="label">Trailers:</span> ${trailers.join(', ') || 'None'}</div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">🛡️ Safety Record (Last 3 Years)</div>
                        <div class="grid">
                            <div class="field"><span class="label">Accidents:</span> ${item.accidents_3y ?? 0}</div>
                            <div class="field"><span class="label">Tickets:</span> ${item.tickets_3y ?? 0}</div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">⚙️ Preferences & Availability</div>
                        <div class="grid">
                            <div class="field"><span class="label">Home Time:</span> ${item.home_time || 'N/A'}</div>
                            <div class="field"><span class="label">Preferred Freight:</span> ${item.preferred_freight || 'N/A'}</div>
                            <div class="field"><span class="label">Preferred Region:</span> ${item.preferred_region || 'N/A'}</div>
                            <div class="field"><span class="label">Availability:</span> ${item.availability || 'N/A'}</div>
                        </div>
                    </div>

                    ${bioHtml}

                    ${cdlDocsHtml}

                    <div class="footer">
                        Generated by DriverFlow on ${new Date().toLocaleString()}
                    </div>
                </body>
                </html>
            `;

            console.log("[PRINT] PRINT FLOW START");
            suppressPinLock(); // Prevent PIN screen while print preview is open
            console.log("[PRINT] PRINT SHEET OPENING...");

            await RNPrint.print({ html });

            console.log("[PRINT] PRINT FLOW END");
        } catch (e: any) {
            console.error('[PRINT] PRINT FLOW ERROR:', e);
            Alert.alert('Error', 'Failed to generate PDF');
        } finally {
            resumePinLock();
        }
    };

    const renderProfessionalProfile = (item: any, isAnonymized: boolean = false) => {
        const driverId = item.driver_id || item.id;
        const shortId = typeof driverId === 'string' ? driverId.slice(-4).toUpperCase() : String(driverId);

        const displayName = isAnonymized ? `Driver #${shortId}` : (item.driver_name || item.display_name || 'Driver Candidate');
        const displayLocation = isAnonymized ? "Location Hidden" : ([item.driver_city, item.driver_state].filter(Boolean).join(', ') || 'TBD');

        const parseJSON = (val: any) => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        };

        const endors = parseJSON(item.endorsements);
        const lTypes = parseJSON(item.license_summ || item.license_types);
        const oTypes = parseJSON(item.op_types || item.operation_types);
        const trailers = parseJSON(item.trailer_experience);

        return (
            <View style={pStyles.card}>
                <Text style={pStyles.cardTitle}>📋 Professional Driver Profile</Text>

                <View style={pStyles.headerRow}>
                    {!isAnonymized && item.profile_photo_base64 ? (
                        <Image source={{ uri: item.profile_photo_base64 }} style={pStyles.avatar} />
                    ) : (
                        <View style={[pStyles.avatar, pStyles.avatarPlaceholder]}>
                            <Text style={{ fontSize: 28 }}>👤</Text>
                        </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={pStyles.driverName}>{displayName}</Text>
                        <Text style={pStyles.location}>📍 {displayLocation}</Text>
                        <Text style={pStyles.expBadge}>🏷️ {item.experience_years || 0} yrs experience</Text>
                    </View>
                </View>

                <View style={pStyles.section}>
                    <Text style={pStyles.sectionTitle}>🪪 License Verification</Text>
                    <Text style={pStyles.field}>CDL: {item.has_cdl ? '✅ Yes' : '❌ No'}</Text>
                    {lTypes.length > 0 && <Text style={pStyles.field}>Types: {lTypes.join(', ')}</Text>}
                    {endors.length > 0 && <Text style={pStyles.field}>Endorsements: {endors.join(', ')}</Text>}
                </View>

                <View style={pStyles.section}>
                    <Text style={pStyles.sectionTitle}>🚛 Experience</Text>
                    {item.weekly_miles && <Text style={pStyles.field}>Weekly Miles: ~{item.weekly_miles}</Text>}
                    {item.longest_otr && <Text style={pStyles.field}>Longest OTR: {item.longest_otr}</Text>}
                    {oTypes.length > 0 && <Text style={pStyles.field}>Operation: {oTypes.join(', ')}</Text>}
                    {trailers.length > 0 && <Text style={pStyles.field}>Trailers: {trailers.join(', ')}</Text>}
                </View>

                <View style={pStyles.section}>
                    <Text style={pStyles.sectionTitle}>🛡️ Safety Record</Text>
                    <Text style={pStyles.field}>Accidents: {item.accidents_3y ?? 0} | Tickets: {item.tickets_3y ?? 0}</Text>
                </View>

                <View style={pStyles.section}>
                    <Text style={pStyles.sectionTitle}>⚙️ Availability</Text>
                    <Text style={pStyles.field}>Start: {item.availability || 'TBD'}</Text>
                    {item.home_time && <Text style={pStyles.field}>Home Time: {item.home_time}</Text>}
                </View>

                {item.driver_bio && (
                    <View style={pStyles.section}>
                        <Text style={pStyles.sectionTitle}>📝 About</Text>
                        <Text style={pStyles.bio}>{item.driver_bio}</Text>
                    </View>
                )}

                {!isAnonymized && (
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: '#6c757d', marginTop: 15 }]}
                        onPress={() => printDriverProfile(item)}
                    >
                        <Text style={styles.buttonText}>🖨️ Print / Export PDF</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderCompanyHero = (item: any, isAnonymized: boolean = false) => {
        const payMin = item.pay_per_mile_min;
        const payMax = item.pay_per_mile_max;
        const hasPay = payMin || payMax;

        const displayName = isAnonymized ? 'Verified Company' : (item.company_name || item.display_name || 'Verified Company');
        const displayLocation = isAnonymized ? "Location Hidden" : (item.ubicacion || [item.city, item.address_state].filter(Boolean).join(', ') || 'TBD');

        const parseJSON = (val: any) => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        };

        const opTypes = parseJSON(item.op_types);
        const payMethods = parseJSON(item.pay_methods);
        const modalities = parseJSON(item.modalities);
        const endorsements = parseJSON(item.endorsements);

        return (
            <View style={[pStyles.card, { borderLeftWidth: 5, borderLeftColor: '#000' }]}>
                {/* Hero Header: Pay Range */}
                {hasPay && (
                    <View style={cHStyles.heroBanner}>
                        <Text style={cHStyles.heroLabel}>💰 Est. Pay per Mile</Text>
                        <Text style={cHStyles.heroValue}>${payMin || '0.00'} – ${payMax || '0.00'}</Text>
                    </View>
                )}

                <View style={pStyles.headerRow}>
                    {item.company_logo && !isAnonymized ? (
                        <Image source={{ uri: item.company_logo }} style={pStyles.avatar} />
                    ) : (
                        <View style={[pStyles.avatar, pStyles.avatarPlaceholder]}>
                            <Text style={{ fontSize: 28 }}>🏢</Text>
                        </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={pStyles.driverName}>{displayName}</Text>
                        <Text style={pStyles.location}>📍 {displayLocation}</Text>
                        <View style={cHStyles.verifiedRow}>
                            <Text style={cHStyles.verifiedText}>✅ Verified Profile</Text>
                        </View>
                    </View>
                </View>

                {item.company_bio && !isAnonymized ? (
                    <View style={pStyles.section}>
                        <Text style={pStyles.sectionTitle}>📝 About Us</Text>
                        <Text style={pStyles.bio}>{item.company_bio}</Text>
                    </View>
                ) : null}

                <View style={pStyles.section}>
                    <Text style={pStyles.sectionTitle}>🚛 Logistics Details</Text>

                    {/* Operation & Modalities */}
                    <View style={styles.optionContainer}>
                        {opTypes.map((t: string) => (
                            <View key={t} style={cHStyles.tag}><Text style={cHStyles.tagText}>{t}</Text></View>
                        ))}
                        {modalities.map((t: string) => (
                            <View key={t} style={[cHStyles.tag, { backgroundColor: '#eef2ff' }]}><Text style={cHStyles.tagText}>{t}</Text></View>
                        ))}
                    </View>

                    {/* Freight & Home Time */}
                    <View style={{ marginTop: 8 }}>
                        {item.offered_freight_types ? (
                            <Text style={pStyles.field}>📦 Freight: {item.offered_freight_types}</Text>
                        ) : null}
                        {item.home_time ? (
                            <Text style={pStyles.field}>🏠 Home time: {item.home_time}</Text>
                        ) : null}
                        {item.availability ? (
                            <Text style={pStyles.field}>⚡ Start: {item.availability}</Text>
                        ) : null}
                        <Text style={pStyles.field}>✈️ Travel for interview: {item.requires_travel_interview ? 'Required' : 'Not Required'}</Text>
                    </View>

                    {/* Payment & Endorsements */}
                    <View style={[styles.optionContainer, { marginTop: 12 }]}>
                        {payMethods.map((m: string) => (
                            <View key={m} style={[cHStyles.tag, { backgroundColor: '#e2f3f5' }]}><Text style={cHStyles.tagText}>{m}</Text></View>
                        ))}
                        {endorsements.map((e: string) => (
                            <View key={e} style={[cHStyles.tag, { backgroundColor: '#fff7ed' }]}><Text style={cHStyles.tagText}>{e} Endorsement</Text></View>
                        ))}
                    </View>
                </View>
            </View>
        );
    };

    const renderItem = ({ item }: { item: any }) => {
        const matchId = item.match_id || item.id;
        const isExpanded = expandedCardId === matchId;
        const isReadyForStep2 = (user?.type === 'empresa' && item.driver_step1_accepted_at) || (user?.type === 'driver' && item.company_step1_accepted_at);
        const isStep2Accepted = (user?.type === 'empresa' && item.company_share_consent_at) || (user?.type === 'driver' && item.driver_share_consent_at);

        // Anonymization logic
        const isAnonymized = user?.type === 'empresa' && item.status === 'NEW';
        const driverId = item.driver_id || item.id;
        const shortId = typeof driverId === 'string' ? driverId.slice(-4).toUpperCase() : String(driverId);

        const displayName = isAnonymized ? `Driver #${shortId}` : (user?.type === 'empresa' ? (item.driver_name || item.display_name || 'Driver Candidate') : 'Verified Company');
        const displayLocation = isAnonymized ? (user?.type === 'driver' ? "Logistics View" : "Location Hidden") : (item.ubicacion || [item.driver_city, item.driver_state].filter(Boolean).join(', ') || 'Available');

        return (
            <View style={styles.card}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setExpandedCardId(isExpanded ? null : matchId)}
                    style={styles.cardTouchableHeader}
                >
                    <View style={styles.headerRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            {!isAnonymized && item.profile_photo_base64 && user?.type === 'empresa' ? (
                                <Image source={{ uri: item.profile_photo_base64 }} style={styles.headerAvatar} />
                            ) : (
                                <View style={[styles.headerAvatar, { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' }]}>
                                    <Text style={{ fontSize: 16 }}>👤</Text>
                                </View>
                            )}
                            <View style={{ marginLeft: 10, flex: 1 }}>
                                <Text style={styles.title} numberOfLines={1}>
                                    {displayName}
                                </Text>
                                <Text style={styles.headerSubtitle} numberOfLines={1}>
                                    {displayLocation}
                                </Text>
                            </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{Math.round((item.match_score || 0.85) * 100)}% Match</Text>
                            </View>
                            <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
                        </View>
                    </View>

                    {!isExpanded && (
                        <View style={styles.collapsedBrief}>
                            <Text style={styles.briefText}>
                                Status: {item.status} {user?.type === 'empresa' ? `• Experience: ${item.experience_years || 0} yrs` : ''}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.cardExpandedContent}>
                        {item.status === 'INFO_SHARED' ? (
                            <View style={styles.sharedInfoBlock}>
                                <Text style={styles.sharedTitle}>✅ Contact Shared</Text>
                                <Text style={styles.sharedText}>You can now contact the other party!</Text>

                                {user?.type === 'empresa' ? (
                                    <>
                                        <Text style={styles.contactEmail}>{item.driver_email}</Text>
                                        {item.driver_phone ? <Text style={styles.contactPhone}>{item.driver_phone}</Text> : null}
                                    </>
                                ) : (
                                    <>
                                        <Text style={styles.contactEmail}>{item.company_email}</Text>
                                        {item.company_phone ? <Text style={styles.contactPhone}>{item.company_phone}</Text> : null}
                                    </>
                                )}

                                <View style={styles.contactActions}>
                                    <TouchableOpacity style={[styles.actionBtn, styles.btnEmail]} onPress={() => { const email = user?.type === 'empresa' ? item.driver_email : item.company_email; if (email) Linking.openURL(`mailto:${email}`); }}>
                                        <Text style={styles.actionBtnText}>Email</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.actionBtn, styles.btnCopy]} onPress={() => { const email = user?.type === 'empresa' ? item.driver_email : item.company_email; if (email) { Clipboard.setString(email); Alert.alert('Copied'); } }}>
                                        <Text style={styles.actionBtnText}>Copy</Text>
                                    </TouchableOpacity>
                                    {(user?.type === 'empresa' ? item.driver_phone : item.company_phone) ? (
                                        <TouchableOpacity style={[styles.actionBtn, styles.btnCall]} onPress={() => { const phone = user?.type === 'empresa' ? item.driver_phone : item.company_phone; if (phone) Linking.openURL(`tel:${phone}`); }}>
                                            <Text style={styles.actionBtnText}>Call</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>

                                {user?.type === 'empresa' && renderProfessionalProfile(item, false)}

                                {(() => {
                                    const consentDate = item.driver_share_consent_at ? new Date(item.driver_share_consent_at) : null;
                                    if (!consentDate) return null;
                                    const extensionHours = item.exclusivity_extension_hours || 0;
                                    const expirationDate = new Date(consentDate.getTime() + ((72 + extensionHours) * 60 * 60 * 1000));
                                    const now = new Date();
                                    const isExpired = now > expirationDate;
                                    const isMaxExtension = extensionHours >= 432;

                                    if (item.status === 'HIRED') {
                                        return (
                                            <View style={{ marginTop: 15, padding: 12, backgroundColor: '#d4edda', borderRadius: 8, borderWidth: 1, borderColor: '#c3e6cb' }}>
                                                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#155724' }}>🎉 Driver Hired!</Text>
                                                <Text style={{ color: '#155724', marginTop: 4 }}>This driver has been successfully hired.</Text>
                                            </View>
                                        );
                                    }

                                    const myRes = user?.type === 'empresa' ? item.resolution_company : item.resolution_driver;
                                    if (myRes) return <Text style={{ marginTop: 15, color: '#666', fontStyle: 'italic', textAlign: 'center' }}>Marked as: {myRes}</Text>;

                                    if (isExpired) {
                                        return (
                                            <View style={{ marginTop: 20, padding: 15, backgroundColor: '#fff3cd', borderRadius: 8, borderWidth: 1, borderColor: '#ffeeba' }}>
                                                <Text style={{ fontWeight: 'bold', color: '#856404', marginBottom: 5 }}>Timer Expired</Text>
                                                <Text style={{ color: '#856404', marginBottom: 15 }}>Was the driver hired?</Text>
                                                <View style={{ gap: 10 }}>
                                                    <TouchableOpacity style={[styles.button, styles.buttonGreen]} onPress={() => handleResolveMatch(matchId, 'HIRED')}>
                                                        <Text style={styles.buttonText}>Yes (Hired)</Text>
                                                    </TouchableOpacity>
                                                    {!isMaxExtension && (
                                                        <TouchableOpacity style={[styles.button, styles.buttonBlue]} onPress={() => handleResolveMatch(matchId, 'IN_PROCESS')}>
                                                            <Text style={styles.buttonText}>Still in Process</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                    <TouchableOpacity style={[styles.button, styles.buttonRed]} onPress={() => handleResolveMatch(matchId, 'REJECTED')}>
                                                        <Text style={styles.buttonText}>No (Closed)</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    }

                                    return (
                                        <Text style={{ marginTop: 15, color: '#0056b3', fontSize: 13, textAlign: 'center' }}>
                                            Exclusivity ends: {expirationDate.toLocaleDateString()}
                                        </Text>
                                    );
                                })()}
                            </View>
                        ) : user?.type === 'empresa' ? (
                            <>
                                {isAnonymized ? renderProfessionalProfile(item, true) : (
                                    <>
                                        <Text style={styles.detail}>Location: {item.ubicacion || 'TBD'}</Text>
                                        <Text style={styles.detail}>Status: {item.status}</Text>
                                    </>
                                )}

                                {item.status === 'NEW' && !item.company_step1_accepted_at && (
                                    <View style={styles.actionsRow}>
                                        <TouchableOpacity style={[styles.button, styles.buttonGreen, { flex: 1 }]} onPress={() => handleStatusChange(matchId, 'ACCEPTED')}>
                                            <Text style={styles.buttonText}>Accept</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.button, styles.buttonRed, { flex: 1 }]} onPress={() => handleStatusChange(matchId, 'DECLINED')}>
                                            <Text style={styles.buttonText}>Decline</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {isReadyForStep2 && !isStep2Accepted && (
                                    <View style={{ marginTop: 15 }}>
                                        <Text style={styles.consentPrompt}>Both Interest Confirmed</Text>
                                        <TouchableOpacity style={[styles.button, styles.buttonBlue]} onPress={() => handleConfirmShare(matchId)}>
                                            <Text style={styles.buttonText}>Pay & View Contact</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </>
                        ) : (
                            <>
                                {renderCompanyHero(item, item.status === 'NEW')}

                                {item.status === 'NEW' && !item.driver_step1_accepted_at && (
                                    <View style={styles.actionsRow}>
                                        <TouchableOpacity style={[styles.button, styles.buttonGreen, { flex: 1 }]} onPress={() => handleStatusChange(matchId, 'ACCEPTED')}>
                                            <Text style={styles.buttonText}>Accept</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.button, styles.buttonRed, { flex: 1 }]} onPress={() => handleStatusChange(matchId, 'DECLINED')}>
                                            <Text style={styles.buttonText}>Decline</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {isReadyForStep2 && !isStep2Accepted && (
                                    <View style={{ marginTop: 15 }}>
                                        <Text style={styles.consentPrompt}>Both Interest Confirmed</Text>
                                        <TouchableOpacity style={[styles.button, styles.buttonBlue]} onPress={() => handleConfirmShare(matchId)}>
                                            <Text style={styles.buttonText}>Confirm Consent</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                )}
            </View>
        );
    };

    if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

    const filterBySearch = (list: any[]) => {
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(m =>
            (m.driver_name && m.driver_name.toLowerCase().includes(q)) ||
            (m.display_name && m.display_name.toLowerCase().includes(q)) ||
            (m.company_name && m.company_name.toLowerCase().includes(q)) ||
            (m.ubicacion && m.ubicacion.toLowerCase().includes(q)) ||
            (m.driver_city && m.driver_city.toLowerCase().includes(q)) ||
            (m.driver_state && m.driver_state.toLowerCase().includes(q))
        );
    };

    const newMatches = filterBySearch(matches.filter(m => m.status === 'NEW'));
    const processMatches = filterBySearch(matches.filter(m => ['ACCEPTED', 'PREMATCH_READY', 'SHARE_PENDING_COMPANY', 'SHARE_PENDING_DRIVER'].includes(m.status)));
    const exclusiveMatches = filterBySearch(matches.filter(m => m.status === 'INFO_SHARED'));
    const hiredMatches = filterBySearch(matches.filter(m => m.status === 'HIRED'));

    let displayMatches: any[] = [];
    if (activeTab === 'NUEVOS') displayMatches = newMatches;
    if (activeTab === 'EN_PROCESO') displayMatches = processMatches;
    if (activeTab === 'EXCLUSIVOS') displayMatches = exclusiveMatches;
    if (activeTab === 'HIRED') displayMatches = hiredMatches;

    const renderEmptyState = () => {
        if (activeTab === 'NUEVOS') {
            return (
                <View style={styles.empty}>
                    <Text style={{ fontSize: 40, marginBottom: 10 }}>📡</Text>
                    <Text style={styles.emptyTitle}>Your radar is on!</Text>
                    <Text style={styles.emptyText}>We are looking for the best opportunities for you. Swipe down to refresh.</Text>
                </View>
            );
        }
        if (activeTab === 'EN_PROCESO') {
            return (
                <View style={styles.empty}>
                    <Text style={{ fontSize: 40, marginBottom: 10 }}>⏳</Text>
                    <Text style={styles.emptyTitle}>Nothing in progress yet</Text>
                    <Text style={styles.emptyText}>Offers you accept will appear here while waiting for a final response.</Text>
                </View>
            );
        }
        if (activeTab === 'EXCLUSIVOS') {
            return (
                <View style={styles.empty}>
                    <Text style={{ fontSize: 40, marginBottom: 10 }}>🤝</Text>
                    <Text style={styles.emptyTitle}>No exclusive contracts</Text>
                    <Text style={styles.emptyText}>When you share your info with a company, it will appear here for 72 hours.</Text>
                </View>
            );
        }
        if (activeTab === 'HIRED') {
            return (
                <View style={styles.empty}>
                    <Text style={{ fontSize: 40, marginBottom: 10 }}>🎉</Text>
                    <Text style={styles.emptyTitle}>No hires yet</Text>
                    <Text style={styles.emptyText}>When a driver is hired through DriverFlow, the record will appear here.</Text>
                </View>
            );
        }
        return null;
    };

    return (
        <View style={styles.container}>
            <Text style={styles.pageTitle}>Matches Dashboard</Text>

            {user?.type === 'empresa' && (
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search driver name, city or state..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        clearButtonMode="while-editing"
                    />
                    <Text style={{ position: 'absolute', right: 25, top: 10, fontSize: 18, color: '#999' }}>🔍</Text>
                </View>
            )}

            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, activeTab === 'NUEVOS' && styles.activeTab]} onPress={() => setActiveTab('NUEVOS')}>
                    <View style={styles.tabContentRow}>
                        <Text style={[styles.tabText, activeTab === 'NUEVOS' && styles.activeTabText]}>New</Text>
                        {newMatches.length > 0 && <View style={[styles.badgeDot, { backgroundColor: '#dc3545' }]}><Text style={styles.badgeCount}>{newMatches.length}</Text></View>}
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.tab, activeTab === 'EN_PROCESO' && styles.activeTab]} onPress={() => setActiveTab('EN_PROCESO')}>
                    <View style={styles.tabContentRow}>
                        <Text style={[styles.tabText, activeTab === 'EN_PROCESO' && styles.activeTabText]}>In Progress</Text>
                        {processMatches.length > 0 && <View style={[styles.badgeDot, { backgroundColor: '#007bff' }]}><Text style={styles.badgeCount}>{processMatches.length}</Text></View>}
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.tab, activeTab === 'EXCLUSIVOS' && styles.activeTab]} onPress={() => setActiveTab('EXCLUSIVOS')}>
                    <View style={styles.tabContentRow}>
                        <Text style={[styles.tabText, activeTab === 'EXCLUSIVOS' && styles.activeTabText]}>Exclusive</Text>
                        {exclusiveMatches.length > 0 && <View style={[styles.badgeDot, { backgroundColor: '#28a745' }]}><Text style={styles.badgeCount}>{exclusiveMatches.length}</Text></View>}
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.tab, activeTab === 'HIRED' && styles.activeTab]} onPress={() => setActiveTab('HIRED')}>
                    <View style={styles.tabContentRow}>
                        <Text style={[styles.tabText, activeTab === 'HIRED' && styles.activeTabText]}>Hired</Text>
                        {hiredMatches.length > 0 && <View style={[styles.badgeDot, { backgroundColor: '#6f42c1' }]}><Text style={styles.badgeCount}>{hiredMatches.length}</Text></View>}
                    </View>
                </TouchableOpacity>
            </View>

            {displayMatches.length === 0 ? (
                renderEmptyState()
            ) : (
                <FlatList
                    data={displayMatches}
                    keyExtractor={(item) => String(item.match_id || item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#fcfcfc' },
    pageTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, color: '#333' },

    tabContainer: { flexDirection: 'row', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#ddd' },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    activeTab: { borderBottomColor: '#007bff' },
    tabText: { fontSize: 13, color: '#666', fontWeight: 'bold' },
    activeTabText: { color: '#007bff' },
    tabContentRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    badgeDot: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    badgeCount: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    card: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, elevation: 1, borderWidth: 1, borderColor: '#eee' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    title: { fontSize: 18, fontWeight: 'bold', flex: 1, paddingRight: 10, color: '#333' },

    badge: { backgroundColor: '#4CAF50', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    badgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

    detail: { fontSize: 14, color: '#666', marginBottom: 5 },
    status: { fontWeight: 'bold', color: '#007bff' },

    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 8 },

    button: { paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, alignItems: 'center', marginTop: 6, minWidth: 120 },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

    buttonGreen: { backgroundColor: '#28a745' },
    buttonRed: { backgroundColor: '#dc3545' },
    buttonBlue: { backgroundColor: '#007bff' },

    sharedInfoBlock: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 10, width: '100%', borderWidth: 1, borderColor: '#c8e6c9' },
    sharedTitle: { color: '#2e7d32', fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
    sharedText: { color: '#444', marginBottom: 12, fontSize: 13 },

    contactEmail: { fontSize: 15, color: '#333', fontWeight: 'bold', marginBottom: 4 },
    contactPhone: { fontSize: 15, color: '#333', marginBottom: 10 },
    contactActions: { flexDirection: 'row', gap: 8, marginTop: 5 },
    actionBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, flex: 1, alignItems: 'center' },
    actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    btnEmail: { backgroundColor: '#007bff' },
    btnCopy: { backgroundColor: '#6c757d' },
    btnCall: { backgroundColor: '#28a745' },

    waitingText: { color: '#007bff', fontStyle: 'italic', marginTop: 8, fontSize: 13 },
    consentPrompt: { fontSize: 14, color: '#333', fontWeight: 'bold' },
    consentSub: { fontSize: 12, color: '#666' },

    empty: { alignItems: 'center', marginTop: 50, paddingHorizontal: 20 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#000', marginBottom: 5 },
    emptyText: { fontSize: 16, color: '#666', textAlign: 'center', paddingHorizontal: 30 },
    searchContainer: { marginBottom: 15, paddingHorizontal: 2, position: 'relative' },
    searchInput: { backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 15, borderWidth: 1, borderColor: '#ddd', fontSize: 15, color: '#333' },

    cardTouchableHeader: { padding: 5 },
    headerAvatar: { width: 44, height: 44, borderRadius: 22 },
    headerSubtitle: { fontSize: 13, color: '#666', marginTop: 1 },
    expandIcon: { fontSize: 18, color: '#999', marginTop: 2 },
    collapsedBrief: { marginTop: 8, paddingLeft: 54, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 6 },
    briefText: { fontSize: 12, color: '#777', fontStyle: 'italic' },
    cardExpandedContent: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
    optionContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
});

const cHStyles = StyleSheet.create({
    heroBanner: {
        backgroundColor: '#000',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        marginBottom: 15
    },
    heroLabel: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    heroValue: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '900',
        marginTop: 2
    },
    verifiedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4
    },
    verifiedText: {
        color: '#10b981',
        fontSize: 12,
        fontWeight: '600'
    },
    tag: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
        marginRight: 6,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    tagText: {
        fontSize: 11,
        color: '#475569',
        fontWeight: '600'
    }
});

// Phase 6: Professional Driver Card Styles
const pStyles = StyleSheet.create({
    card: {
        marginTop: 15, backgroundColor: '#f8f9fa', borderRadius: 10,
        padding: 15, borderWidth: 1, borderColor: '#dee2e6'
    },
    cardTitle: {
        fontSize: 16, fontWeight: 'bold', color: '#1a202c',
        marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 8
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#cbd5e0' },
    avatarPlaceholder: {
        backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center'
    },
    driverName: { fontSize: 18, fontWeight: 'bold', color: '#1a202c' },
    location: { fontSize: 14, color: '#4a5568', marginTop: 2 },
    expBadge: { fontSize: 13, color: '#2b6cb0', marginTop: 4, fontWeight: '600' },
    section: {
        marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0'
    },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#2d3748', marginBottom: 6 },
    field: { fontSize: 13, color: '#4a5568', marginBottom: 3 },
    bio: { fontSize: 13, color: '#4a5568', fontStyle: 'italic', lineHeight: 18 },
    licenseImg: {
        width: '100%', height: 160, borderRadius: 8, marginTop: 8,
        resizeMode: 'cover', borderWidth: 1, borderColor: '#cbd5e0'
    },
});