import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Alert, TouchableOpacity, Linking } from 'react-native';
import { getBillingSummary, getBillingTickets, getTickets, createInvoiceCheckoutSession, BillingSummary } from '../api/client';

import { useAuth } from '../context/AuthContext';

// Helper to format cents to currency
const formatCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
};

export const CompanyBillingScreen = () => {
    const { token, suppressPinLock } = useAuth(); // Use token from context
    const [summary, setSummary] = useState<BillingSummary | null>(null);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [displayItems, setDisplayItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'paid' | 'all' | 'tickets'>('pending');

    const lastPayment = useMemo(() => {
        const paidInvoices = invoices
            .filter((inv: any) => inv.status === 'charged')
            .sort((a: any, b: any) => {
                const aDate = new Date(a.paid_at || a.charged_at || a.created_at || 0).getTime();
                const bDate = new Date(b.paid_at || b.charged_at || b.created_at || 0).getTime();
                return bDate - aDate;
            });

        return paidInvoices[0] || null;
    }, [invoices]);

    const loadData = useCallback(async () => {
        try {
            if (!token) return;
            setLoading(true);
            const allInvoices = await getBillingTickets(token);
            setInvoices(allInvoices);
            setSummary(await getBillingSummary(token));

            if (activeTab === 'tickets') {
                setDisplayItems(await getTickets(token));
            } else {
                let filteredInvoices = allInvoices;
                if (activeTab === 'paid') {
                    filteredInvoices = allInvoices.filter((inv: any) => inv.status === 'charged');
                } else if (activeTab === 'pending') {
                    filteredInvoices = allInvoices.filter((inv: any) => inv.status === 'pending');
                }
                setDisplayItems(filteredInvoices);
            }

        } catch (error: any) {
            Alert.alert('Error', error.message || 'Error loading billing data');
        } finally {
            setLoading(false);
        }
    }, [token, activeTab]);

    useEffect(() => {
        if (!token) {
            Alert.alert('Error', 'No authentication token found. Please login again.');
            return;
        }
        loadData();
    }, [loadData, token]);

    const payTicket = async (item: any) => {
        if (!token) {
            Alert.alert('Error', 'Invalid session');
            return;
        }
        try {
            setLoading(true);
            // console.log("[BILLING] invoiceId", item.id);
            if (item.billing_status === 'pending') {
                console.log("[BILLING] Starting prepay for invoice:", item.id);
            }

            const data = await createInvoiceCheckoutSession(token, item.id);
            console.log("[BILLING] checkout response", JSON.stringify(data));
            const url = data?.url || data?.checkout_url;

            if (!url) {
                Alert.alert("Error", "Payment URL not found");
                return;
            }

            suppressPinLock();
            await Linking.openURL(url);

            setTimeout(loadData, 3000);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Error starting payment');
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
                Alert.alert('Error', 'Cannot open receipt link.');
            }
        } catch {
            Alert.alert('Error', 'Could not open receipt');
        }
    };

    const renderHeader = () => {
        if (!summary) return null;
        const lastPaymentAmount = lastPayment?.total_cents ?? 0;
        const lastPaymentCurrency = lastPayment?.currency || summary.currency || 'USD';
        const lastPaymentDateValue = lastPayment?.paid_at || lastPayment?.charged_at || lastPayment?.created_at || null;
        const lastPaymentDate = lastPaymentDateValue && !isNaN(new Date(lastPaymentDateValue).getTime())
            ? new Date(lastPaymentDateValue).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'No payments yet';

        return (
            <View style={styles.summaryContainer}>
                <View style={styles.summaryRow}>
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>PENDING</Text>
                        <Text style={[styles.summaryValue, styles.summaryValuePending]}>{summary.pending_count}</Text>
                        <Text style={styles.summaryAmount}>{formatCurrency(summary.pending_amount_cents, summary.currency)}</Text>
                    </View>
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>Last Payment</Text>
                        <Text style={[styles.summaryValue, styles.summaryValuePaid]}>{formatCurrency(lastPaymentAmount, lastPaymentCurrency)}</Text>
                        <Text style={styles.summaryAmount}>{lastPaymentDate}</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderItem = ({ item }: { item: any }) => {
        if (activeTab === 'tickets') {
            return (
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.title}>Ticket #{item.id}</Text>
                        <Text style={[styles.statusBadge, styles.statusBadgeTicket]}>
                            {item.status ? item.status.toUpperCase() : 'N/A'}
                        </Text>
                    </View>
                    <Text>Driver: {item.driver_name || 'Unknown'}</Text>
                    <Text>Generated: {new Date(item.created_at).toLocaleDateString()}</Text>
                    <Text style={styles.amount}>$150.00 <Text style={styles.amountNote}>(To Be Billed)</Text></Text>
                </View>
            );
        }

        const amount = Number(item?.total_cents || 0);
        const status = String(item?.status || item?.billing_status || 'pending');
        const period = item?.billing_week || 'N/A';
        const rawDate = item?.issue_date || item?.created_at;
        const generated = rawDate && !isNaN(new Date(rawDate).getTime())
            ? new Date(rawDate).toLocaleDateString()
            : 'N/A';
        
        const canPayByStatus = ['pending', 'failed', 'retrying', 'suspended'].includes(status);
        const canPayByAmount = amount > 0;
        const isPrepay = status === 'pending';

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.title}>Invoice #{item.id}</Text>
                    <Text style={[styles.statusBadge, status === 'paid' ? styles.statusBadgePaid : styles.statusBadgePending]}>
                        {status.toUpperCase()}
                    </Text>
                </View>
                <Text>Period: {period}</Text>
                <Text>Generated: {generated}</Text>
                <Text style={styles.amount}>{formatCurrency(amount, item?.currency || 'USD')}</Text>

                {amount <= 0 && (
                    <Text style={styles.emptyChargesText}>
                        No charges this week
                    </Text>
                )}

                {canPayByStatus && canPayByAmount && (
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={[styles.btn, styles.btnPayOnline, isPrepay && styles.btnPrepay]}
                            onPress={() => payTicket(item)}
                        >
                            <Text style={styles.btnText}>{isPrepay ? 'PREPAY' : 'PAY NOW'}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {status === 'paid' && item.receipt_url && (
                    <View style={styles.actionsRow}>
                        <TouchableOpacity style={[styles.btn, styles.btnPayOnline]} onPress={() => openReceipt(item.receipt_url)}>
                            <Text style={styles.btnText}>VIEW RECEIPT (STRIPE)</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {renderHeader()}

            <View style={styles.tabs}>
                {['pending', 'paid', 'all', 'tickets'].map((t: any) => (
                    <TouchableOpacity
                        key={t}
                        style={[styles.tab, activeTab === t && styles.activeTab]}
                        onPress={() => setActiveTab(t)}
                    >
                        <Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>{t.toUpperCase()}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? <ActivityIndicator size="large" color="#000" style={styles.loadingIndicator} /> : (
                <FlatList
                    data={displayItems}
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f2f2f2' },
    summaryContainer: { padding: 10, backgroundColor: 'white', marginBottom: 10, elevation: 2 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
    summaryBox: { alignItems: 'center' },
    summaryLabel: { fontSize: 12, color: '#666', fontWeight: 'bold' },
    summaryValue: { fontSize: 24, fontWeight: 'bold' },
    summaryValuePending: { color: 'orange' },
    summaryValuePaid: { color: 'green' },
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
    statusBadgeTicket: { backgroundColor: '#e2e3e5' },
    statusBadgePaid: { backgroundColor: '#d4edda' },
    statusBadgePending: { backgroundColor: '#fff3cd' },
    amount: { fontSize: 18, fontWeight: 'bold', marginTop: 5 },
    amountNote: { fontSize: 12, fontWeight: 'normal' },
    emptyChargesText: { color: '#888', fontStyle: 'italic', marginTop: 4 },
    actionsRow: { flexDirection: 'row', marginTop: 15, justifyContent: 'flex-end' },
    btn: { padding: 8, borderRadius: 5, marginLeft: 10 },
    btnPay: { backgroundColor: '#6c757d' }, // Grey for admin manual
    btnPayOnline: { backgroundColor: '#28a745' }, // Green for real pay
    btnPrepay: { backgroundColor: '#007bff' },
    btnVoid: { backgroundColor: '#dc3545' },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
    empty: { textAlign: 'center', marginTop: 30, color: '#888' },
    loadingIndicator: { marginTop: 20 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', padding: 20, borderRadius: 10 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    label: { marginTop: 10, marginBottom: 5, fontWeight: '600' },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 5 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 }
});
