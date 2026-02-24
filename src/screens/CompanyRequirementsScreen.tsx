import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../api/config';
import { useNavigation } from '@react-navigation/native';

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
    const navigation = useNavigation();
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

    useEffect(() => {
        loadReqs();
    }, []);

    const loadReqs = async () => {
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
                    // Let's assume user inputs a string like "2" 
                    setExpYears(data.req_experience_range ? (JSON.parse(data.req_experience_range)[0] || '0') : '0');
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
    };

    const saveReqs = async () => {
        setSaving(true);
        try {
            const payload = {
                req_cdl: reqCdl,
                req_license_types: reqLicenseTypes,
                req_endorsements: reqEndorsements,
                req_operation_types: reqOpsTypes,
                req_experience_range: JSON.stringify([expYears]), // Hacky storage of min years
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
                Alert.alert('Éxito', 'Requisitos actualizados.');
            } else {
                Alert.alert('Error', 'No se pudo guardar.');
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
            <Text style={styles.header}>Requisitos de Contratación</Text>
            <Text style={{ marginBottom: 20, color: '#666' }}>Define qué buscas en un conductor.</Text>

            <View style={styles.row}>
                <Text style={styles.label}>1. ¿Requiere Licencia CDL?</Text>
                <Switch value={reqCdl} onValueChange={setReqCdl} />
            </View>

            {reqCdl && (
                <>
                    <MultiSelect
                        label="2. Tipos de Licencia Aceptados"
                        options={['A', 'B', 'C']}
                        selected={reqLicenseTypes}
                        onToggle={(v: string) => toggleSelection(reqLicenseTypes, setReqLicenseTypes, v)}
                    />

                    <MultiSelect
                        label="3. Endorsements Requeridos"
                        options={['T', 'N', 'H', 'X', 'P', 'S']}
                        selected={reqEndorsements}
                        onToggle={(v: string) => toggleSelection(reqEndorsements, setReqEndorsements, v)}
                    />
                </>
            )}

            <MultiSelect
                label="4. Tipo de Operación"
                options={['Local', 'Regional', 'OTR']}
                selected={reqOpsTypes}
                onToggle={(v: string) => toggleSelection(reqOpsTypes, setReqOpsTypes, v)}
            />

            <View style={styles.section}>
                <Text style={styles.label}>5. Años Mínimos de Experiencia</Text>
                <TextInput
                    style={styles.input}
                    value={expYears}
                    onChangeText={setExpYears}
                    keyboardType="numeric"
                    placeholder="Ej. 2"
                />
            </View>

            <MultiSelect
                label="6. Modalidad"
                options={['1 viaje', '1 carga', 'Tiempo completo']}
                selected={reqModalities}
                onToggle={(v: string) => toggleSelection(reqModalities, setReqModalities, v)}
            />

            <View style={styles.row}>
                <Text style={styles.label}>7. ¿Requiere Camión Propio?</Text>
                <Switch value={reqTruck} onValueChange={setReqTruck} />
            </View>

            <MultiSelect
                label="8. Formas de Pago Ofrecidas"
                options={['Mile', 'Trip', 'Load', 'Hour', 'Salary']}
                selected={offeredPayments}
                onToggle={(v: string) => toggleSelection(offeredPayments, setOfferedPayments, v)}
            />

            <MultiSelect
                label="9. Relación Laboral"
                options={['Company Driver', 'Owner Operator', 'Team', 'Solo']}
                selected={reqRelationships}
                onToggle={(v: string) => toggleSelection(reqRelationships, setReqRelationships, v)}
            />

            <View style={styles.section}>
                <Text style={styles.label}>10. Disponibilidad</Text>
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
                <Text style={styles.saveButtonText}>{saving ? 'Guardando...' : 'Guardar Requisitos'}</Text>
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
    saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
