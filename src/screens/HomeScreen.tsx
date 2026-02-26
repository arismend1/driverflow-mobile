import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { checkHealth } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen() {
    const navigation = useNavigation<any>();
    const { userInfo, logout, token, hasPin } = useAuth();
    const [connected, setConnected] = useState<boolean | null>(null);

    const tokenLen = token ? token.length : 0;

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

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>

            <View style={styles.header}>
                <Text style={styles.greeting}>Hola, {userInfo.name || 'Usuario'}</Text>
                <Text style={styles.subtitle}>Panel de {isCompany ? 'Empresa' : 'Chofer'}</Text>
            </View>

            <View style={styles.networkBox}>
                <View style={styles.networkStatus}>
                    <View style={[styles.dot, connected === null ? styles.dotGrey : connected ? styles.dotGreen : styles.dotRed]} />
                    <Text style={styles.networkText}>
                        Servidor: {connected === null ? 'Conectando…' : connected ? 'En línea' : 'Desconectado'}
                    </Text>
                </View>
            </View>

            <View style={styles.menuGrid}>
                {isCompany ? (
                    <>
                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CompanyRequests')}>
                            <Text style={styles.cardIcon}>📦</Text>
                            <Text style={styles.cardTitle}>Mis Solicitudes</Text>
                            <Text style={styles.cardDesc}>Gestiona tus viajes y requerimientos</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CompanyProfileForm')}>
                            <Text style={styles.cardIcon}>🏢</Text>
                            <Text style={styles.cardTitle}>Mi Empresa</Text>
                            <Text style={styles.cardDesc}>Actualiza la información comercial</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CompanyBilling')}>
                            <Text style={styles.cardIcon}>💳</Text>
                            <Text style={styles.cardTitle}>Facturación</Text>
                            <Text style={styles.cardDesc}>Revisa y paga tickets pendientes</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('AvailableRequests')}>
                            <Text style={styles.cardIcon}>🔍</Text>
                            <Text style={styles.cardTitle}>Buscar Trabajos</Text>
                            <Text style={styles.cardDesc}>Encuentra solicitudes abiertas de Mula</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DriverTickets')}>
                            <Text style={styles.cardIcon}>🎟️</Text>
                            <Text style={styles.cardTitle}>Mis Tickets</Text>
                            <Text style={styles.cardDesc}>Viajes que se te han asignado</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DriverProfileForm')}>
                            <Text style={styles.cardIcon}>👤</Text>
                            <Text style={styles.cardTitle}>Mi Perfil</Text>
                            <Text style={styles.cardDesc}>Registra documentos e info de chofer</Text>
                        </TouchableOpacity>
                    </>
                )}

                <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Notifications')}>
                    <Text style={styles.cardIcon}>🔔</Text>
                    <Text style={styles.cardTitle}>Notificaciones</Text>
                    <Text style={styles.cardDesc}>Alertas y notificaciones recientes</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
                <Text style={styles.logoutText}>Cerrar Sesión</Text>
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