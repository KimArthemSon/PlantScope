// screens/MapScreen.js
import React from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location'; // or use @react-native-community/geolocation

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE} // ✅ OpenStreetMap: Free, no API key required
        style={styles.map}
        initialRegion={{
          latitude: 11.0064,    // 🌴 Ormoc City, Leyte, Philippines
          longitude: 124.6075,
          latitudeDelta: 0.15,  // Zoom level: ~15km x 15km view
          longitudeDelta: 0.15,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        zoomControlEnabled={Platform.OS === 'android'}
        // Optional: Handle region changes for offline caching later
        // onRegionChangeComplete={(region) => console.log(region)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});