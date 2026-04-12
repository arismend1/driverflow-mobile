import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
    checkHealth,
    getCompanySearchStatus,
    getDriverSearchStatus,
    requestDriverReactivation,
    updateCompanySearchStatus,
    updateDriverSearchStatus
} from '../api/client';
import { API_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen() {
    const navigation = useNavigation<any>();
    const { userInfo, logout, token, updateUserSearchStatus } = useAuth();
    const [_connected, setConnected] = useState<boolean | null>(null);
    const [searchStatus, setSearchStatus] = useState<string>('OFF');
    const [banner, setBanner] = useState<{ image_url: string } | null>(null);
    const [driverReactivation, setDriverReactivation] = useState<any | null>(null);
    const [reactivationSubmitting, setReactivationSubmitting] = useState(false);

    // A) Conectividad
    useEffect(() => {
        let alive = true;
        const verifyConnection = async () => {
            setConnected(null);
            const result = await checkHealth();
            if (alive) setConnected(result.ok);
        };
        verifyConnection();
        return () => {
            alive = false;
        };
    }, []);

    const isCompany = userInfo?.type === 'empresa';

    const applySearchPayload = useCallback(async (data: any) => {
        const nextStatus = data?.status || 'ON';
        setSearchStatus(nextStatus);
        await updateUserSearchStatus(nextStatus);

        if (isCompany) {
            setDriverReactivation(null);
            return;
        }

        setDriverReactivation({
            isCurrentlyHired: !!data?.is_currently_hired,
            canRequestReactivation: !!data?.can_request_reactivation,
            reactivationStatus: data?.reactivation_status || null,
            lastHiringCompany: data?.last_hiring_company || null,
            request: data?.reactivation_request || null,
        });
    }, [isCompany, updateUserSearchStatus]);

    const loadSearchStatus = useCallback(async () => {
        if (!userInfo || !token) return;
        try {
            const result = isCompany
                ? await getCompanySearchStatus(token)
                : await getDriverSearchStatus(token);

            if (result.ok && result.data) {
                await applySearchPayload(result.data);
            }
        } catch (e) {
            console.log("Error fetching real search status", e);
        }
    }, [applySearchPayload, isCompany, token, userInfo]);

    // B) Fetch de estado remoto
    useEffect(() => {
        const fetchBanner = async () => {
            if (userInfo?.type !== 'driver' || !token) return;
            try {
                const res = await fetch(`${API_URL}/api/driver/banner`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setBanner(data);
                }
            } catch {
                // fail silently
            }
        };

        loadSearchStatus();
        fetchBanner();
    }, [loadSearchStatus, token, userInfo]);

    // C) Sync de estado local
    useEffect(() => {
        if (userInfo && userInfo.search_status) {
            setSearchStatus(userInfo.search_status);
        }
    }, [userInfo]);

    // ✅ Guardrail: si hay token pero userInfo no está listo, NO navegues a nada.
    if (!userInfo) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.greeting}>Loading session…</Text>
                    <Text style={styles.subtitle}>Please wait a moment</Text>
                </View>



                <Text style={styles.sessionHint}>
                    If this is stuck, your session is incomplete. Log out and log in again.
                </Text>

                <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    }

    const isCurrentlyHired = !isCompany && !!driverReactivation?.isCurrentlyHired;
    const reactivationStatus = !isCompany ? driverReactivation?.reactivationStatus : null;

    const toggleSearchStatus = async (value: boolean) => {
        const newStatus = value ? 'ON' : 'OFF';
        const prevStatus = searchStatus; // save for rollback

        if (!isCompany && newStatus === 'ON' && isCurrentlyHired) {
            const message = reactivationStatus === 'pending_company_confirmation'
                ? 'Your last hiring company still needs to confirm that you no longer work there. No new matches will appear until they respond.'
                : reactivationStatus === 'denied_by_company'
                    ? 'Your last hiring company reported that you still work there. Matching will remain blocked.'
                    : 'Use "Looking for work again" first so DriverFlow can ask your last hiring company to confirm that you no longer work there.';
            Alert.alert('Confirmation required', message);
            return;
        }

        // Optimistic update
        setSearchStatus(newStatus);
        console.log(`[Toggle] Attempting ${prevStatus} → ${newStatus}`);

        try {
            const result = isCompany
                ? await updateCompanySearchStatus(token!, newStatus as 'ON' | 'OFF')
                : await updateDriverSearchStatus(token!, newStatus as 'ON' | 'OFF');
            const data = result.data || {};

            if (!result.ok) {
                // Rollback to previous state
                setSearchStatus(prevStatus);
                if (!isCompany) {
                    await loadSearchStatus();
                }
                Alert.alert('Error', data.message || data.error || result.error || 'Could not update status. Please try again.');
            } else {
                // Backend is source of truth: use what the server confirmed
                await applySearchPayload({ ...data, status: data.status || newStatus });
            }
        } catch (e) {
            console.log(`[Toggle] Network error:`, e);
            setSearchStatus(prevStatus); // Rollback
            Alert.alert('Connection Error', 'Check your internet connection.');
        }
    };

    const handleRequestReactivation = async () => {
        if (!token || reactivationSubmitting) return;

        setReactivationSubmitting(true);
        try {
            const result = await requestDriverReactivation(token);
            const data = result.data || {};

            if (!result.ok) {
                if (data.status) {
                    await applySearchPayload(data);
                } else {
                    await loadSearchStatus();
                }
                Alert.alert('Unable to send request', data.message || data.error || result.error || 'Please try again later.');
                return;
            }

            await applySearchPayload(data);
            Alert.alert(
                'Request sent',
                data.message || 'DriverFlow has asked your last hiring company to confirm that you no longer work there.'
            );
        } catch (e) {
            console.log('[Reactivation] request failed', e);
            Alert.alert('Connection Error', 'Check your internet connection.');
        } finally {
            setReactivationSubmitting(false);
        }
    };

    const renderDriverReactivationBanner = () => {
        if (isCompany || !driverReactivation) return null;
        if (!driverReactivation.lastHiringCompany && driverReactivation.reactivationStatus !== 'approved_by_company') return null;

        const companyName = driverReactivation.lastHiringCompany?.name || 'your last hiring company';
        let title = 'You are currently hired';
        let body = 'Your profile is not receiving new matches right now.';
        let action: React.ReactNode = null;

        if (driverReactivation.reactivationStatus === 'pending_company_confirmation') {
            title = 'Reactivation pending';
            body = `${companyName} still needs to confirm that you no longer work there. You will not receive new matches until they respond.`;
        } else if (driverReactivation.reactivationStatus === 'denied_by_company') {
            title = 'Reactivation denied';
            body = `${companyName} reported that you still work there. Matching will remain blocked.`;
        } else if (driverReactivation.reactivationStatus === 'approved_by_company') {
            title = 'Reactivation approved';
            body = `${companyName} confirmed that you can receive new job opportunities again.`;
        } else if (driverReactivation.isCurrentlyHired && driverReactivation.canRequestReactivation) {
            body = `Use this only if you are truly no longer working for ${companyName}. DriverFlow will ask them to confirm before matching turns back on.`;
            action = (
                <TouchableOpacity
                    style={[styles.resumeSearchButton, reactivationSubmitting && styles.resumeSearchButtonDisabled]}
                    disabled={reactivationSubmitting}
                    onPress={() => {
                        Alert.alert(
                            'Looking for work again',
                            'Use this only if you are truly no longer working for your current company.\n\nIf you continue, DriverFlow will ask your last hiring company to confirm whether you are no longer employed there.\n\nYou will not receive new matches until that confirmation is completed.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                { text: "Yes, I'm no longer working there", onPress: handleRequestReactivation }
                            ]
                        );
                    }}
                >
                    <Text style={styles.resumeSearchButtonText}>
                        {reactivationSubmitting ? 'Sending request...' : 'Looking for work again'}
                    </Text>
                </TouchableOpacity>
            );
        } else if (driverReactivation.isCurrentlyHired) {
            body = `DriverFlow still needs your last hiring company to manage this employment confirmation before matching can resume.`;
        } else {
            return null;
        }

        return (
            <View style={styles.hiredBanner}>
                <Text style={styles.hiredBannerTitle}>{title}</Text>
                <Text style={styles.hiredBannerText}>{body}</Text>
                {action}
            </View>
        );
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>

            <View style={[styles.header, styles.headerRow]}>
                <View>
                    <Text style={styles.greeting}>Hello, {userInfo.name || 'User'}</Text>
                    <Text style={styles.subtitle}>{isCompany ? 'Company' : 'Driver'} Dashboard</Text>
                </View>
                <View style={styles.searchStatusBlock}>
                    <Text style={styles.searchStatusLabel}>
                        {isCompany ? 'Search' : 'Available'}
                    </Text>
                    <TouchableOpacity
                        style={[
                            styles.searchStatusToggle,
                            searchStatus === 'ON' ? styles.searchStatusToggleOn : styles.searchStatusToggleOff
                        ]}
                        onPress={() => toggleSearchStatus(searchStatus !== 'ON')}
                    >
                        <Text style={styles.searchStatusToggleText}>
                            {searchStatus === 'ON' ? 'ON' : 'OFF'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {renderDriverReactivationBanner()}

            <View style={styles.menuGrid}>
                {isCompany ? (
                    <>
                        {/* Temporarily disabled for V1 */}
                        {false && (
                            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CreateRequest')}>
                                <Text style={styles.cardIcon}>➕</Text>
                                <Text style={styles.cardTitle}>Post New Job</Text>
                                <Text style={styles.cardDesc}>Create a new request to find drivers</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Matches')}>
                            <Text style={styles.cardIcon}>🔍</Text>
                            <Text style={styles.cardTitle}>Matches Found</Text>
                            <Text style={styles.cardDesc}>View drivers matching your company</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CompanyProfileForm')}>
                            <Text style={styles.cardIcon}>🏢</Text>
                            <Text style={styles.cardTitle}>My Company</Text>
                            <Text style={styles.cardDesc}>Update your business information</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CompanyBilling')}>
                            <Text style={styles.cardIcon}>💳</Text>
                            <Text style={styles.cardTitle}>Billing</Text>
                            <Text style={styles.cardDesc}>Review and pay pending tickets</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CompanyReactivationRequests')}>
                            <Text style={styles.cardIcon}>✅</Text>
                            <Text style={styles.cardTitle}>Employment Confirmations</Text>
                            <Text style={styles.cardDesc}>Confirm whether hired drivers still work for your company</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Matches')}>
                            <Text style={styles.cardIcon}>✨</Text>
                            <Text style={styles.cardTitle}>My Matches</Text>
                            <Text style={styles.cardDesc}>View companies matching your profile</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DriverProfileForm')}>
                            <Text style={styles.cardIcon}>👤</Text>
                            <Text style={styles.cardTitle}>My Profile</Text>
                            <Text style={styles.cardDesc}>Update documents and driver info</Text>
                        </TouchableOpacity>

                        {banner?.image_url && (
                            <Image
                                source={{ uri: banner.image_url }}
                                style={styles.bannerImage}
                                resizeMode="cover"
                            />
                        )}
                    </>
                )}
            </View>


        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    content: {
        padding: 24,
        paddingBottom: 40,
    },
    header: {
        marginTop: 20,
        marginBottom: 20,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    greeting: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    subtitle: {
        fontSize: 18,
        color: '#6c757d',
        marginTop: 4,
    },
    sessionHint: {
        color: '#6c757d',
        marginBottom: 16,
    },
    searchStatusBlock: {
        alignItems: 'center',
    },
    searchStatusLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
    searchStatusToggle: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 16,
    },
    searchStatusToggleOn: {
        backgroundColor: '#4CAF50',
    },
    searchStatusToggleOff: {
        backgroundColor: '#ccc',
    },
    searchStatusToggleText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    },
    hiredBanner: {
        backgroundColor: '#d4edda',
        borderColor: '#c3e6cb',
        borderWidth: 1,
        padding: 15,
        borderRadius: 10,
        marginBottom: 16,
    },
    hiredBannerTitle: {
        fontWeight: 'bold',
        fontSize: 16,
        color: '#155724',
        marginBottom: 4,
    },
    hiredBannerText: {
        color: '#155724',
        fontSize: 14,
    },
    resumeSearchButton: {
        backgroundColor: '#28a745',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginTop: 12,
        alignItems: 'center',
    },
    resumeSearchButtonDisabled: {
        opacity: 0.7,
    },
    resumeSearchButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    networkBox: {
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        marginBottom: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        alignSelf: 'flex-start',
    },
    networkStatus: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 10,
    },
    dotGrey: {
        backgroundColor: '#adb5bd',
    },
    dotGreen: {
        backgroundColor: '#28a745',
    },
    dotRed: {
        backgroundColor: '#dc3545',
    },
    networkText: {
        fontSize: 14,
        color: '#495057',
        fontWeight: '500',
    },
    menuGrid: {
        gap: 16,
        marginBottom: 40,
    },
    bannerImage: {
        width: '100%',
        height: 220,
        borderRadius: 16,
        marginTop: 24,
        marginBottom: 16,
    },
    card: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 16,
        shadowColor: '#007BFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        borderLeftWidth: 5,
        borderLeftColor: '#007BFF',
    },
    cardIcon: {
        fontSize: 28,
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#343a40',
        marginBottom: 4,
    },
    cardDesc: {
        fontSize: 14,
        color: '#6c757d',
    },
    logoutButton: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#dc3545',
    },
    logoutText: {
        color: '#dc3545',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});
