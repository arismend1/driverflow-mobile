import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { getDriverProfile, updateDriverProfile, mapErrorToMessage } from '../api/client';

// --- REUSABLE COMPONENTS ---

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

const RadioYesNo = ({ label, value, onChange }: any) => {
    return (
        <View style={styles.section}>
            <Text style={styles.label}>{label}</Text>
            <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                    style={[styles.radioButton, value === true && styles.radioSelected]}
                    onPress={() => onChange(true)}
                >
                    <Text style={[styles.radioText, value === true && styles.radioTextSelected]}>Sí</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.radioButton, value === false && styles.radioSelected]}
                    onPress={() => onChange(false)}
                >
                    <Text style={[styles.radioText, value === false && styles.radioTextSelected]}>No</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default function DriverProfileFormScreen() {
    const { token, userInfo } = useAuth();
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form Fields
    const [hasCdl, setHasCdl] = useState(false);
    const [licenseTypes, setLicenseTypes] = useState<string[]>([]);
    const [endorsements, setEndorsements] = useState<string[]>([]);
    const [opsTypes, setOpsTypes] = useState<string[]>([]);

    const [expOption, setExpOption] = useState('');
    const [expYearsExact, setExpYearsExact] = useState('');

    const [modalities, setModalities] = useState<string[]>([]); // Tipo de trabajo
    const [hasTruck, setHasTruck] = useState(false);
    const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
    const [relationships, setRelationships] = useState<string[]>([]);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const res = await getDriverProfile(token || '');
            if (res.ok && res.data) {
                const data = res.data;
                if (data.id) {
                    setHasCdl(!!data.has_cdl);
                    setLicenseTypes(data.license_types || []);
                    setEndorsements(data.endorsements || []);
                    setOpsTypes(data.operation_types || []);
                    setExpOption(data.experience_range || '');
                    setExpYearsExact(data.experience_years ? String(data.experience_years) : '');
                    setModalities(data.job_preferences || []);
                    setHasTruck(!!data.has_truck);
                    setPaymentMethods(data.payment_methods || []);
                    setRelationships(data.work_relationships || []);
                }
            } else {
                console.warn("[LOAD_PROFILE] Failed", res.status, res.error);
            }
        } catch (e) {
            console.error("[LOAD_PROFILE] Crash", e);
        } finally {
            setLoading(false);
        }
    };

    const saveProfile = async () => {
        setSaving(true);
        try {
            let finalExp = 0;
            if (expYearsExact) {
                finalExp = parseInt(expYearsExact);
            } else if (expOption === '1–2 años') {
                finalExp = 1;
            } else if (expOption === '2–5 años') {
                finalExp = 2;
            }

            const payload = {
                has_cdl: hasCdl,
                license_types: licenseTypes,
                endorsements: endorsements,
                operation_types: opsTypes,
                experience_years: finalExp,
                experience_range: expOption || "Custom",
                job_preferences: modalities,
                has_truck: hasTruck,
                payment_methods: paymentMethods,
                work_relationships: relationships
            };

            const res = await updateDriverProfile(payload, token || '');

            if (res.ok) {
                Alert.alert(
                    'Perfil Guardado',
                    'Tu perfil está activo y visible ✅',
                    [{
                        text: 'OK',
                        onPress: () => navigation.dispatch(
                            CommonActions.reset({
                                index: 0,
                                routes: [{ name: 'Home' }],
                            })
                        )
                    }]
                );
            } else {
                const msg = mapErrorToMessage(res.error);
                Alert.alert('Error al guardar', `${msg}\n\nStatus: ${res.status}\nRaw: ${res.raw?.slice(0, 100)}`);
            }
        } catch (e: any) {
            Alert.alert('Error', 'Error de conexión: ' + e.message);
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
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
        >
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
                {/* UX Banner */}
                {userInfo && (
                    <View style={styles.statusBanner}>
                        <Text style={styles.statusTitle}>✅ Tu perfil está activo y visible</Text>
                    </View>
                )}

                <Text style={styles.header}>Perfil Profesional</Text>

                {/* 1. Licencia CDL */}
                <RadioYesNo
                    label="1. ¿Tiene licencia CDL?"
                    value={hasCdl}
                    onChange={setHasCdl}
                />

                {/* 2. Tipo Licencia */}
                {hasCdl && (
                    <MultiSelect
                        label="2. Tipo de Licencia"
                        options={['A', 'B', 'C']}
                        selected={licenseTypes}
                        onToggle={(v: string) => toggleSelection(licenseTypes, setLicenseTypes, v)}
                    />
                )}

                {/* 3. Endorsements */}
                <MultiSelect
                    label="3. Endorsements"
                    options={['T', 'N', 'H', 'X', 'P', 'S']}
                    selected={endorsements}
                    onToggle={(v: string) => toggleSelection(endorsements, setEndorsements, v)}
                />

                {/* 4. Operación */}
                <MultiSelect
                    label="4. Tipo de Operación Buscada"
                    options={['Local', 'Regional', 'OTR']}
                    selected={opsTypes}
                    onToggle={(v: string) => toggleSelection(opsTypes, setOpsTypes, v)}
                />

                {/* 5. Experiencia */}
                <View style={styles.section}>
                    <Text style={styles.label}>5. Experiencia</Text>
                    <View style={styles.optionContainer}>
                        {['Practicante', '1–2 años', '2–5 años'].map(opt => (
                            <TouchableOpacity
                                key={opt}
                                style={[styles.optionButton, expOption === opt && styles.optionSelected]}
                                onPress={() => { setExpOption(opt); setExpYearsExact(''); }}
                            >
                                <Text style={[styles.optionText, expOption === opt && styles.optionTextSelected]}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={[styles.label, { marginTop: 10, fontSize: 14 }]}>Opcional: Años Exactos</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="Ej. 3"
                        value={expYearsExact}
                        onChangeText={(t) => { setExpYearsExact(t); setExpOption(''); }}
                    />
                </View>

                {/* 6. Tipo Trabajo */}
                <MultiSelect
                    label="6. Tipo de Trabajo que busca"
                    options={['Un viaje', 'Una carga', 'Tiempo completo']} // OTR implied
                    selected={modalities}
                    onToggle={(v: string) => toggleSelection(modalities, setModalities, v)}
                />

                {/* 7. Camión Propio */}
                <RadioYesNo
                    label="7. ¿Tiene Camión Propio?"
                    value={hasTruck}
                    onChange={setHasTruck}
                />

                {/* 8. Cobro */}
                <MultiSelect
                    label="8. Cómo desea cobrar"
                    options={['Por milla', 'Por viaje', 'Por carga', 'Por horas', 'Sueldo']}
                    selected={paymentMethods}
                    onToggle={(v: string) => toggleSelection(paymentMethods, setPaymentMethods, v)}
                />

                {/* 9. Modalidad */}
                <MultiSelect
                    label="9. Modalidad de Trabajo"
                    options={['Company Driver', 'Owner-Operator', 'Team', 'Solo']}
                    selected={relationships}
                    onToggle={(v: string) => toggleSelection(relationships, setRelationships, v)}
                />

                {/* Save Button */}
                <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={saving}>
                    <Text style={styles.saveButtonText}>{saving ? 'Guardando...' : 'Guardar Perfil'}</Text>
                </TouchableOpacity>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#fff' },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#000' },
    statusBanner: {
        backgroundColor: '#e6fffa', borderColor: '#38b2ac', borderWidth: 1, borderRadius: 8,
        padding: 15, marginBottom: 20, alignItems: 'center'
    },
    statusTitle: { color: '#2c7a7b', fontWeight: 'bold', fontSize: 16 },
    section: { marginBottom: 25 },
    label: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#333' },

    optionContainer: { flexDirection: 'row', flexWrap: 'wrap' },
    optionButton: {
        paddingVertical: 10, paddingHorizontal: 16, borderRadius: 25, borderWidth: 1, borderColor: '#e2e8f0',
        marginRight: 10, marginBottom: 10, backgroundColor: '#f7fafc'
    },
    optionSelected: { backgroundColor: '#000', borderColor: '#000' },
    optionText: { color: '#4a5568', fontWeight: '500' },
    optionTextSelected: { color: '#fff' },

    radioButton: {
        paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0',
        marginRight: 15, backgroundColor: '#f7fafc', minWidth: 80, alignItems: 'center'
    },
    radioSelected: { backgroundColor: '#000', borderColor: '#000' },
    radioText: { color: '#4a5568', fontWeight: '500' },
    radioTextSelected: { color: '#fff' },

    input: {
        borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#f7fafc',
        marginTop: 5
    },

    saveButton: {
        backgroundColor: '#000', paddingVertical: 18, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 40,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 6
    },
    saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
