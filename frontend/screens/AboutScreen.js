import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, Linking, TouchableOpacity } from 'react-native';
import { ExternalLink } from 'lucide-react-native';

export default function AboutScreen() {
  const openPortfolio = () => {
    // Opens your personal website portfolio seamlessly in a new browser tab
    Linking.openURL('https://josephdinye.tech').catch((err) => 
      console.error("Could not load portfolio track:", err)
    );
  };

  return (
    <SafeAreaView style={styles.tabCanvas}>
      <View style={styles.pageHeaderWrapper}>
        <Text style={styles.pageTitle}>About App</Text>
        <Text style={styles.pageSubtitle}>System information & developer credits</Text>
      </View>
      
      <View style={styles.contentCard}>
        <Text style={styles.infoLabel}>App Name:</Text>
        <Text style={styles.infoValue}>Joseph fastVPN</Text>
        
        <View style={styles.dividerLine} />
        
        <Text style={styles.infoLabel}>Developer Info:</Text>
        <Text style={styles.infoValue}>Joseph Dinye</Text>
        
        <View style={styles.dividerLine} />
        
        {/* INTERACTIVE CLICKABLE PORTFOLIO LINK ITEM */}
        <Text style={styles.infoLabel}>Official Website Portfolio:</Text>
        <TouchableOpacity style={styles.linkWrapperRow} onPress={openPortfolio}>
          <Text style={styles.linkText}>josephdinye.tech</Text>
          <ExternalLink size={14} color="#007AFF" />
        </TouchableOpacity>
        
        <View style={styles.dividerLine} />
        
        <Text style={styles.infoLabel}>Core Build Version:</Text>
        <Text style={styles.infoValue}>v1.0.0 (Release-Ready)</Text>
        
        <View style={styles.dividerLine} />
        
        <Text style={styles.infoLabel}>Routing Engine Protocol:</Text>
        <Text style={styles.infoValue}>VLESS Universal Whitelist Matrix</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabCanvas: { flex: 1, backgroundColor: '#070C14', paddingBottom: 10 },
  pageHeaderWrapper: { paddingHorizontal: 24, paddingTop: 25, marginTop: 25, marginBottom: 15 },
  pageTitle: { color: '#FFF', fontSize: 24, fontWeight: '700' },
  pageSubtitle: { color: '#687690', fontSize: 13, marginTop: 4 },
  contentCard: { backgroundColor: '#111A2E', marginHorizontal: 20, padding: 20, borderRadius: 16 },
  infoLabel: { color: '#4A5568', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  infoValue: { color: '#FFF', fontSize: 15, fontWeight: '500', marginTop: 4 },
  linkWrapperRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  linkText: { color: '#007AFF', fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  dividerLine: { height: 1, backgroundColor: '#1E293B', marginVertical: 14 }
});
