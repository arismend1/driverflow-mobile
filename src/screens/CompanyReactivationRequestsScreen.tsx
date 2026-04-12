import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCompanyReactivationRequests, respondToCompanyReactivationRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function CompanyReactivationRequestsScreen() {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [submittingId, setSubmittingId] = useState<number | null>(null);
    const [requests, setRequests] = useState<any[]>([]);

    const loadRequests = useCallback(async () => {
        if (!token) return;

        setLoading(true);
        try {
            const result = await getCompanyReactivationRequests(token);
            if (!result.ok) {
                Alert.alert('Error', result.error || 'Could not load reactivation requests.');
                return;
            }

            setRequests(result.data?.requests || []);
        } catch (e) {
            console.log('[CompanyReactivation] load error', e);
            Alert.alert('Connection Error', 'Check your internet connection.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const handleResponse = async (requestId: number, response: 'still_employed' | 'no_longer_employed') => {
        if (!token || submittingId) return;

        setSubmittingId(requestId);
        try {
            const result = await respondToCompanyReactivationRequest(token, requestId, response);
            if (!result.ok) {
                Alert.alert('Error', result.error || 'Could not save your response.');
                return;
            }

            await loadRequests();
        } catch (e) {
            console.log('[CompanyReactivation] response error', e);
            Alert.alert('Connection Error', 'Check your internet connection.');
        } finally {
            setSubmittingId(null);
        }
    };

    if (loading) {
        return <ActivityIndicator style={styles.loader} size="large" />;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Employment Confirmations</Text>
            <Text style={styles.subtitle}>
                Review drivers who asked to appear again for new job opportunities.
            </Text>

            <FlatList
                data={requests}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={requests.length === 0 ? styles.emptyContainer : styles.list}
                ListEmptyComponent={(
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>No pending confirmations</Text>
                        <Text style={styles.emptyText}>
                            When a hired driver asks to look for work again, the request will appear here.
                        </Text>
                    </View>
                )}
                renderItem={({ item }) => {
                    const requestedAt = item.requested_at
                        ? new Date(item.requested_at).toLocaleString()
                        : 'Unknown';
                    const busy = submittingId === item.id;

                    return (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>{item.driver_name || `Driver #${item.driver_id}`}</Text>
                            <Text style={styles.cardText}>
                                This driver asked to appear again for new job opportunities.
                            </Text>
                            <Text style={styles.cardMeta}>Requested: {requestedAt}</Text>

                            <View style={styles.actions}>
                                <TouchableOpacity
                                    style={[styles.button, styles.denyButton, busy && styles.buttonDisabled]}
                                    disabled={busy}
                                    onPress={() => {
                                        Alert.alert(
                                            'Confirm current employment',
                                            'Tell DriverFlow whether this driver still works for your company.',
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'Yes, still works here',
                                                    onPress: () => handleResponse(item.id, 'still_employed')
                                                }
                                            ]
                                        );
                                    }}
                                >
                                    <Text style={styles.buttonText}>Yes, still works here</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.button, styles.approveButton, busy && styles.buttonDisabled]}
                                    disabled={busy}
                                    onPress={() => {
                                        Alert.alert(
                                            'Confirm departure',
                                            'If this driver no longer works for your company, DriverFlow will make them eligible for future matching again.',
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'No, no longer works here',
                                                    onPress: () => handleResponse(item.id, 'no_longer_employed')
                                                }
                                            ]
                                        );
                                    }}
                                >
                                    <Text style={styles.buttonText}>No, no longer works here</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        padding: 20,
    },
    loader: {
        flex: 1,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#5f6b7a',
        marginBottom: 16,
    },
    list: {
        paddingBottom: 24,
    },
    emptyContainer: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    emptyCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#5f6b7a',
        lineHeight: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 18,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    cardText: {
        fontSize: 14,
        color: '#394150',
        lineHeight: 20,
        marginBottom: 8,
    },
    cardMeta: {
        fontSize: 12,
        color: '#7a8699',
        marginBottom: 14,
    },
    actions: {
        gap: 10,
    },
    button: {
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        alignItems: 'center',
    },
    approveButton: {
        backgroundColor: '#1f7a3d',
    },
    denyButton: {
        backgroundColor: '#8b1e2d',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
});
