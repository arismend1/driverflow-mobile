import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { getDriverProfile, updateDriverProfile, mapErrorToMessage } from '../api/client';
import { launchImageLibrary } from 'react-native-image-picker';

// --- REUSABLE COMPONENTS ---
function MultiSelect({ label, options, selected = [], onToggle }: any) {
    return (
        <View style={styles.section}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.optionContainer}>
                {options.map((opt: string) => (
                    <TouchableOpacity
                        key={opt}
                        style={[styles.optionButton, selected.includes(opt) && styles.optionSelected]}
                        onPress={() => onToggle(opt)}
                    >
                        <Text style={[styles.optionText, selected.includes(opt) && styles.optionTextSelected]}>{opt}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

function RadioYesNo({ label, value, onChange }: any) {
    return (
        <View style={styles.section}>
            <Text style={styles.label}>{label}</Text>
            <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                    style={[styles.radioButton, value && styles.radioSelected]}
                    onPress={() => onChange(true)}
                >
                    <Text style={[styles.radioText, value && styles.radioTextSelected]}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.radioButton, !value && styles.radioSelected]}
                    onPress={() => onChange(false)}
                >
                    <Text style={[styles.radioText, !value && styles.radioTextSelected]}>No</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function DriverProfileFormScreen() {
    const { token, userInfo } = useAuth();
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // ================= EXISTING FIELDS (1-10) =================
    const [hasCdl, setHasCdl] = useState(false);
    const [licenseTypes, setLicenseTypes] = useState<string[]>([]);
    const [endorsements, setEndorsements] = useState<string[]>([]);
    const [opsTypes, setOpsTypes] = useState<string[]>([]);
    const [expOption, setExpOption] = useState('');
    const [expYearsExact, setExpYearsExact] = useState('');
    const [modalities, setModalities] = useState<string[]>([]);
    const [hasTruck, setHasTruck] = useState(false);
    const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
    const [relationships, setRelationships] = useState<string[]>([]);
    const [availability, setAvailability] = useState('Immediate');

    // ================= PHASE 6: NEW FIELDS =================
    // Location
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [preferredRegion, setPreferredRegion] = useState('');
    const [willingToRelocate, setWillingToRelocate] = useState(false);

    // Experience
    const [weeklyMiles, setWeeklyMiles] = useState('');
    const [longestOtr, setLongestOtr] = useState('');
    const [trailerExperience, setTrailerExperience] = useState<string[]>([]);

    // Safety Record
    const [accidents3y, setAccidents3y] = useState('0');
    const [tickets3y, setTickets3y] = useState('0');

    // Work Preferences
    const [homeTime, setHomeTime] = useState('');
    const [preferredFreight, setPreferredFreight] = useState('');

    // Driver Bio
    const [driverBio, setDriverBio] = useState('');

    // Photos
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
    const [licenseFront, setLicenseFront] = useState<string | null>(null);
    const [licenseBack, setLicenseBack] = useState<string | null>(null);
    const [photoConsent, setPhotoConsent] = useState(false);
    const [photoConsentAt, setPhotoConsentAt] = useState<string | null>(null);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const res = await getDriverProfile(token || '');
            if (res.ok && res.data) {
                const data = res.data;
                if (data.id) {
                    // Existing fields
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
                    setAvailability(data.availability || 'Immediate');

                    // Phase 6 fields
                    setCity(data.city || '');
                    setState(data.state || '');
                    setPreferredRegion(data.preferred_region || '');
                    setWillingToRelocate(!!data.willing_to_relocate);
                    setWeeklyMiles(data.weekly_miles ? String(data.weekly_miles) : '');
                    setLongestOtr(data.longest_otr || '');
                    setTrailerExperience(data.trailer_experience || []);
                    setAccidents3y(data.accidents_3y != null ? String(data.accidents_3y) : '0');
                    setTickets3y(data.tickets_3y != null ? String(data.tickets_3y) : '0');
                    setHomeTime(data.home_time || '');
                    setPreferredFreight(data.preferred_freight || '');
                    setDriverBio(data.driver_bio || '');

                    // Photos
                    setProfilePhoto(data.profile_photo_base64 || null);
                    setLicenseFront(data.license_front_base64 || null);
                    setLicenseBack(data.license_back_base64 || null);
                    if (data.photo_consent_at) {
                        setPhotoConsent(true);
                        setPhotoConsentAt(data.photo_consent_at);
                    }
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
            }

            const payload: any = {
                // Existing fields
                has_cdl: hasCdl,
                license_types: licenseTypes,
                endorsements: endorsements,
                operation_types: opsTypes,
                experience_years: finalExp,
                experience_range: expOption || "Custom",
                job_preferences: modalities,
                has_truck: hasTruck,
                payment_methods: paymentMethods,
                work_relationships: relationships,
                availability: availability,

                // Phase 6 fields
                city, state,
                weekly_miles: weeklyMiles ? parseInt(weeklyMiles) : null,
                longest_otr: longestOtr || null,
                trailer_experience: trailerExperience,
                accidents_3y: parseInt(accidents3y) || 0,
                tickets_3y: parseInt(tickets3y) || 0,
                home_time: homeTime || null,
                preferred_freight: preferredFreight || null,
                preferred_region: preferredRegion || null,
                willing_to_relocate: willingToRelocate,
                driver_bio: driverBio || null,
            };

            // Only include photos if consent is given
            if (photoConsent) {
                if (profilePhoto) payload.profile_photo_base64 = profilePhoto;
                if (licenseFront) payload.license_front_base64 = licenseFront;
                if (licenseBack) payload.license_back_base64 = licenseBack;
                payload.photo_consent_at = photoConsentAt || new Date().toISOString();
            }

            const res = await updateDriverProfile(payload, token || '');

            if (res.ok) {
                Alert.alert(
                    'Profile Saved',
                    'Your profile is active and visible ✅',
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
                Alert.alert('Save Error', `${msg}\n\nStatus: ${res.status}\nRaw: ${res.raw?.slice(0, 100)}`);
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

    const pickImage = (setter: (base64: string) => void) => {
        console.log("[PHOTO_PICKER] Button pressed");
        try {
            console.log("[PHOTO_PICKER] About to open image picker (launchImageLibrary)...");
            if (typeof launchImageLibrary !== 'function') {
                console.error("[PHOTO_PICKER] FATAL: launchImageLibrary is not a function. Check imports and native linking.");
                Alert.alert('Error', 'Image picker not initialized correctly.');
                return;
            }

            launchImageLibrary(
                {
                    mediaType: 'photo',
                    quality: 0.5,
                    includeBase64: true,
                    maxWidth: 800,
                    maxHeight: 800
                },
                (response) => {
                    console.log("[PHOTO_PICKER] Response received", { didCancel: response.didCancel, errorCode: response.errorCode });
                    if (response.didCancel) return;
                    if (response.errorCode) {
                        console.error("[PHOTO_PICKER] Error Code:", response.errorCode, response.errorMessage);
                        Alert.alert('Error', response.errorMessage || 'Could not load image');
                        return;
                    }
                    const asset = response.assets?.[0];
                    if (asset?.base64) {
                        console.log("[PHOTO_PICKER] Image selected successfully");
                        setter(`data:${asset.type || 'image/jpeg'};base64,${asset.base64}`);
                    } else {
                        console.warn("[PHOTO_PICKER] No base64 found in asset");
                    }
                }
            );
        } catch (err: any) {
            console.error("[PHOTO_PICKER] CRASH in pickImage handler:", err);
            Alert.alert('Fatal Error', 'Image picker crashed: ' + err.message);
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
                        <Text style={styles.statusTitle}>✅ Your profile is active and visible</Text>
                    </View>
                )}

                <Text style={styles.header}>Professional Profile</Text>

                {/* ========== SECTION: CORE QUALIFICATIONS (1-10) ========== */}
                <Text style={styles.sectionHeader}>🎯 Core Qualifications</Text>

                {/* 1. CDL */}
                <RadioYesNo label="1. Do you have a CDL?" value={hasCdl} onChange={setHasCdl} />

                {/* 2. License Type */}
                {hasCdl && (
                    <MultiSelect label="2. License Type" options={['A', 'B', 'C']}
                        selected={licenseTypes}
                        onToggle={(v: string) => toggleSelection(licenseTypes, setLicenseTypes, v)} />
                )}

                {/* 3. Endorsements */}
                <MultiSelect label="3. Endorsements" options={['T', 'N', 'H', 'X', 'P', 'S']}
                    selected={endorsements}
                    onToggle={(v: string) => toggleSelection(endorsements, setEndorsements, v)} />

                {/* 4. Operation Type */}
                <MultiSelect label="4. Desired Operation Type" options={['Local', 'Regional', 'OTR']}
                    selected={opsTypes}
                    onToggle={(v: string) => toggleSelection(opsTypes, setOpsTypes, v)} />

                {/* 5. Experience */}
                <View style={styles.section}>
                    <Text style={styles.label}>5. Years of Experience</Text>
                    <TextInput style={styles.input} keyboardType="numeric" placeholder="e.g. 3"
                        value={expYearsExact}
                        onChangeText={(t) => { setExpYearsExact(t); setExpOption('Custom'); }} />
                </View>

                {/* 6. Job Type */}
                <MultiSelect label="6. Job Type" options={['One trip', 'One load', 'Full time']}
                    selected={modalities}
                    onToggle={(v: string) => toggleSelection(modalities, setModalities, v)} />

                {/* 7. Own Truck */}
                <RadioYesNo label="7. Have Your Own Truck?" value={hasTruck} onChange={setHasTruck} />

                {/* 8. Payment */}
                <MultiSelect label="8. Payment Modality" options={['Per mile', 'Per trip', 'Per load', 'Hourly', 'Salary']}
                    selected={paymentMethods}
                    onToggle={(v: string) => toggleSelection(paymentMethods, setPaymentMethods, v)} />

                {/* 9. Work Relationship */}
                <MultiSelect label="9. Work Relationship" options={['Company Driver', 'Owner Operator', 'Team', 'Solo']}
                    selected={relationships}
                    onToggle={(v: string) => toggleSelection(relationships, setRelationships, v)} />

                {/* 10. Availability */}
                <View style={styles.section}>
                    <Text style={styles.label}>10. Availability</Text>
                    <View style={styles.optionContainer}>
                        {['Immediate', '1-2 weeks', '1 month'].map(opt => (
                            <TouchableOpacity key={opt}
                                style={[styles.optionButton, availability === opt && styles.optionSelected]}
                                onPress={() => setAvailability(opt)}>
                                <Text style={[styles.optionText, availability === opt && styles.optionTextSelected]}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ========== SECTION: PHOTOS & IDENTITY ========== */}
                <View style={styles.divider} />
                <Text style={styles.sectionHeader}>📷 Photos & Identity</Text>

                {/* Profile Photo */}
                <View style={styles.section}>
                    <Text style={styles.label}>11. Profile Photo</Text>
                    {profilePhoto ? (
                        <Image source={{ uri: profilePhoto }} style={styles.photoPreview} />
                    ) : (
                        <View style={styles.photoPlaceholder}>
                            <Text style={{ color: '#999', fontSize: 14 }}>No photo uploaded</Text>
                        </View>
                    )}
                    <TouchableOpacity style={styles.photoButton} onPress={() => pickImage(setProfilePhoto)}>
                        <Text style={styles.photoButtonText}>{profilePhoto ? 'Change Photo' : 'Upload Photo'}</Text>
                    </TouchableOpacity>
                </View>

                {/* CDL License Photos */}
                <View style={styles.section}>
                    <Text style={styles.label}>12. CDL License Photos</Text>

                    {/* Legal Consent */}
                    <TouchableOpacity style={styles.consentRow} onPress={() => {
                        const newVal = !photoConsent;
                        setPhotoConsent(newVal);
                        if (newVal) setPhotoConsentAt(new Date().toISOString());
                    }}>
                        <View style={[styles.checkbox, photoConsent && styles.checkboxChecked]}>
                            {photoConsent && <Text style={{ color: '#fff', fontWeight: 'bold' }}>✓</Text>}
                        </View>
                        <Text style={styles.consentText}>
                            By uploading your CDL license and profile photo, you authorize DriverFlow to share this information with companies you match with for employment purposes.
                        </Text>
                    </TouchableOpacity>

                    {photoConsent && (
                        <View style={{ marginTop: 12 }}>
                            <Text style={styles.sublabel}>License Front</Text>
                            {licenseFront ? (
                                <Image source={{ uri: licenseFront }} style={styles.licensePreview} />
                            ) : (
                                <View style={styles.licensePlaceholder}>
                                    <Text style={{ color: '#999' }}>No front photo</Text>
                                </View>
                            )}
                            <TouchableOpacity style={styles.photoButton} onPress={() => pickImage(setLicenseFront)}>
                                <Text style={styles.photoButtonText}>{licenseFront ? 'Change Front' : 'Upload Front'}</Text>
                            </TouchableOpacity>

                            <Text style={[styles.sublabel, { marginTop: 15 }]}>License Back</Text>
                            {licenseBack ? (
                                <Image source={{ uri: licenseBack }} style={styles.licensePreview} />
                            ) : (
                                <View style={styles.licensePlaceholder}>
                                    <Text style={{ color: '#999' }}>No back photo</Text>
                                </View>
                            )}
                            <TouchableOpacity style={styles.photoButton} onPress={() => pickImage(setLicenseBack)}>
                                <Text style={styles.photoButtonText}>{licenseBack ? 'Change Back' : 'Upload Back'}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ========== SECTION: LOCATION ========== */}
                <View style={styles.divider} />
                <Text style={styles.sectionHeader}>📍 Location</Text>

                <View style={styles.row}>
                    <View style={styles.halfField}>
                        <Text style={styles.label}>13. City</Text>
                        <TextInput style={styles.input} placeholder="e.g. Houston" value={city} onChangeText={setCity} />
                    </View>
                    <View style={styles.halfField}>
                        <Text style={styles.label}>14. State</Text>
                        <TextInput style={styles.input} placeholder="e.g. TX" value={state} onChangeText={setState} />
                    </View>
                </View>

                {/* 15. Preferred Region */}
                <View style={styles.section}>
                    <Text style={styles.label}>15. Preferred Driving Region</Text>
                    <View style={styles.optionContainer}>
                        {['Northeast', 'Southeast', 'Midwest', 'West', 'Nationwide'].map(opt => (
                            <TouchableOpacity key={opt}
                                style={[styles.optionButton, preferredRegion === opt && styles.optionSelected]}
                                onPress={() => setPreferredRegion(opt)}>
                                <Text style={[styles.optionText, preferredRegion === opt && styles.optionTextSelected]}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* 16. Willing to Relocate */}
                <RadioYesNo label="16. Willing to Relocate?" value={willingToRelocate} onChange={setWillingToRelocate} />

                {/* ========== SECTION: EXPERIENCE ========== */}
                <View style={styles.divider} />
                <Text style={styles.sectionHeader}>🚛 Experience Details</Text>

                <View style={styles.section}>
                    <Text style={styles.label}>17. Average Weekly Miles</Text>
                    <TextInput style={styles.input} keyboardType="numeric" placeholder="e.g. 2500"
                        value={weeklyMiles} onChangeText={setWeeklyMiles} />
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>18. Longest OTR Trip</Text>
                    <TextInput style={styles.input} placeholder="e.g. Houston TX to Portland OR (2,300 miles)"
                        value={longestOtr} onChangeText={setLongestOtr} />
                </View>

                <MultiSelect label="19. Trailer Experience" options={['Dry Van', 'Reefer', 'Flatbed', 'Tanker', 'Hazmat']}
                    selected={trailerExperience}
                    onToggle={(v: string) => toggleSelection(trailerExperience, setTrailerExperience, v)} />

                {/* ========== SECTION: SAFETY ========== */}
                <View style={styles.divider} />
                <Text style={styles.sectionHeader}>🛡️ Safety Record (Self-Reported)</Text>

                <View style={styles.row}>
                    <View style={styles.halfField}>
                        <Text style={styles.label}>20. Accidents (3 yrs)</Text>
                        <TextInput style={styles.input} keyboardType="numeric" placeholder="0"
                            value={accidents3y} onChangeText={setAccidents3y} />
                    </View>
                    <View style={styles.halfField}>
                        <Text style={styles.label}>21. Tickets (3 yrs)</Text>
                        <TextInput style={styles.input} keyboardType="numeric" placeholder="0"
                            value={tickets3y} onChangeText={setTickets3y} />
                    </View>
                </View>

                {/* ========== SECTION: PREFERENCES ========== */}
                <View style={styles.divider} />
                <Text style={styles.sectionHeader}>⚙️ Work Preferences</Text>

                <View style={styles.section}>
                    <Text style={styles.label}>22. Home Time Preference</Text>
                    <View style={styles.optionContainer}>
                        {['Weekly', 'Bi-weekly', 'Monthly', 'Flexible'].map(opt => (
                            <TouchableOpacity key={opt}
                                style={[styles.optionButton, homeTime === opt && styles.optionSelected]}
                                onPress={() => setHomeTime(opt)}>
                                <Text style={[styles.optionText, homeTime === opt && styles.optionTextSelected]}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>23. Preferred Freight Type</Text>
                    <TextInput style={styles.input} placeholder="e.g. Dry goods, refrigerated, hazmat"
                        value={preferredFreight} onChangeText={setPreferredFreight} />
                </View>

                {/* ========== SECTION: BIO ========== */}
                <View style={styles.divider} />
                <Text style={styles.sectionHeader}>📝 Professional Summary</Text>

                <View style={styles.section}>
                    <Text style={styles.label}>24. Driver Bio</Text>
                    <Text style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>
                        Short description (max 300 characters). Companies will see this.
                    </Text>
                    <TextInput
                        style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                        multiline
                        maxLength={300}
                        placeholder="e.g. 5 years OTR experience, tanker endorsement, clean driving record."
                        value={driverBio}
                        onChangeText={setDriverBio}
                    />
                    <Text style={{ color: '#999', fontSize: 11, marginTop: 4, textAlign: 'right' }}>
                        {driverBio.length}/300
                    </Text>
                </View>

                {/* Save Button */}
                <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={saving}>
                    <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
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

    sectionHeader: {
        fontSize: 18, fontWeight: '700', color: '#1a202c', marginBottom: 15, marginTop: 5,
        borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 8
    },
    divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 20 },

    section: { marginBottom: 25 },
    label: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#333' },
    sublabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8 },

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

    row: { flexDirection: 'row', gap: 12, marginBottom: 10 },
    halfField: { flex: 1 },

    // Photo styles
    photoPreview: { width: 120, height: 120, borderRadius: 60, alignSelf: 'center', marginBottom: 10, borderWidth: 2, borderColor: '#e2e8f0' },
    photoPlaceholder: {
        width: 120, height: 120, borderRadius: 60, alignSelf: 'center', marginBottom: 10,
        backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0'
    },
    licensePreview: { width: '100%', height: 180, borderRadius: 8, marginBottom: 10, resizeMode: 'cover' },
    licensePlaceholder: {
        width: '100%', height: 100, borderRadius: 8, marginBottom: 10,
        backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0'
    },
    photoButton: {
        backgroundColor: '#4a5568', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8,
        alignSelf: 'center', marginBottom: 5
    },
    photoButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },

    // Consent
    consentRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, paddingRight: 10 },
    checkbox: {
        width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: '#cbd5e0',
        marginRight: 12, justifyContent: 'center', alignItems: 'center', marginTop: 2
    },
    checkboxChecked: { backgroundColor: '#38a169', borderColor: '#38a169' },
    consentText: { flex: 1, color: '#4a5568', fontSize: 13, lineHeight: 18 },

    saveButton: {
        backgroundColor: '#000', paddingVertical: 18, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 40,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 6
    },
    saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
