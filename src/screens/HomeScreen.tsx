import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { checkHealth } from '../api/client';
import { API_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen() {
    const navigation = useNavigation<any>();
    const { userInfo, logout, token, hasPin, updateUserSearchStatus } = useAuth();
    const [connected, setConnected] = useState<boolean | null>(null);
    const [searchStatus, setSearchStatus] = useState<string>('OFF');

    const tokenLen = token ? token.length : 0;

    useEffect(() => {
        let alive = true;

        const verifyConnection = async () => {
            setConnected(null);
            const result = await checkHealth();
            if (alive) setConnected(result.ok);
        };

        verifyConnection();

        if (userInfo && userInfo.search_status) {
            setSearchStatus(userInfo.search_status);
        }

        return () => {
            alive = false;
        };
    }, []);

    // ✅ Guardrail: si hay token pero userInfo no está listo, NO navegues a nada.
    if (!userInfo) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.greeting}>Cargando sesión…</Text>
                    <Text style={styles.subtitle}>Espera un momento</Text>
                </View>

                <View style={styles.networkBox}>
                    <View style={styles.networkStatus}>
                        <View style={[styles.dot, connected === null ? styles.dotGrey : connected ? styles.dotGreen : styles.dotRed]} />
                        <Text style={styles.networkText}>
                            Servidor: {connected === null ? 'Conectando…' : connected ? 'En línea' : 'Desconectado'}
                        </Text>
                    </View>
                </View>

                <Text style={{ color: '#6c757d', marginBottom: 16 }}>
                    Si esto no avanza, tu sesión quedó incompleta. Cierra sesión e inicia de nuevo.
                </Text>

                <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
                    <Text style={styles.logoutText}>Cerrar Sesión</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    }

    const isCompany = userInfo.type === 'empresa';

    const toggleSearchStatus = async (value: boolean) => {
        const newStatus = value ? 'ON' : 'OFF';
        // Optimistic update
        setSearchStatus(newStatus);

        const endpoint = isCompany ? '/company/search_status' : '/driver/search_status';

        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) {
                setSearchStatus(value ? 'OFF' : 'ON'); // Revert
                Alert.alert('Error', 'Could not update status. Please try again.');
            } else {
                await updateUserSearchStatus(newStatus);
            }
        } catch (e) {
            setSearchStatus(value ? 'OFF' : 'ON'); // Revert
            Alert.alert('Connection Error', 'Check your internet connection.');
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>

            <View style={styles.header}>
                <Text style={styles.greeting}>Hello, {userInfo.name || 'User'}</Text>
                <Text style={styles.subtitle}>{isCompany ? 'Company' : 'Driver'} Dashboard</Text>
            </View>

            <View style={styles.networkBox}>
                <View style={styles.networkStatus}>
                    <View style={[styles.dot, connected === null ? styles.dotGrey : connected ? styles.dotGreen : styles.dotRed]} />
                    <Text style={styles.networkText}>
                        Server: {connected === null ? 'Connecting...' : connected ? 'Online' : 'Offline'}
                    </Text>
                </View>
            </View>

            <View style={styles.menuGrid}>
                {isCompany ? (
                    <>
                        <View style={[styles.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: searchStatus === 'ON' ? '#e8f5e9' : '#fff' }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardIcon}>📡</Text>
                                <Text style={styles.cardTitle}>Searching for Drivers</Text>
                                <Text style={styles.cardDesc}>
                                    {searchStatus === 'ON' ? 'The system is automatically looking for drivers.' : 'Idle. Turn on to look for profiles.'}
                                </Text>
                            </View>
                            <Switch
                                value={searchStatus === 'ON'}
                                onValueChange={toggleSearchStatus}
                                trackColor={{ false: '#767577', true: '#4CAF50' }}
                                thumbColor={searchStatus === 'ON' ? '#ffffff' : '#f4f3f4'}
                            />
                        </View>

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
                        <View style={[styles.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: searchStatus === 'ON' ? '#e8f5e9' : '#fff' }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardIcon}>📡</Text>
                                <Text style={styles.cardTitle}>Searching for Jobs</Text>
                                <Text style={styles.cardDesc}>
                                    {searchStatus === 'ON' ? 'Active. System is looking for matches.' : 'Hired/Idle. Turn on to find work.'}
                                </Text>
                            </View>
                            <Switch
                                value={searchStatus === 'ON'}
                                onValueChange={toggleSearchStatus}
                                trackColor={{ false: '#767577', true: '#4CAF50' }}
                                thumbColor={searchStatus === 'ON' ? '#ffffff' : '#f4f3f4'}
                            />
                        </View>

                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('AvailableRequests')}>
                            <Text style={styles.cardIcon}>🔍</Text>
                            <Text style={styles.cardTitle}>Manual Job Search</Text>
                            <Text style={styles.cardDesc}>Find open requests from companies</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DriverTickets')}>
                            <Text style={styles.cardIcon}>🎟️</Text>
                            <Text style={styles.cardTitle}>Accepted Offers</Text>
                            <Text style={styles.cardDesc}>Companies interested in your profile</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DriverProfileForm')}>
                            <Text style={styles.cardIcon}>👤</Text>
                            <Text style={styles.cardTitle}>My Profile</Text>
                            <Text style={styles.cardDesc}>Update documents and driver info</Text>
                        </TouchableOpacity>
                    </>
                )}

                <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Notifications')}>
                    <Text style={styles.cardIcon}>🔔</Text>
                    <Text style={styles.cardTitle}>Notifications</Text>
                    <Text style={styles.cardDesc}>Alerts and recent notifications</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
                <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
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