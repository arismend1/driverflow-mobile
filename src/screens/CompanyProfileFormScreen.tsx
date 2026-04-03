import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { request, mapErrorToMessage } from '../api/client';
import { launchImageLibrary } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';


// --- REUSABLE COMPONENTS ---

// MultiSelect Component
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

// Single Select Component (Radio-like behavior for list)
const SingleSelect = ({ label, options, selected, onSelect }: any) => {
    return (
        <View style={styles.section}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.optionContainer}>
                {options.map((opt: string) => {
                    const isSelected = selected === opt;
                    return (
                        <TouchableOpacity
                            key={opt}
                            style={[styles.optionButton, isSelected && styles.optionSelected]}
                            onPress={() => onSelect(opt)}
                        >
                            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{opt}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

// Radio Yes/No Component
const RadioYesNo = ({ label, value, onChange }: any) => {
    return (
        <View style={styles.section}>
            <Text style={styles.label}>{label}</Text>
            <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                    style={[styles.radioButton, value === true && styles.radioSelected]}
                    onPress={() => onChange(true)}
                >
                    <Text style={[styles.radioText, value === true && styles.radioTextSelected]}>Yes</Text>
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

// --- MAIN SCREEN ---

export default function CompanyProfileFormScreen() {
    const { token, suppressPinLock, resumePinLock } = useAuth();
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form Fields
    const [reqCdl, setReqCdl] = useState(true); // Default True per specs? "Checkbox: CDL (obligatorio)"
    const [reqLicenseTypes, setReqLicenseTypes] = useState<string[]>([]);
    const [reqEndorsements, setReqEndorsements] = useState<string[]>([]);
    const [reqOpsTypes, setReqOpsTypes] = useState<string[]>([]);

    // Experiencia
    const [expOption, setExpOption] = useState(''); // "Practicante", "1-2 años", "2-5 años"
    const [expYearsExact, setExpYearsExact] = useState(''); // Campo opcional number

    const [reqModalities, setReqModalities] = useState<string[]>([]); // Tipo de trabajo
    const [reqTruck, setReqTruck] = useState(false);
    const [offeredPayments, setOfferedPayments] = useState<string[]>([]);
    const [reqRelationships, setReqRelationships] = useState<string[]>([]);
    const [availability, setAvailability] = useState('Immediate');
    const [payPerMileMin, setPayPerMileMin] = useState('');
    const [payPerMileMax, setPayPerMileMax] = useState('');
    const [companyLogo, setCompanyLogo] = useState<string | null>(null);
    const [companyLogoChanged, setCompanyLogoChanged] = useState(false);
    const [companyBio, setCompanyBio] = useState('');
    const [requiresTravelInterview, setRequiresTravelInterview] = useState(false);
    const [homeTime, setHomeTime] = useState('Flexible');
    const [offeredFreightTypes, setOfferedFreightTypes] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [contactPhone, setContactPhone] = useState('');

    useEffect(() => {
        loadReqs();
    }, []);

    const loadReqs = async () => {
        try {
            const res = await request('/api/companies/requirements', 'GET', undefined, token || undefined);
            if (!res.ok) {
                Alert.alert('Error', mapErrorToMessage(res.error) + (res.raw ? `\n${res.raw}` : ''));
                setLoading(false);
                return;
            }

            const data: any = res.data || {};

            setReqCdl(!!data.req_cdl);
            setReqLicenseTypes(Array.isArray(data.req_license_types) ? data.req_license_types : (data.req_license_types ? JSON.parse(data.req_license_types) : []));
            setReqEndorsements(Array.isArray(data.req_endorsements) ? data.req_endorsements : (data.req_endorsements ? JSON.parse(data.req_endorsements) : []));
            setReqOpsTypes(Array.isArray(data.req_operation_types) ? data.req_operation_types : (data.req_operation_types ? JSON.parse(data.req_operation_types) : []));

            setReqModalities(Array.isArray(data.req_modalities) ? data.req_modalities : (data.req_modalities ? JSON.parse(data.req_modalities) : []));
            setReqTruck(!!data.req_truck);
            setOfferedPayments(Array.isArray(data.offered_payment_methods) ? data.offered_payment_methods : (data.offered_payment_methods ? JSON.parse(data.offered_payment_methods) : []));
            setReqRelationships(Array.isArray(data.req_relationships) ? data.req_relationships : (data.req_relationships ? JSON.parse(data.req_relationships) : []));
            setAvailability(data.availability || 'Immediate');
            setPayPerMileMin(data.pay_per_mile_min ? String(data.pay_per_mile_min) : '');
            setPayPerMileMax(data.pay_per_mile_max ? String(data.pay_per_mile_max) : '');
            setCompanyLogo(data.company_logo || null);
            setCompanyBio(data.company_bio || '');
            setRequiresTravelInterview(!!data.requires_travel_interview);
            setHomeTime(data.home_time || 'Flexible');
            setOfferedFreightTypes(data.offered_freight_types || '');
            setContactPerson(data.contact_person || '');
            setContactPhone(data.contact_phone || '');

        } catch (e: any) {
            console.error(e);
            Alert.alert('Error', 'Error loading profile: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const saveReqs = async () => {
        setSaving(true);
        try {
            // Determine final experience value (logic: "years" is backend field)
            let finalExp = 0;
            if (expYearsExact) {
                finalExp = parseInt(expYearsExact);
            } else if (expOption === '1–2 years') {
                finalExp = 1;
            } else if (expOption === '2–5 years') {
                finalExp = 2;
            }

            const apiPayload: any = {
                req_cdl: reqCdl,
                req_license_types: reqLicenseTypes,
                req_endorsements: reqEndorsements,
                req_operation_types: reqOpsTypes,
                req_modalities: reqModalities,
                req_truck: reqTruck,
                offered_payment_methods: offeredPayments,
                req_relationships: reqRelationships,
                availability: availability,
                req_experience_years: finalExp,
                pay_per_mile_min: payPerMileMin ? parseFloat(payPerMileMin) : null,
                pay_per_mile_max: payPerMileMax ? parseFloat(payPerMileMax) : null,
                company_bio: companyBio,
                requires_travel_interview: requiresTravelInterview,
                home_time: homeTime,
                offered_freight_types: offeredFreightTypes,
                contact_person: contactPerson,
                contact_phone: contactPhone
            };

            if (companyLogoChanged && companyLogo) {
                apiPayload.company_logo = companyLogo;
            }

            const res = await request('/api/companies/requirements', 'PUT', apiPayload, token || undefined);

            if (res.ok) {
                Alert.alert('Profile Saved', 'Company profile saved ✅');
                navigation.goBack();
            } else {
                Alert.alert('Error', mapErrorToMessage(res.error) + (res.raw ? `\n${res.raw}` : ''));
            }
        } catch (e: any) {
            Alert.alert('Error', 'Connection error: ' + e.message);
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
                <Text style={styles.header}>Job Requirements</Text>

                {/* 1. Licencia (Checkbox - Implied by RadioYesNo or just Check) */}
                {/* Specs: "Checkbox: CDL (obligatorio)" -> Suggests always checked or toggle */}
                <View style={styles.row}>
                    <Text style={styles.label}>1. CDL Required</Text>
                    <TouchableOpacity onPress={() => setReqCdl(!reqCdl)}>
                        <Text style={{ fontSize: 24 }}>{reqCdl ? '☑️' : '⬜'}</Text>
                    </TouchableOpacity>
                </View>

                {/* --- PUBLIC PROFILE SECTION --- */}
                <View style={[styles.section, { backgroundColor: '#f0f4f8', padding: 15, borderRadius: 10 }]}>
                    <Text style={[styles.header, { fontSize: 20, marginBottom: 10 }]}>Public Profile (Driver View)</Text>
                    <Text style={{ fontSize: 13, color: '#666', marginBottom: 15 }}>These fields will be shown to drivers to attract their interest.</Text>

                    {/* Logo Picker */}
                    <Text style={styles.label}>Company Logo</Text>
                    <TouchableOpacity
                        style={styles.logoPicker}
                        onPress={async () => {
                            suppressPinLock();
                            const result = await launchImageLibrary({
                                mediaType: 'photo',
                                includeBase64: true,
                                maxWidth: 500,
                                maxHeight: 500,
                                quality: 0.7,
                            });
                            resumePinLock();
                            if (result.assets && result.assets[0].base64) {
                                setCompanyLogo(`data:image/jpeg;base64,${result.assets[0].base64}`);
                                setCompanyLogoChanged(true);
                            }
                        }}
                    >
                        {companyLogo ? (
                            <Image source={{ uri: companyLogo }} style={styles.logoImage} />
                        ) : (
                            <Text style={styles.logoPlaceholder}>Tap to upload logo</Text>
                        )}
                    </TouchableOpacity>

                    {/* Bio */}
                    <Text style={[styles.label, { marginTop: 15 }]}>Short Description / Motto</Text>
                    <TextInput
                        style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                        multiline
                        placeholder="e.g. We treat our drivers like family. High safety standards."
                        value={companyBio}
                        onChangeText={setCompanyBio}
                    />

                    {/* Pay range */}
                    <Text style={[styles.label, { marginTop: 15 }]}>💰 Pay Range per Mile (USD)</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ width: '48%' }}>
                            <Text style={{ fontSize: 12, color: '#666' }}>Min</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                placeholder="0.65"
                                value={payPerMileMin}
                                onChangeText={setPayPerMileMin}
                            />
                        </View>
                        <View style={{ width: '48%' }}>
                            <Text style={{ fontSize: 12, color: '#666' }}>Max</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                placeholder="0.85"
                                value={payPerMileMax}
                                onChangeText={setPayPerMileMax}
                            />
                        </View>
                    </View>

                    {/* Freight Type */}
                    <Text style={[styles.label, { marginTop: 15 }]}>📦 Offered Freight Types</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Refrigerated, Dry Van, Hazmat"
                        value={offeredFreightTypes}
                        onChangeText={setOfferedFreightTypes}
                    />

                    {/* Home Time */}
                    <View style={{ marginTop: 15 }}>
                        <SingleSelect
                            label="🏠 Home Time Offered"
                            options={['Weekly', 'Bi-weekly', 'Monthly', 'Flexible']}
                            selected={homeTime}
                            onSelect={setHomeTime}
                        />
                    </View>

                    {/* Travel for interview */}
                    <View style={{ marginTop: 20 }}>
                        <RadioYesNo
                            label="Requires in-person interview (requires travel for driver)?"
                            value={requiresTravelInterview}
                            onChange={setRequiresTravelInterview}
                        />
                    </View>

                    <Text style={[styles.label, { marginTop: 15 }]}>👤 Contact Person</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Name of the person to contact"
                        value={contactPerson}
                        onChangeText={setContactPerson}
                    />

                    <Text style={[styles.label, { marginTop: 15 }]}>📞 Contact Phone</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Phone number for drivers"
                        value={contactPhone}
                        onChangeText={setContactPhone}
                        keyboardType="phone-pad"
                    />
                </View>

                {/* 2. Tipo de Licencia */}
                <MultiSelect
                    label="2. License Type"
                    options={['A', 'B', 'C']}
                    selected={reqLicenseTypes}
                    onToggle={(v: string) => toggleSelection(reqLicenseTypes, setReqLicenseTypes, v)}
                />

                {/* 3. Endorsements */}
                <MultiSelect
                    label="3. Required Endorsements"
                    options={['T', 'N', 'H', 'X', 'P', 'S']}
                    selected={reqEndorsements}
                    onToggle={(v: string) => toggleSelection(reqEndorsements, setReqEndorsements, v)}
                />

                {/* 4. Operación */}
                <MultiSelect
                    label="4. Operation Type"
                    options={['Local', 'Regional', 'OTR']}
                    selected={reqOpsTypes}
                    onToggle={(v: string) => toggleSelection(reqOpsTypes, setReqOpsTypes, v)}
                />

                {/* 5. Experiencia */}
                <View style={styles.section}>
                    <Text style={styles.label}>5. Required Experience</Text>
                    <View style={styles.optionContainer}>
                        {['Trainee', '1–2 years', '2–5 years'].map(opt => (
                            <TouchableOpacity
                                key={opt}
                                style={[styles.optionButton, expOption === opt && styles.optionSelected]}
                                onPress={() => { setExpOption(opt); setExpYearsExact(''); }}
                            >
                                <Text style={[styles.optionText, expOption === opt && styles.optionTextSelected]}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={[styles.label, { marginTop: 10, fontSize: 14 }]}>Optional: Exact Years</Text>
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
                    label="6. Job Type"
                    options={['One trip', 'One load', 'Full time']}
                    selected={reqModalities}
                    onToggle={(v: string) => toggleSelection(reqModalities, setReqModalities, v)}
                />

                {/* 7. Camión Propio */}
                <RadioYesNo
                    label="7. Require Native Truck?"
                    value={reqTruck}
                    onChange={setReqTruck}
                />

                {/* 8. Modalidad Pago */}
                <MultiSelect
                    label="8. Payment Methods"
                    options={['Per mile', 'Per trip', 'Per load', 'Hourly', 'Salary']}
                    selected={offeredPayments}
                    onToggle={(v: string) => toggleSelection(offeredPayments, setOfferedPayments, v)}
                />

                {/* 9. Contratación */}
                <MultiSelect
                    label="9. Work Relationship"
                    options={['Company Driver', 'Owner Operator', 'Team', 'Solo']}
                    selected={reqRelationships}
                    onToggle={(v: string) => toggleSelection(reqRelationships, setReqRelationships, v)}
                />

                {/* 10. Disponibilidad */}
                <SingleSelect
                    label="10. Job Availability"
                    options={['Immediate', 'In 1–2 weeks', 'In 1 month']}
                    selected={availability}
                    onSelect={setAvailability}
                />

                {/* Save Button */}
                <TouchableOpacity style={styles.saveButton} onPress={saveReqs} disabled={saving}>
                    <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
                </TouchableOpacity>

            </ScrollView>
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#fff' },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#000' },
    section: { marginBottom: 25 },
    label: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#333' },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },

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
    saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

    logoPicker: {
        width: 120,
        height: 120,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#cbd5e0',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        overflow: 'hidden'
    },
    logoImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    logoPlaceholder: {
        textAlign: 'center',
        padding: 10,
        color: '#718096',
        fontSize: 12
    }
});
