import React, {useState, useRef, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
  Keyboard,
} from 'react-native';
import {colors, typography, spacing, borderRadius, shadows} from '../theme';
import {SearchSuggestion} from '../types';
import {searchPlaces, retrievePlace} from '../utils/mapbox';
import {Coordinate} from '../types';
import {SEARCH_DEBOUNCE_MS} from '../constants';

interface AutocompleteInputProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectPlace: (coordinate: Coordinate, name: string) => void;
  onUseCurrentLocation?: () => void;
  showCurrentLocationButton?: boolean;
  proximity?: Coordinate | null;
  icon: string;
  iconColor: string;
  autoFocus?: boolean;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  placeholder,
  value,
  onChangeText,
  onSelectPlace,
  onUseCurrentLocation,
  showCurrentLocationButton = false,
  proximity,
  icon,
  iconColor,
  autoFocus = false,
}) => {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef<string>(generateSessionToken());
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  const animateDropdown = useCallback(
    (show: boolean) => {
      Animated.spring(dropdownAnim, {
        toValue: show ? 1 : 0,
        useNativeDriver: true,
        tension: 100,
        friction: 12,
      }).start();
      setShowDropdown(show);
    },
    [dropdownAnim],
  );

  const handleSearch = useCallback(
    (query: string) => {
      onChangeText(query);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!query || query.trim().length < 2) {
        setSuggestions([]);
        animateDropdown(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        const results = await searchPlaces(
          query,
          proximity || undefined,
          sessionTokenRef.current,
        );
        setSuggestions(results);
        animateDropdown(results.length > 0);
        setLoading(false);
      }, SEARCH_DEBOUNCE_MS);
    },
    [onChangeText, proximity, animateDropdown],
  );

  const handleSelectSuggestion = useCallback(
    async (suggestion: SearchSuggestion) => {
      setLoading(true);
      Keyboard.dismiss();

      const placeDetail = await retrievePlace(
        suggestion.mapbox_id,
        sessionTokenRef.current,
      );

      if (placeDetail) {
        onChangeText(suggestion.name);
        onSelectPlace(placeDetail.coordinate, suggestion.name);
      }

      setSuggestions([]);
      animateDropdown(false);
      setLoading(false);

      // Generate a new session token for next search
      sessionTokenRef.current = generateSessionToken();
    },
    [onChangeText, onSelectPlace, animateDropdown],
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (suggestions.length > 0) {
      animateDropdown(true);
    }
  }, [suggestions, animateDropdown]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Delay hiding to allow tap on suggestion
    setTimeout(() => {
      animateDropdown(false);
    }, 200);
  }, [animateDropdown]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const renderSuggestionItem = ({item}: {item: SearchSuggestion}) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSelectSuggestion(item)}
      activeOpacity={0.7}>
      <View style={styles.suggestionIcon}>
        <Text style={styles.suggestionIconText}>📍</Text>
      </View>
      <View style={styles.suggestionText}>
        <Text style={styles.suggestionName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.full_address ? (
          <Text style={styles.suggestionAddress} numberOfLines={1}>
            {item.full_address}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputRow,
          isFocused && styles.inputRowFocused,
        ]}>
        <View style={[styles.iconDot, {backgroundColor: iconColor}]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.inputPlaceholder}
          value={value}
          onChangeText={handleSearch}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {showCurrentLocationButton && onUseCurrentLocation && (
          <TouchableOpacity
            style={styles.currentLocButton}
            onPress={() => {
              onUseCurrentLocation();
              setSuggestions([]);
              animateDropdown(false);
            }}
            activeOpacity={0.7}>
            <Text style={styles.currentLocIcon}>⊕</Text>
          </TouchableOpacity>
        )}
        {loading && (
          <View style={styles.loadingDot}>
            <View style={styles.loadingDotInner} />
          </View>
        )}
      </View>

      {showDropdown && suggestions.length > 0 && (
        <Animated.View
          style={[
            styles.dropdown,
            {
              opacity: dropdownAnim,
              transform: [
                {
                  translateY: dropdownAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-8, 0],
                  }),
                },
              ],
            },
          ]}>
          <FlatList
            data={suggestions}
            renderItem={renderSuggestionItem}
            keyExtractor={item => item.mapbox_id}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
          />
        </Animated.View>
      )}
    </View>
  );
};

function generateSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const styles = StyleSheet.create({
  container: {
    zIndex: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  inputRowFocused: {
    borderColor: colors.borderFocused,
  },
  iconDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  iconText: {
    fontSize: 10,
    color: colors.textPrimary,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
    paddingVertical: 0,
  },
  currentLocButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(74, 144, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  currentLocIcon: {
    fontSize: 18,
    color: colors.primary,
  },
  loadingDot: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  loadingDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  dropdown: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(74, 144, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  suggestionIconText: {
    fontSize: 14,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  suggestionAddress: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
});

export default AutocompleteInput;
