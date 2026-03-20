import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { setupApi } from '../../src/services/api';

const ADMIN_PASSWORD = 'eligesoft';

interface SetupStatus {
  database: string;
  collections: Record<string, number>;
  issues: { missing_initialPortions: number };
  status: string;
}

export default function SetupScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(true);
  const [password, setPassword] = useState('');
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSetupLoading, setIsSetupLoading] = useState(false);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setShowPasswordModal(false);
      setPassword('');
      checkSetupStatus();
    } else {
      Alert.alert('Errore', 'Password non corretta');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setShowPasswordModal(true);
    setSetupStatus(null);
  };

  const checkSetupStatus = async () => {
    try {
      setIsLoading(true);
      const status = await setupApi.getStatus();
      setSetupStatus(status);
    } catch (error) {
      console.error('Error checking setup status:', error);
      Alert.alert('Errore', 'Impossibile verificare lo stato del database');
    } finally {
      setIsLoading(false);
    }
  };

  const runSetup = async () => {
    setIsSetupLoading(true);
    try {
      const result = await setupApi.runSetup();
      Alert.alert(
        'Setup Completato!',
        `Categorie aggiunte: ${result.categories_added}\nMenu aggiornati: ${result.menus_updated}`,
        [{ text: 'OK', onPress: checkSetupStatus }]
      );
    } catch (error) {
      console.error('Error running setup:', error);
      Alert.alert('Errore', 'Impossibile eseguire il setup del database');
    } finally {
      setIsSetupLoading(false);
    }
  };

  // Se non autenticato, mostra solo la modale
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <Modal
          visible={showPasswordModal}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="lock-closed" size={40} color="#e94560" />
                <Text style={styles.modalTitle}>Area Riservata</Text>
                <Text style={styles.modalSubtitle}>
                  Inserisci la password per accedere alle impostazioni
                </Text>
              </View>

              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor="#8892b0"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
                autoFocus
              />

              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
              >
                <Text style={styles.loginButtonText}>Accedi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Sfondo con messaggio */}
        <View style={styles.lockedContainer}>
          <Ionicons name="lock-closed-outline" size={80} color="#8892b0" />
          <Text style={styles.lockedText}>Area Amministratore</Text>
          <Text style={styles.lockedSubtext}>Inserisci la password per continuare</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Se autenticato, mostra il pannello admin
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Impostazioni Admin</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#e94560" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Status Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Stato Database</Text>
            <TouchableOpacity 
              style={styles.refreshButton} 
              onPress={checkSetupStatus}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#e94560" />
              ) : (
                <Ionicons name="refresh" size={20} color="#e94560" />
              )}
            </TouchableOpacity>
          </View>

          {setupStatus ? (
            <View style={styles.statusContainer}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Database:</Text>
                <Text style={styles.statusValue}>{setupStatus.database}</Text>
              </View>
              
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Stato:</Text>
                <View style={[
                  styles.statusBadge,
                  setupStatus.status === 'ok' ? styles.statusOk : styles.statusWarning
                ]}>
                  <Text style={styles.statusBadgeText}>
                    {setupStatus.status === 'ok' ? 'OK' : 'Setup Necessario'}
                  </Text>
                </View>
              </View>

              {/* Collections count */}
              <View style={styles.collectionsContainer}>
                <Text style={styles.collectionsTitle}>Collezioni:</Text>
                {Object.entries(setupStatus.collections).map(([name, count]) => (
                  <View key={name} style={styles.collectionRow}>
                    <Text style={styles.collectionName}>{name}</Text>
                    <Text style={styles.collectionCount}>{count} documenti</Text>
                  </View>
                ))}
              </View>

              {setupStatus.issues.missing_initialPortions > 0 && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={20} color="#f39c12" />
                  <Text style={styles.warningText}>
                    {setupStatus.issues.missing_initialPortions} piatti senza porzioni iniziali
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#e94560" />
              <Text style={styles.loadingText}>Caricamento stato...</Text>
            </View>
          )}
        </View>

        {/* Setup Action Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Azioni</Text>
          
          <TouchableOpacity
            style={[styles.setupButton, isSetupLoading && styles.setupButtonDisabled]}
            onPress={runSetup}
            disabled={isSetupLoading}
          >
            {isSetupLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="build" size={22} color="#fff" />
                <Text style={styles.setupButtonText}>Esegui Setup Database</Text>
              </>
            )}
          </TouchableOpacity>
          
          <Text style={styles.setupHint}>
            Questo comando sincronizza categorie e campi mancanti nel database.
            Eseguilo dopo ogni aggiornamento dell'app.
          </Text>
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informazioni</Text>
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Ionicons name="information-circle" size={20} color="#3498db" />
              <Text style={styles.infoText}>
                Il setup aggiunge le categorie predefinite e corregge eventuali 
                dati mancanti come le porzioni iniziali dei piatti.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  refreshButton: {
    padding: 8,
  },
  statusContainer: {
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    color: '#8892b0',
    fontSize: 15,
  },
  statusValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusOk: {
    backgroundColor: '#27ae60',
  },
  statusWarning: {
    backgroundColor: '#f39c12',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  collectionsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
  },
  collectionsTitle: {
    color: '#8892b0',
    fontSize: 14,
    marginBottom: 8,
  },
  collectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  collectionName: {
    color: '#fff',
    fontSize: 14,
  },
  collectionCount: {
    color: '#8892b0',
    fontSize: 14,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 156, 18, 0.15)',
    padding: 12,
    borderRadius: 10,
    gap: 10,
    marginTop: 8,
  },
  warningText: {
    color: '#f39c12',
    fontSize: 14,
    flex: 1,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 12,
  },
  loadingText: {
    color: '#8892b0',
    fontSize: 14,
  },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  setupButtonDisabled: {
    opacity: 0.6,
  },
  setupButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  setupHint: {
    color: '#8892b0',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  infoContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 14,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    color: '#8892b0',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8892b0',
    textAlign: 'center',
    marginTop: 8,
  },
  passwordInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: '#e94560',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Locked state
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  lockedText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },
  lockedSubtext: {
    color: '#8892b0',
    fontSize: 15,
  },
});
