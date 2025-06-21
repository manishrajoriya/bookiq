import axios from 'axios';
import * as DocumentPicker from 'expo-document-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';

const PdfUpload = () => {
    const [file, setFile] = useState<{ uri: string; name: string } | null>(null);
    const [extractedText, setExtractedText] = useState('');
    const [numPages, setNumPages] = useState<number | null>(null);
    const [info, setInfo] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const pickDocument = async () => {
        setExtractedText('');
        setError('');
        setNumPages(null);
        setInfo(null);
        let result = await DocumentPicker.getDocumentAsync({
            type: 'application/pdf',
            copyToCacheDirectory: true,
            multiple: false,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            setFile({ uri: asset.uri, name: asset.name || 'file.pdf' });
            uploadPdf(asset.uri, asset.name || 'file.pdf');
        } else {
            setFile(null);
        }
    };

    const uploadPdf = async (uri: string, name: string) => {
        setLoading(true);
        setError('');
        setExtractedText('');
        setNumPages(null);
        setInfo(null);
        try {
            const formData = new FormData();
            formData.append('pdf', {
                uri,
                name,
                type: 'application/pdf',
            } as any);
            const response = await axios.post('http://192.168.75.30:3000/api/extract-pdf', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            setExtractedText(response.data.text || 'No text found.');
            setNumPages(response.data.numPages || null);
            setInfo(response.data.info || null);
        } catch (err: any) {
            setError('Failed to extract text.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Button title="Upload PDF" onPress={pickDocument} />
            {loading && <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />}
            {error ? <Text style={{ color: 'red', marginTop: 20 }}>{error}</Text> : null}
            {file && !loading && !error && (
                <View style={styles.infoBox}>
                    <Text>Selected File: {file.name}</Text>
                    <Text style={styles.extractedTextLabel}>Extracted Text:</Text>
                    <Text style={styles.extractedText}>{extractedText}</Text>
                    {numPages !== null && <Text style={{ marginTop: 10 }}>Pages: {numPages}</Text>}
                    {info && <Text style={{ marginTop: 10 }}>PDF Info: {JSON.stringify(info)}</Text>}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    infoBox: {
        marginTop: 20,
        width: '100%',
        backgroundColor: '#f0f0f0',
        padding: 16,
        borderRadius: 8,
    },
    extractedTextLabel: {
        marginTop: 10,
        fontWeight: 'bold',
    },
    extractedText: {
        marginTop: 5,
        color: '#333',
    },
})

export default PdfUpload;
