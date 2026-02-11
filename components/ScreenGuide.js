import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useScreenGuide } from '../context/ScreenGuideContext';
import { getGuideForScreen } from '../config/screenGuideConfig';

export default function ScreenGuide({ screenName }) {
  const { theme, fontSize } = useTheme();
  const { shouldShowGuide, markScreenVisited, disableAllGuides, isLoading } =
    useScreenGuide();
  const [visible, setVisible] = useState(false);
  const [screenFocused, setScreenFocused] = useState(false);

  // Ref pour toujours avoir la dernière version de shouldShowGuide
  // sans re-déclencher le useEffect quand sa référence change
  const shouldShowGuideRef = useRef(shouldShowGuide);
  shouldShowGuideRef.current = shouldShowGuide;

  const guide = getGuideForScreen(screenName);

  // Tracker le focus/blur de l'écran (deps vides = cleanup uniquement sur blur réel)
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => {
        setScreenFocused(false);
        setVisible(false);
      };
    }, [])
  );

  // Afficher le guide quand l'écran gagne le focus ou que le chargement se termine
  // shouldShowGuide est lu via ref pour ne pas re-déclencher l'effet lors d'un reset
  useEffect(() => {
    if (screenFocused && !isLoading && shouldShowGuideRef.current(screenName)) {
      setVisible(true);
    }
  }, [screenFocused, isLoading, screenName]);

  if (!guide || !visible) return null;

  const handleDismiss = async () => {
    setVisible(false);
    await markScreenVisited(screenName);
  };

  const handleSkipAll = async () => {
    setVisible(false);
    await disableAllGuides();
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.colors.navbar },
          ]}
        >
          {/* Icône */}
          <View style={styles.iconCircle}>
            <Ionicons name={guide.icon} size={28} color="#fff" />
          </View>

          {/* Titre */}
          <Text
            style={[
              styles.title,
              {
                color: theme.colors.text,
                fontSize: fontSize.sizes.subtitle,
              },
            ]}
          >
            {guide.title}
          </Text>

          {/* Message */}
          <Text
            style={[
              styles.message,
              {
                color: theme.colors.textSecondary,
                fontSize: fontSize.sizes.body,
              },
            ]}
          >
            {guide.message}
          </Text>

          {/* Bouton Compris */}
          <TouchableOpacity style={styles.primaryButton} onPress={handleDismiss}>
            <Text style={[styles.primaryButtonText, { fontSize: fontSize.sizes.body }]}>
              Compris !
            </Text>
          </TouchableOpacity>

          {/* Lien Passer le tutoriel */}
          <TouchableOpacity style={styles.skipButton} onPress={handleSkipAll}>
            <Text
              style={[
                styles.skipButtonText,
                {
                  color: theme.colors.textSecondary,
                  fontSize: fontSize.sizes.small,
                },
              ]}
            >
              Passer le tutoriel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Fredoka_600SemiBold',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Fredoka_400Regular',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: 'Fredoka_600SemiBold',
  },
  skipButton: {
    marginTop: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    fontFamily: 'Fredoka_400Regular',
    textDecorationLine: 'underline',
  },
});
