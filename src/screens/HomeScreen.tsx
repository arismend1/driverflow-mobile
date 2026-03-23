import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { checkHealth } from '../api/client';
import { API_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen() {
    const navigation = useNavigation<any>();
    const { userInfo, logout, token, hasPin, updateUserSearchStatus } = useAuth();
    const [connected, setConnected] = useState<boolean | null>(null);
    const [searchStatus, setSearchStatus] = useState<string>('OFF');
    const [banner, setBanner] = useState<{ image_url: string } | null>(null);

    const tokenLen = token ? token.length : 0;

    useEffect(() => {
        let alive = true;

        const verifyConnection = async () => {
            setConnected(null);
            const result = await checkHealth();
            if (alive) setConnected(result.ok);
        };

        const fetchRealSearchStatus = async () => {
            if (!userInfo || !token) return;
            try {
                // Use dedicated search_status GET endpoints that read from empresas/drivers tables
                const endpoint = userInfo.type === 'empresa'
                    ? '/api/company/search_status'
                    : '/api/driver/search_status';
                const res = await fetch(`${API_URL}${endpoint}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.status) {
                        setSearchStatus(data.status);
                        updateUserSearchStatus(data.status);
                    }
                }
            } catch (e) {
                console.log("Error fetching real search status", e);
            }
        };

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
            } catch (e) {
                // fail silently
            }
        };

        verifyConnection();
        fetchRealSearchStatus();
        fetchBanner();

        if (userInfo && userInfo.search_status) {
            setSearchStatus(userInfo.search_status);
        }

        return () => {
            alive = false;
        };
    }, [userInfo?.id]);

    // ✅ Guardrail: si hay token pero userInfo no está listo, NO navegues a nada.
    if (!userInfo) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.greeting}>Loading session…</Text>
                    <Text style={styles.subtitle}>Please wait a moment</Text>
                </View>



                <Text style={{ color: '#6c757d', marginBottom: 16 }}>
                    If this is stuck, your session is incomplete. Log out and log in again.
                </Text>

                <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    }

    const isCompany = userInfo.type === 'empresa';

    const toggleSearchStatus = async (value: boolean) => {
        const newStatus = value ? 'ON' : 'OFF';
        const prevStatus = searchStatus; // save for rollback

        // Optimistic update
        setSearchStatus(newStatus);
        console.log(`[Toggle] Attempting ${prevStatus} → ${newStatus}`);

        // ✅ Fixed: both endpoints now include the /api prefix
        const endpoint = isCompany ? '/api/company/search_status' : '/api/driver/search_status';
        const url = `${API_URL}${endpoint}`;

        try {
            console.log(`[Toggle] POST ${url}`, { status: newStatus });
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            console.log(`[Toggle] Response status: ${res.status}, ok: ${res.ok}`);
            const data = await res.json();
            console.log(`[Toggle] Response body:`, data);

            if (!res.ok) {
                // Rollback to previous state
                setSearchStatus(prevStatus);
                Alert.alert('Error', data.error || 'Could not update status. Please try again.');
            } else {
                // Backend is source of truth: use what the server confirmed
                const confirmedStatus = data.status || newStatus;
                setSearchStatus(confirmedStatus);
                await updateUserSearchStatus(confirmedStatus);
                console.log(`[Toggle] Confirmed new status: ${confirmedStatus}`);
            }
        } catch (e) {
            console.log(`[Toggle] Network error:`, e);
            setSearchStatus(prevStatus); // Rollback
            Alert.alert('Connection Error', 'Check your internet connection.');
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>

            <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View>
                    <Text style={styles.greeting}>Hello, {userInfo.name || 'User'}</Text>
                    <Text style={styles.subtitle}>{isCompany ? 'Company' : 'Driver'} Dashboard</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                        {isCompany ? 'Search' : 'Available'}
                    </Text>
                    <TouchableOpacity
                        style={{ backgroundColor: searchStatus === 'ON' ? '#4CAF50' : '#ccc', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 16 }}
                        onPress={() => toggleSearchStatus(searchStatus !== 'ON')}
                    >
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>
                            {searchStatus === 'ON' ? 'ON' : 'OFF'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Hired Banner for Drivers */}
            {!isCompany && searchStatus === 'OFF' && (
                <View style={{ backgroundColor: '#d4edda', borderColor: '#c3e6cb', borderWidth: 1, padding: 15, borderRadius: 10, marginBottom: 16 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#155724', marginBottom: 4 }}>🎉 You are currently hired!</Text>
                    <Text style={{ color: '#155724', fontSize: 14 }}>Your profile is not receiving new matches.</Text>
                    <TouchableOpacity
                        style={{ backgroundColor: '#28a745', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginTop: 12, alignItems: 'center' }}
                        onPress={() => {
                            Alert.alert(
                                'Return to Job Search',
                                'This will make your profile visible to companies again and you will start receiving new matches.',
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Yes, Resume Search', onPress: () => toggleSearchStatus(true) }
                                ]
                            );
                        }}
                    >
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Return to Job Search</Text>
                    </TouchableOpacity>
                </View>
            )}

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
                                style={{
                                    width: '100%',
                                    height: 220,
                                    borderRadius: 16,
                                    marginTop: 24,
                                    marginBottom: 16
                                }}
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