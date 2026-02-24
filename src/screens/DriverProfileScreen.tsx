import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../api/config';
import { useNavigation } from '@react-navigation/native';

// Helper for MultiSelect
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

export default function DriverProfileScreen() {
    const { token, user } = useAuth();
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [hasCdl, setHasCdl] = useState(false);
    const [licenseTypes, setLicenseTypes] = useState<string[]>([]);
    const [endorsements, setEndorsements] = useState<string[]>([]);
    const [opsTypes, setOpsTypes] = useState<string[]>([]);
    const [expYears, setExpYears] = useState('0');
    const [expRange, setExpRange] = useState(''); // Optional if using years
    const [preferences, setPreferences] = useState<string[]>([]);
    const [hasTruck, setHasTruck] = useState(false);
    const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
    const [relationships, setRelationships] = useState<string[]>([]);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const res = await fetch(`${API_URL}/drivers/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.driver_id) { // If exists
                    setHasCdl(!!data.has_cdl);
                    setLicenseTypes(data.license_types || []);
                    setEndorsements(data.endorsements || []);
                    setOpsTypes(data.operation_types || []);
                    setExpYears((data.experience_years || 0).toString());
                    setPreferences(data.job_preferences || []);
                    setHasTruck(!!data.has_truck);
                    setPaymentMethods(data.payment_methods || []);
                    setRelationships(data.work_relationships || []);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const saveProfile = async () => {
        setSaving(true);
        try {
            const payload = {
                has_cdl: hasCdl,
                license_types: licenseTypes,
                endorsements: endorsements,
                operation_types: opsTypes,
                experience_years: parseInt(expYears) || 0,
                experience_range: "Custom",
                job_preferences: preferences,
                has_truck: hasTruck,
                payment_methods: paymentMethods,
                work_relationships: relationships
            };

            const res = await fetch(`${API_URL}/drivers/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                Alert.alert('Éxito', 'Perfil actualizado correctamente.');
                // Optional: Go back or stay
            } else {
                Alert.alert('Error', 'No se pudo guardar el perfil.');
            }
        } catch (e) {
            Alert.alert('Error', 'Error de conexión.');
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

    if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.header}>Perfil Profesional</Text>

            {/* UX Requirement: Active Status Feedback */}
            {user && (
                <View style={styles.statusBanner}>
                    <Text style={styles.statusTitle}>✅ Tu perfil está activo</Text>
                    <Text style={styles.statusSubtitle}>Buscamos empresas compatibles con tus requisitos.</Text>
                </View>
            )}

            <View style={styles.row}>
                <Text style={styles.label}>1. ¿Tienes Licencia CDL?</Text>
                <Switch value={hasCdl} onValueChange={setHasCdl} />
            </View>

            {hasCdl && (
                <>
                    <MultiSelect
                        label="2. Tipo de Licencia"
                        options={['A', 'B', 'C']}
                        selected={licenseTypes}
                        onToggle={(v: string) => toggleSelection(licenseTypes, setLicenseTypes, v)}
                    />

                    <MultiSelect
                        label="3. Endorsements"
                        options={['T', 'N', 'H', 'X', 'P', 'S']}
                        selected={endorsements}
                        onToggle={(v: string) => toggleSelection(endorsements, setEndorsements, v)}
                    />
                </>
            )}

            <MultiSelect
                label="4. Tipo de Operación Buscada"
                options={['Local', 'Regional', 'OTR']}
                selected={opsTypes}
                onToggle={(v: string) => toggleSelection(opsTypes, setOpsTypes, v)}
            />

            <View style={styles.section}>
                <Text style={styles.label}>5. Experiencia (Años)</Text>
                <TextInput
                    style={styles.input}
                    value={expYears}
                    onChangeText={setExpYears}
                    keyboardType="numeric"
                    placeholder="Ej. 5"
                />
            </View>

            <MultiSelect
                label="6. Preferencia de Trabajo"
                options={['One Trip', 'One Load', 'Full Time']}
                selected={preferences}
                onToggle={(v: string) => toggleSelection(preferences, setPreferences, v)}
            />

            <View style={styles.row}>
                <Text style={styles.label}>7. ¿Tienes Camión Propio?</Text>
                <Switch value={hasTruck} onValueChange={setHasTruck} />
            </View>

            <MultiSelect
                label="8. Forma de Pago Aceptada"
                options={['Mile', 'Trip', 'Load', 'Hour', 'Salary']}
                selected={paymentMethods}
                onToggle={(v: string) => toggleSelection(paymentMethods, setPaymentMethods, v)}
            />

            <MultiSelect
                label="9. Relación Laboral"
                options={['Company Driver', 'Owner Operator', 'Team', 'Solo']}
                selected={relationships}
                onToggle={(v: string) => toggleSelection(relationships, setRelationships, v)}
            />

            <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={saving}>
                <Text style={styles.saveButtonText}>{saving ? 'Guardando...' : 'Guardar Perfil'}</Text>
            </TouchableOpacity>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#fff' },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
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
    saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    statusBanner: {
        backgroundColor: '#e6fffa', borderColor: '#38b2ac', borderWidth: 1, borderRadius: 8,
        padding: 15, marginBottom: 20
    },
    statusTitle: { color: '#2c7a7b', fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
    statusSubtitle: { color: '#2c7a7b', fontSize: 14 }
});
