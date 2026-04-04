import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { register } from '../api/client';

export default function RegisterScreen() {
    const navigation = useNavigation<any>();

    const [loading, setLoading] = useState(false);

    // Form State
    const [type, setType] = useState<'driver' | 'empresa'>('driver');
    const [nombre, setNombre] = useState('');
    const [contacto, setContacto] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    // Driver extra
    const [phone, setPhone] = useState('');
    const [licencia, setLicencia] = useState('B'); // Default B
    // Company extra
    const [legalName, setLegalName] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    // Legal Acceptance states
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptPrivacy, setAcceptPrivacy] = useState(false);

    const handleRegister = async () => {
        if (!nombre || !contacto || !password || !confirmPassword) {
            Alert.alert('Error', 'Please fill all required fields');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (!acceptTerms || !acceptPrivacy) {
            Alert.alert('Error', 'Debes aceptar los Términos de Servicio y la Política de Privacidad para continuar.');
            return;
        }

        const payload: any = {
            type,
            nombre,
            contacto,
            password,
            accept_terms: true, // Backend checks for true
            accept_privacy: true
        };

        if (type === 'driver') {
            if (!phone) {
                Alert.alert('Error', 'Please enter your phone number');
                return;
            }
            payload.tipo_licencia = licencia;
            payload.phone = phone;
        } else {
            // Company fields
            if (!legalName || !address || !city || !contactPerson) {
                Alert.alert('Error', 'Please complete company details');
                return;
            }
            payload.legal_name = legalName;
            payload.address_line1 = address;
            payload.address_city = city;
            payload.contact_person = contactPerson;
            payload.contact_phone = contactPhone || contacto; // Fallback to login ID
        }

        setLoading(true);
        try {
            const res = await register(payload);

            if (!res.ok) {
                throw new Error(res.error || 'Registration failed on server');
            }

            Alert.alert(
                'Success',
                'Account created. Please verify your email before logging in.',
                [
                    {
                        text: 'Continue',
                        onPress: () =>
                            navigation.navigate('VerifyEmail', {
                                email: contacto.trim().toLowerCase(),
                                type,
                            }),
                    },
                ]
            );

        } catch (error: any) {
            Alert.alert('Registration Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Create Account</Text>

            <View style={styles.typeContainer}>
                <TouchableOpacity
                    style={[styles.typeButton, type === 'driver' && styles.typeButtonActive]}
                    onPress={() => setType('driver')}>
                    <Text style={[styles.typeText, type === 'driver' && styles.typeTextActive]}>Driver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.typeButton, type === 'empresa' && styles.typeButtonActive]}
                    onPress={() => setType('empresa')}>
                    <Text style={[styles.typeText, type === 'empresa' && styles.typeTextActive]}>Company</Text>
                </TouchableOpacity>
            </View>

            <TextInput
                style={styles.input}
                placeholder="Full Name (Public Display)"
                value={nombre}
                onChangeText={setNombre}
            />
            <TextInput
                style={styles.input}
                placeholder="Email / Phone (Login ID)"
                value={contacto}
                onChangeText={setContacto}
                autoCapitalize="none"
            />
            <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
            />

            {type === 'driver' ? (
                <View style={styles.section}>
                    <TextInput style={styles.input} placeholder="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                    <Text style={styles.label}>License Type:</Text>
                    <View style={styles.row}>
                        {['A', 'B', 'C'].map(l => (
                            <TouchableOpacity
                                key={l}
                                style={[styles.optionChip, licencia === l && styles.optionChipActive]}
                                onPress={() => setLicencia(l)}>
                                <Text style={[styles.optionText, licencia === l && styles.optionTextActive]}>{l}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ) : (
                <View style={styles.section}>
                    <Text style={styles.label}>Company Details:</Text>
                    <TextInput style={styles.input} placeholder="Legal Name" value={legalName} onChangeText={setLegalName} />
                    <TextInput style={styles.input} placeholder="Address Line 1" value={address} onChangeText={setAddress} />
                    <TextInput style={styles.input} placeholder="City" value={city} onChangeText={setCity} />
                    <TextInput style={styles.input} placeholder="Contact Person Name" value={contactPerson} onChangeText={setContactPerson} />
                    <TextInput style={styles.input} placeholder="Company Contact Phone (Optional)" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
                </View>
            )}

            <View style={styles.legalSection}>
                <TouchableOpacity 
                    style={styles.legalItem} 
                    onPress={() => setAcceptTerms(!acceptTerms)}
                >
                    <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}>
                        {acceptTerms && <Text style={styles.checkboxTick}>✓</Text>}
                    </View>
                    <Text style={styles.legalText}>Acepto los Términos de Servicio</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.legalItem} 
                    onPress={() => setAcceptPrivacy(!acceptPrivacy)}
                >
                    <View style={[styles.checkbox, acceptPrivacy && styles.checkboxChecked]}>
                        {acceptPrivacy && <Text style={styles.checkboxTick}>✓</Text>}
                    </View>
                    <Text style={styles.legalText}>Acepto la Política de Privacidad</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#007BFF" style={{ marginTop: 20 }} />
            ) : (
                <TouchableOpacity style={styles.button} onPress={handleRegister}>
                    <Text style={styles.buttonText}>REGISTER</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.linkText}>Already have an account? Login</Text>
            </TouchableOpacity>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#f8f9fa',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 30,
        textAlign: 'center',
        color: '#333',
    },
    typeContainer: {
        flexDirection: 'row',
        marginBottom: 20,
        backgroundColor: '#e9ecef',
        borderRadius: 8,
        padding: 4,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 6,
    },
    typeButtonActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 2,
    },
    typeText: {
        fontWeight: '600',
        color: '#6c757d',
    },
    typeTextActive: {
        color: '#007BFF',
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ced4da',
        padding: 15,
        marginBottom: 15,
        borderRadius: 8,
        fontSize: 16,
    },
    section: {
        marginBottom: 20,
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    label: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#495057',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    optionChip: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#ced4da',
        backgroundColor: '#fff',
    },
    optionChipActive: {
        borderColor: '#007BFF',
        backgroundColor: '#007BFF',
    },
    optionText: {
        color: '#495057',
    },
    optionTextActive: {
        color: '#fff',
        fontWeight: 'bold',
    },
    button: {
        backgroundColor: '#007BFF',
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#007BFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    linkButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    linkText: {
        color: '#007BFF',
        fontSize: 14,
    },
    legalSection: {
        marginVertical: 15,
        paddingHorizontal: 5,
    },
    legalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderWidth: 2,
        borderColor: '#007BFF',
        borderRadius: 4,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    checkboxChecked: {
        backgroundColor: '#007BFF',
    },
    checkboxTick: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    legalText: {
        fontSize: 14,
        color: '#495057',
    },
});
