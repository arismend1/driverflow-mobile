import React, { useEffect, useState, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl, Clipboard, Linking, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../api/config';

export default function MatchesScreen() {
    const { userInfo: user, token } = useContext(AuthContext);
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('NUEVOS');

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
            const resp = await fetch(`${API_URL}/matches/${matchId}/resolve`, {
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

    const renderItem = ({ item }: { item: any }) => {
        const matchId = item.id || item.match_id;
        const isStep1Accepted = item.status === 'ACCEPTED' ||
            item.status === 'PREMATCH_READY' ||
            item.status === 'SHARE_PENDING_DRIVER' ||
            item.status === 'SHARE_PENDING_COMPANY' ||
            item.status === 'INFO_SHARED';

        const isReadyForStep2 = item.status === 'PREMATCH_READY' ||
            item.status === 'SHARE_PENDING_DRIVER' ||
            item.status === 'SHARE_PENDING_COMPANY';

        const isStep2Accepted = (user?.type === 'driver' && item.driver_share_consent_at) ||
            (user?.type === 'empresa' && item.company_share_consent_at) ||
            item.status === 'INFO_SHARED';

        return (
            <View style={styles.card}>
                <View style={styles.headerRow}>
                    <Text style={styles.title}>{user?.type === 'empresa' ? item.driver_name : 'Verified Company'}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{Math.round((item.match_score || 0.85) * 100)}% Match</Text>
                    </View>
                </View>

                {item.status !== 'INFO_SHARED' ? (
                    <>
                        <Text style={styles.detail}>Location: {item.ubicacion || 'TBD'}</Text>
                        <Text style={styles.detail}>License: {item.licencia_req || item.driver_license || 'B'}</Text>
                        <Text style={[styles.detail, styles.status]}>Status: {item.status || 'N/A'}</Text>
                    </>
                ) : null}

                {/* Calculate Exclusivity Expiration */}
                {(() => {
                    let isExpired = false;
                    let isMaxExtension = false;
                    let showResolutionForm = false;
                    let expirationDate = null;
                    if (item.status === 'INFO_SHARED' && item.driver_share_consent_at) {
                        const consentDate = new Date(item.driver_share_consent_at);
                        const extensionHours = item.exclusivity_extension_hours || 0;
                        expirationDate = new Date(consentDate.getTime() + ((72 + extensionHours) * 60 * 60 * 1000));
                        const now = new Date();
                        isExpired = now > expirationDate;
                        isMaxExtension = extensionHours >= 432; // 504 - 72 = 432 max before 504

                        const myResolution = user?.type === 'empresa' ? item.resolution_company : item.resolution_driver;
                        showResolutionForm = isExpired && !myResolution;
                    }

                    return (
                        <View style={styles.actionsRow}>
                            {matchId == null ? (
                                <Text style={{ color: '#dc3545' }}>Error: missing match_id</Text>
                            ) : item.status === 'INFO_SHARED' ? (
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

                                    {/* ===== Phase 6: Professional Driver Card (Company Only) ===== */}
                                    {user?.type === 'empresa' && (() => {
                                        const safeArr = (val: any) => {
                                            if (Array.isArray(val)) return val;
                                            if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; } }
                                            return [];
                                        };
                                        const trailers = safeArr(item.trailer_experience);
                                        const endors = safeArr(item.endorsements);
                                        const hasProfile = item.driver_bio || item.driver_city || item.weekly_miles || item.profile_photo_base64;

                                        if (!hasProfile) return null;

                                        return (
                                            <View style={pStyles.card}>
                                                <Text style={pStyles.cardTitle}>📋 Professional Driver Profile</Text>

                                                {/* Header: Photo + Name/Location */}
                                                <View style={pStyles.headerRow}>
                                                    {item.profile_photo_base64 ? (
                                                        <Image source={{ uri: item.profile_photo_base64 }} style={pStyles.avatar} />
                                                    ) : (
                                                        <View style={[pStyles.avatar, pStyles.avatarPlaceholder]}>
                                                            <Text style={{ fontSize: 28 }}>👤</Text>
                                                        </View>
                                                    )}
                                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                                        <Text style={pStyles.driverName}>{item.display_name || 'Driver'}</Text>
                                                        {(item.driver_city || item.driver_state) && (
                                                            <Text style={pStyles.location}>📍 {[item.driver_city, item.driver_state].filter(Boolean).join(', ')}</Text>
                                                        )}
                                                        <Text style={pStyles.expBadge}>🏷️ {item.experience_years || 0} yrs experience</Text>
                                                    </View>
                                                </View>

                                                {/* License & Endorsements */}
                                                <View style={pStyles.section}>
                                                    <Text style={pStyles.sectionTitle}>🪪 License Verification</Text>
                                                    <Text style={pStyles.field}>CDL: {item.has_cdl ? '✅ Yes' : '❌ No'}</Text>
                                                    {endors.length > 0 && <Text style={pStyles.field}>Endorsements: {endors.join(', ')}</Text>}
                                                </View>

                                                {/* Experience */}
                                                <View style={pStyles.section}>
                                                    <Text style={pStyles.sectionTitle}>🚛 Experience</Text>
                                                    {item.weekly_miles && <Text style={pStyles.field}>Weekly Miles: ~{item.weekly_miles}</Text>}
                                                    {item.longest_otr && <Text style={pStyles.field}>Longest OTR: {item.longest_otr}</Text>}
                                                    {trailers.length > 0 && <Text style={pStyles.field}>Trailers: {trailers.join(', ')}</Text>}
                                                </View>

                                                {/* Safety */}
                                                <View style={pStyles.section}>
                                                    <Text style={pStyles.sectionTitle}>🛡️ Safety Record (3 yrs)</Text>
                                                    <View style={{ flexDirection: 'row', gap: 20 }}>
                                                        <Text style={pStyles.field}>Accidents: {item.accidents_3y ?? 0}</Text>
                                                        <Text style={pStyles.field}>Tickets: {item.tickets_3y ?? 0}</Text>
                                                    </View>
                                                </View>

                                                {/* Preferences */}
                                                <View style={pStyles.section}>
                                                    <Text style={pStyles.sectionTitle}>⚙️ Work Preferences</Text>
                                                    {item.home_time && <Text style={pStyles.field}>Home Time: {item.home_time}</Text>}
                                                    {item.preferred_freight && <Text style={pStyles.field}>Freight: {item.preferred_freight}</Text>}
                                                    {item.preferred_region && <Text style={pStyles.field}>Region: {item.preferred_region}</Text>}
                                                    {item.availability && <Text style={pStyles.field}>Availability: {item.availability}</Text>}
                                                </View>

                                                {/* Bio */}
                                                {item.driver_bio ? (
                                                    <View style={pStyles.section}>
                                                        <Text style={pStyles.sectionTitle}>📝 About</Text>
                                                        <Text style={pStyles.bio}>{item.driver_bio}</Text>
                                                    </View>
                                                ) : null}

                                                {/* License Photos */}
                                                {(item.license_front_base64 || item.license_back_base64) && (
                                                    <View style={pStyles.section}>
                                                        <Text style={pStyles.sectionTitle}>📸 CDL License</Text>
                                                        {item.license_front_base64 && (
                                                            <Image source={{ uri: item.license_front_base64 }} style={pStyles.licenseImg} />
                                                        )}
                                                        {item.license_back_base64 && (
                                                            <Image source={{ uri: item.license_back_base64 }} style={pStyles.licenseImg} />
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })()}

                                    {/* Resolution Form Block */}
                                    {showResolutionForm ? (
                                        <View style={{ marginTop: 20, padding: 15, backgroundColor: '#fff3cd', borderRadius: 8, borderWidth: 1, borderColor: '#ffeeba' }}>
                                            <Text style={{ fontWeight: 'bold', color: '#856404', marginBottom: 5 }}>Exclusivity Timer Expired</Text>
                                            <Text style={{ color: '#856404', marginBottom: 15 }}>
                                                {user?.type === 'driver' ? '¿Fuiste contratado por esta empresa?' : '¿El chofer fue contratado por usted?'}
                                            </Text>
                                            <View style={{ gap: 10 }}>
                                                <TouchableOpacity style={[styles.button, styles.buttonGreen]} onPress={() => handleResolveMatch(matchId, 'HIRED')}>
                                                    <Text style={styles.buttonText}>Sí (Hired)</Text>
                                                </TouchableOpacity>
                                                {!isMaxExtension ? (
                                                    <TouchableOpacity style={[styles.button, styles.buttonBlue]} onPress={() => handleResolveMatch(matchId, 'IN_PROCESS')}>
                                                        <Text style={styles.buttonText}>En Proceso (Extend 72h)</Text>
                                                    </TouchableOpacity>
                                                ) : (
                                                    <Text style={{ color: '#dc3545', fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 4 }}>
                                                        Límite de 21 días alcanzado. Debe decidir Sí o No.
                                                    </Text>
                                                )}
                                                <TouchableOpacity style={[styles.button, styles.buttonRed]} onPress={() => handleResolveMatch(matchId, 'REJECTED')}>
                                                    <Text style={styles.buttonText}>No (Cerrar Match)</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        (() => {
                                            const myRes = user?.type === 'empresa' ? item.resolution_company : item.resolution_driver;
                                            if (myRes) return <Text style={{ marginTop: 15, color: '#666', fontStyle: 'italic', textAlign: 'center' }}>You marked this as: {myRes}</Text>;
                                            if (!isExpired && expirationDate) return <Text style={{ marginTop: 15, color: '#0056b3', fontSize: 13, textAlign: 'center' }}>Exclusivity ends: {expirationDate.toLocaleDateString()} {expirationDate.toLocaleTimeString()}</Text>;
                                            return null;
                                        })()
                                    )}
                                </View>
                            ) : user?.type === 'empresa' ? (

                                <>
                                    {item.status === 'NEW' && !item.company_step1_accepted_at && (
                                        <>
                                            {item.driver_step1_accepted_at && (
                                                <View style={{ backgroundColor: '#fff3cd', borderColor: '#ffeeba', borderWidth: 1, padding: 10, borderRadius: 8, marginBottom: 10 }}>
                                                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#856404' }}>Driver interested in your company</Text>
                                                    <Text style={{ color: '#856404', marginTop: 4 }}>This driver has accepted the match. If you accept, you will proceed to the next step.</Text>
                                                </View>
                                            )}
                                            <TouchableOpacity
                                                style={[styles.button, styles.buttonGreen]}
                                                onPress={() => handleStatusChange(matchId, 'ACCEPTED')}
                                            >
                                                <Text style={styles.buttonText}>Accept Match</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.button, styles.buttonRed]}
                                                onPress={() => handleStatusChange(matchId, 'DECLINED')}
                                            >
                                                <Text style={styles.buttonText}>Decline</Text>
                                            </TouchableOpacity>
                                        </>
                                    )}

                                    {item.company_step1_accepted_at && !item.driver_step1_accepted_at && (
                                        <View style={{ width: '100%', alignItems: 'center', marginBottom: 10 }}>
                                            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#0056b3' }}>Waiting for the other user</Text>
                                            <Text style={{ textAlign: 'center', color: '#666', marginTop: 4 }}>You have accepted this match. We are waiting for the other party to confirm.</Text>
                                        </View>
                                    )}

                                    {isReadyForStep2 && !isStep2Accepted && (
                                        <View style={{ width: '100%' }}>
                                            <View style={{ marginBottom: 8 }}>
                                                <Text style={styles.consentPrompt}>Both accepted the match</Text>
                                                <Text style={styles.consentSub}>Now you can decide whether to share contact information.</Text>
                                                <Text style={styles.consentSub}>
                                                    {!item.driver_share_consent_at ? '⏳ Waiting for the driver to authorize...' : '✅ The driver authorized sharing info.'}
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.button, styles.buttonBlue]}
                                                onPress={() => handleConfirmShare(matchId)}
                                            >
                                                <Text style={styles.buttonText}>Pay & View Contact</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {isStep2Accepted && item.status !== 'INFO_SHARED' && (
                                        <Text style={styles.waitingText}>Waiting for final mutual authorization...</Text>
                                    )}

                                    {item.status === 'HIRED_ELSEWHERE' && (
                                        <View style={{ backgroundColor: '#f8d7da', borderColor: '#f5c6cb', borderWidth: 1, padding: 10, borderRadius: 8, marginBottom: 10 }}>
                                            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#721c24' }}>Driver Hired Elsewhere</Text>
                                            <Text style={{ color: '#721c24', marginTop: 4 }}>We're sorry. This driver was hired by another company and the match is now closed.</Text>
                                        </View>
                                    )}
                                    {item.status === 'CLOSED' && (
                                        <View style={{ backgroundColor: '#f8d7da', borderColor: '#f5c6cb', borderWidth: 1, padding: 10, borderRadius: 8, marginBottom: 10 }}>
                                            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#721c24' }}>Match Closed</Text>
                                            <Text style={{ color: '#721c24', marginTop: 4 }}>This match was closed or rejected.</Text>
                                        </View>
                                    )}
                                </>
                            ) : (
                                <>
                                    {item.status === 'NEW' && !item.driver_step1_accepted_at && (
                                        <>
                                            {item.company_step1_accepted_at && (
                                                <View style={{ backgroundColor: '#fff3cd', borderColor: '#ffeeba', borderWidth: 1, padding: 10, borderRadius: 8, marginBottom: 10 }}>
                                                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#856404' }}>Company interested in you</Text>
                                                    <Text style={{ color: '#856404', marginTop: 4 }}>This company accepted your profile. If you accept, you will proceed to the next step.</Text>
                                                </View>
                                            )}
                                            <TouchableOpacity
                                                style={[styles.button, styles.buttonGreen]}
                                                onPress={() => handleStatusChange(matchId, 'ACCEPTED')}
                                            >
                                                <Text style={styles.buttonText}>Accept Offer</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.button, styles.buttonRed]}
                                                onPress={() => handleStatusChange(matchId, 'DECLINED')}
                                            >
                                                <Text style={styles.buttonText}>Decline</Text>
                                            </TouchableOpacity>
                                        </>
                                    )}

                                    {item.driver_step1_accepted_at && !item.company_step1_accepted_at && (
                                        <View style={{ width: '100%', alignItems: 'center', marginBottom: 10 }}>
                                            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#0056b3' }}>Waiting for the other user</Text>
                                            <Text style={{ textAlign: 'center', color: '#666', marginTop: 4 }}>You have accepted this match. We are waiting for the other party to confirm.</Text>
                                        </View>
                                    )}

                                    {isReadyForStep2 && !isStep2Accepted && (
                                        <View style={{ width: '100%' }}>
                                            <View style={{ marginBottom: 8 }}>
                                                <Text style={styles.consentPrompt}>Both accepted the match</Text>
                                                <Text style={styles.consentSub}>Now you can decide whether to share contact information.</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.button, styles.buttonBlue]}
                                                onPress={() => handleConfirmShare(matchId)}
                                            >
                                                <Text style={styles.buttonText}>Confirm Consent</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {isStep2Accepted && item.status !== 'INFO_SHARED' && (
                                        <Text style={styles.waitingText}>Waiting for company billing...</Text>
                                    )}

                                    {item.status === 'HIRED_ELSEWHERE' && (
                                        <View style={{ backgroundColor: '#f8d7da', borderColor: '#f5c6cb', borderWidth: 1, padding: 10, borderRadius: 8, marginBottom: 10 }}>
                                            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#721c24' }}>Hired Elsewhere</Text>
                                            <Text style={{ color: '#721c24', marginTop: 4 }}>You were marked as hired by another company. This match is closed.</Text>
                                        </View>
                                    )}
                                    {item.status === 'CLOSED' && (
                                        <View style={{ backgroundColor: '#f8d7da', borderColor: '#f5c6cb', borderWidth: 1, padding: 10, borderRadius: 8, marginBottom: 10 }}>
                                            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#721c24' }}>Match Closed</Text>
                                            <Text style={{ color: '#721c24', marginTop: 4 }}>This match was closed.</Text>
                                        </View>
                                    )}
                                </>
                            )}
                        </View>
                    );
                })()}
            </View>
        );
    };

    if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

    const newMatches = matches.filter(m => m.status === 'NEW');
    const processMatches = matches.filter(m => ['ACCEPTED', 'PREMATCH_READY', 'SHARE_PENDING_COMPANY', 'SHARE_PENDING_DRIVER', 'HIRED_ELSEWHERE', 'CLOSED'].includes(m.status));
    const exclusiveMatches = matches.filter(m => ['INFO_SHARED', 'HIRED'].includes(m.status));

    let displayMatches = [];
    if (activeTab === 'NUEVOS') displayMatches = newMatches;
    if (activeTab === 'EN_PROCESO') displayMatches = processMatches;
    if (activeTab === 'EXCLUSIVOS') displayMatches = exclusiveMatches;

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
        return (
            <View style={styles.empty}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>🤝</Text>
                <Text style={styles.emptyTitle}>No exclusive contracts</Text>
                <Text style={styles.emptyText}>When you share your info with a company, it will appear here for 72 hours.</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.pageTitle}>Matches Dashboard</Text>

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
    emptyTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#333' },
    emptyText: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 22 },
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