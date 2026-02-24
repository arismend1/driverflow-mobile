import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Alert, TouchableOpacity, Modal, TextInput, Linking } from 'react-native';
import { getBillingSummary, getBillingTickets, markTicketPaid, voidTicket, createCheckoutSession, BillingSummary } from '../api/client';

import { useAuth } from '../context/AuthContext';

// Helper to format cents to currency
const formatCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
};

export const CompanyBillingScreen = () => {
    const { token, adminToken: contextAdminToken } = useAuth(); // Use token from context
    const [summary, setSummary] = useState<BillingSummary | null>(null);
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'paid' | 'all'>('pending');

    useEffect(() => {
        if (!token) {
            Alert.alert('Error', 'No authentication token found. Please login again.');
            return;
        }
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        try {
            if (!token) return;
            setLoading(true);
            // Fetch directly below
            setSummary(await getBillingSummary(token));

            const statusFilter = activeTab === 'all' ? undefined : activeTab;
            setTickets(await getBillingTickets(token, statusFilter));

        } catch (error: any) {
            Alert.alert('Error', error.message || 'Error loading billing data');
        } finally {
            setLoading(false);
        }
    };

    const openReceipt = async (url: string) => {
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert('Error', 'No se puede abrir el enlace del recibo.');
            }
        } catch (error: any) {
            Alert.alert('Error', 'No se pudo abrir el recibo');
        }
    };

    const renderHeader = () => {
        if (!summary) return null;
        return (
            <View style={styles.summaryContainer}>
                <View style={styles.summaryRow}>
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>PENDING</Text>
                        <Text style={[styles.summaryValue, { color: 'orange' }]}>{summary.pending_count}</Text>
                        <Text style={styles.summaryAmount}>{formatCurrency(summary.pending_amount_cents, summary.currency)}</Text>
                    </View>
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>PAID</Text>
                        <Text style={[styles.summaryValue, { color: 'green' }]}>{summary.paid_count}</Text>
                        <Text style={styles.summaryAmount}>{formatCurrency(summary.paid_amount_cents, summary.currency)}</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.title}>Invoice #{item.id}</Text>
                <Text style={[styles.statusBadge, { backgroundColor: item.billing_status === 'paid' ? '#d4edda' : '#fff3cd' }]}>
                    {item.billing_status.toUpperCase()}
                </Text>
            </View>
            <Text>Periodo: {item.request_id}</Text>
            <Text>Generada: {new Date(item.created_at).toLocaleDateString()}</Text>
            <Text style={styles.amount}>{formatCurrency(item.amount_cents, item.currency)}</Text>

            {item.receipt_url && (
                <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.btn, styles.btnPayOnline]} onPress={() => openReceipt(item.receipt_url)}>
                        <Text style={styles.btnText}>VER RECIBO (STRIPE)</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            {renderHeader()}

            <View style={styles.tabs}>
                {['pending', 'paid', 'all'].map((t: any) => (
                    <TouchableOpacity
                        key={t}
                        style={[styles.tab, activeTab === t && styles.activeTab]}
                        onPress={() => setActiveTab(t)}
                    >
                        <Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>{t.toUpperCase()}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? <ActivityIndicator size="large" color="#000" style={{ marginTop: 20 }} /> : (
                <FlatList
                    data={tickets}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    refreshing={loading}
                    onRefresh={loadData}
                    ListEmptyComponent={<Text style={styles.empty}>No tickets found.</Text>}
                />
            )}
        </View>
    );
};

// Simplified Button component to avoid import issues if not standard
const Button = ({ title, onPress, color = '#007BFF' }: any) => (
    <TouchableOpacity onPress={onPress} style={{ backgroundColor: color, padding: 10, borderRadius: 5, minWidth: 80, alignItems: 'center' }}>
        <Text style={{ color: 'white', fontWeight: 'bold' }}>{title}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f2f2f2' },
    summaryContainer: { padding: 10, backgroundColor: 'white', marginBottom: 10, elevation: 2 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
    summaryBox: { alignItems: 'center' },
    summaryLabel: { fontSize: 12, color: '#666', fontWeight: 'bold' },
    summaryValue: { fontSize: 24, fontWeight: 'bold' },
    summaryAmount: { fontSize: 14, color: '#333' },

    tabs: { flexDirection: 'row', backgroundColor: 'white', marginBottom: 10 },
    tab: { flex: 1, padding: 15, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    activeTab: { borderBottomColor: '#6f42c1' },
    tabText: { color: '#666' },
    activeTabText: { color: '#6f42c1', fontWeight: 'bold' },

    card: { backgroundColor: 'white', margin: 10, padding: 15, borderRadius: 8, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    title: { fontWeight: 'bold', fontSize: 16 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', fontSize: 12 },
    amount: { fontSize: 18, fontWeight: 'bold', marginTop: 5 },
    actionsRow: { flexDirection: 'row', marginTop: 15, justifyContent: 'flex-end' },
    btn: { padding: 8, borderRadius: 5, marginLeft: 10 },
    btnPay: { backgroundColor: '#6c757d' }, // Grey for admin manual
    btnPayOnline: { backgroundColor: '#28a745' }, // Green for real pay
    btnVoid: { backgroundColor: '#dc3545' },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
    empty: { textAlign: 'center', marginTop: 30, color: '#888' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', padding: 20, borderRadius: 10 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    label: { marginTop: 10, marginBottom: 5, fontWeight: '600' },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 5 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 }
});
