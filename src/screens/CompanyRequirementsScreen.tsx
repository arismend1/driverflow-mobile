import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../api/config';

const MultiSelect = ({ label, options, selected = [], onToggle }: any) => {
    return (
        <View style={styles.section}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.optionContainer}>
                {options.map((opt: string) => {
                    const isSelected = selected.includes(opt);
                    return (
                        <TouchableOpacity
                            key={opt}
                            style={[styles.optionButton, isSelected && styles.optionSelected]}
                            onPress={() => onToggle(opt)}
                        >
                            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{opt}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

export default function CompanyRequirementsScreen() {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [reqCdl, setReqCdl] = useState(false);
    const [reqLicenseTypes, setReqLicenseTypes] = useState<string[]>([]);
    const [reqEndorsements, setReqEndorsements] = useState<string[]>([]);
    const [reqOpsTypes, setReqOpsTypes] = useState<string[]>([]);
    const [expYears, setExpYears] = useState('0'); // Min experience
    const [reqModalities, setReqModalities] = useState<string[]>([]);
    const [reqTruck, setReqTruck] = useState(false);
    const [offeredPayments, setOfferedPayments] = useState<string[]>([]);
    const [reqRelationships, setReqRelationships] = useState<string[]>([]);
    const [availability, setAvailability] = useState('Immediate');

    const loadReqs = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/companies/requirements`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.company_id) {
                    setReqCdl(!!data.req_cdl);
                    setReqLicenseTypes(data.req_license_types || []);
                    setReqEndorsements(data.req_endorsements || []);
                    setReqOpsTypes(data.req_operation_types || []);
                    // Handle exp range as min years for simplicity or custom field
                    setExpYears(data.req_experience_years !== undefined ? String(data.req_experience_years) : '0');
                    setReqModalities(data.req_modalities || []);
                    setReqTruck(!!data.req_truck);
                    setOfferedPayments(data.offered_payment_methods || []);
                    setReqRelationships(data.req_relationships || []);
                    setAvailability(data.availability || 'Immediate');
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadReqs();
    }, [loadReqs]);

    const saveReqs = async () => {
        setSaving(true);
        try {
            const payload = {
                req_cdl: reqCdl,
                req_license_types: reqLicenseTypes,
                req_endorsements: reqEndorsements,
                req_operation_types: reqOpsTypes,
                req_experience_years: parseInt(expYears, 10) || 0, // FIXED: Sent to backend as integer directly
                req_modalities: reqModalities,
                req_truck: reqTruck,
                offered_payment_methods: offeredPayments,
                req_relationships: reqRelationships,
                availability: availability
            };

            const res = await fetch(`${API_URL}/companies/requirements`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                Alert.alert('Success', 'Requirements updated.');
            } else {
                Alert.alert('Error', 'Could not save.');
            }
        } catch {
            Alert.alert('Error', 'Connection error.');
        } finally {
            setSaving(false);
        }
    };

    const toggleSelection = (list: string[], setList: any, item: string) => {
        if (list.includes(item)) {
            setList(list.filter(i => i !== item));
        } else {
            setList([...list, item]);
        }
    };

    if (loading) return <ActivityIndicator style={styles.loadingIndicator} size="large" />;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.header}>Hiring Requirements</Text>
            <Text style={styles.introText}>Define what you are looking for in a driver.</Text>

            <View style={styles.row}>
                <Text style={styles.label}>1. CDL Required?</Text>
                <Switch value={reqCdl} onValueChange={setReqCdl} />
            </View>

            {reqCdl && (
                <>
                    <MultiSelect
                        label="2. Accepted License Types"
                        options={['A', 'B', 'C']}
                        selected={reqLicenseTypes}
                        onToggle={(v: string) => toggleSelection(reqLicenseTypes, setReqLicenseTypes, v)}
                    />

                    <MultiSelect
                        label="3. Required Endorsements"
                        options={['T', 'N', 'H', 'X', 'P', 'S']}
                        selected={reqEndorsements}
                        onToggle={(v: string) => toggleSelection(reqEndorsements, setReqEndorsements, v)}
                    />
                </>
            )}

            <MultiSelect
                label="4. Operation Type"
                options={['Local', 'Regional', 'OTR']}
                selected={reqOpsTypes}
                onToggle={(v: string) => toggleSelection(reqOpsTypes, setReqOpsTypes, v)}
            />

            <View style={styles.section}>
                <Text style={styles.label}>5. Minimum Years of Experience</Text>
                <TextInput
                    style={styles.input}
                    value={expYears}
                    onChangeText={setExpYears}
                    keyboardType="numeric"
                    placeholder="Ej. 2"
                />
            </View>

            <MultiSelect
                label="6. Modality"
                options={['One trip', 'One load', 'Full time']}
                selected={reqModalities}
                onToggle={(v: string) => toggleSelection(reqModalities, setReqModalities, v)}
            />

            <View style={styles.row}>
                <Text style={styles.label}>7. Require Native Truck?</Text>
                <Switch value={reqTruck} onValueChange={setReqTruck} />
            </View>

            <MultiSelect
                label="8. Offered Payment Methods"
                options={['Per mile', 'Per trip', 'Per load', 'Hourly', 'Salary']}
                selected={offeredPayments}
                onToggle={(v: string) => toggleSelection(offeredPayments, setOfferedPayments, v)}
            />

            <MultiSelect
                label="9. Work Relationship"
                options={['Company Driver', 'Owner Operator', 'Team', 'Solo']}
                selected={reqRelationships}
                onToggle={(v: string) => toggleSelection(reqRelationships, setReqRelationships, v)}
            />

            <View style={styles.section}>
                <Text style={styles.label}>10. Availability</Text>
                <View style={styles.optionContainer}>
                    {['Immediate', '1-2 weeks', '1 month'].map(opt => (
                        <TouchableOpacity
                            key={opt}
                            style={[styles.optionButton, availability === opt && styles.optionSelected]}
                            onPress={() => setAvailability(opt)}
                        >
                            <Text style={[styles.optionText, availability === opt && styles.optionTextSelected]}>{opt}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={saveReqs} disabled={saving}>
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Requirements'}</Text>
            </TouchableOpacity>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#fff' },
    loadingIndicator: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
    introText: { marginBottom: 20, color: '#666' },
    section: { marginBottom: 20 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    label: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
    input: { borderBottomWidth: 1, borderColor: '#ccc', fontSize: 16, padding: 5 },
    optionContainer: { flexDirection: 'row', flexWrap: 'wrap' },
    optionButton: {
        paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#ccc',
        marginRight: 10, marginBottom: 10
    },
    optionSelected: { backgroundColor: '#000', borderColor: '#000' },
    optionText: { color: '#333' },
    optionTextSelected: { color: '#fff', fontWeight: 'bold' },
    saveButton: { backgroundColor: '#000', padding: 15, borderRadius: 5, alignItems: 'center', marginTop: 20 },
    saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
