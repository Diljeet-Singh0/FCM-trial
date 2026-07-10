import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, FlatList, StyleSheet, PermissionsAndroid, ActivityIndicator, Alert, Keyboard } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

import { MAPBOX_ACCESS_TOKEN } from '../secrets';

type Props = {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  dotColor: string;
  showLocationButton?: boolean;
  onPickFromMap?: () => void;
};

type Suggestion = {
  id: string;
  place_name: string;
};

const AddressInput = ({ placeholder, value, onChangeText, dotColor, showLocationButton, onPickFromMap }: Props) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    try {
      setIsSearching(true);
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=address,poi&country=in&limit=5`);
      const data = await res.json();
      if (data.features) {
        setSuggestions(data.features.map((f: any) => ({ id: f.id, place_name: f.place_name })));
        setShowDropdown(true);
      }
    } catch (err) {
      console.warn('Error fetching suggestions', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleChangeText = (text: string) => {
    onChangeText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(text);
    }, 500);
  };

  const handleSelect = (place_name: string) => {
    onChangeText(place_name);
    setSuggestions([]);
    setShowDropdown(false);
    Keyboard.dismiss();
  };

  const getLiveLocation = async () => {
    try {
      setIsFetchingLocation(true);
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', 'Location permission is required to fetch your address.');
        setIsFetchingLocation(false);
        return;
      }
      Geolocation.getCurrentPosition(
        async (position) => {
          try {
            const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${position.coords.longitude},${position.coords.latitude}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=address,poi&limit=1`);
            const data = await response.json();
            if (data.features && data.features.length > 0) {
              onChangeText(data.features[0].place_name);
            } else {
              onChangeText(`${position.coords.latitude}, ${position.coords.longitude}`);
            }
          } catch (error) {
            onChangeText(`${position.coords.latitude}, ${position.coords.longitude}`);
          } finally {
            setIsFetchingLocation(false);
          }
        },
        (error) => {
          Alert.alert('Error', 'Could not get your location: ' + error.message);
          setIsFetchingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } catch (err) {
      console.warn(err);
      setIsFetchingLocation(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <View style={[styles.dot, { backgroundColor: dotColor, borderColor: dotColor === '#22C55E' ? '#BBF7D0' : 'transparent', borderWidth: dotColor === '#22C55E' ? 2 : 0 }]} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
        />
        {isSearching && <ActivityIndicator size="small" color="#10B981" style={{ marginRight: 10 }} />}
      </View>
      
      {(showLocationButton || onPickFromMap) && (
        <View style={styles.locationBtnRow}>
          {showLocationButton && (
            <TouchableOpacity style={styles.gpsBtn} onPress={getLiveLocation} disabled={isFetchingLocation}>
              {isFetchingLocation ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#10B981" style={{ marginRight: 6 }} />
                  <Text style={styles.gpsBtnText}>Fetching...</Text>
                </View>
              ) : (
                <Text style={styles.gpsBtnText}>📍 Current Location</Text>
              )}
            </TouchableOpacity>
          )}
          {onPickFromMap && (
            <TouchableOpacity style={styles.mapPickBtn} onPress={onPickFromMap}>
              <Text style={styles.mapPickBtnText}>📌 Pick on Map</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {showDropdown && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((item) => (
            <TouchableOpacity key={item.id} style={styles.suggestionItem} onPress={() => handleSelect(item.place_name)}>
              <Text style={styles.suggestionText} numberOfLines={2}>{item.place_name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
    zIndex: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    paddingVertical: 12,
    marginLeft: 12,
  },
  locationBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  gpsBtn: {
    backgroundColor: '#E6F7F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  gpsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  mapPickBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  mapPickBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  dropdown: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    maxHeight: 200,
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  suggestionItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  suggestionText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
});

export default AddressInput;

