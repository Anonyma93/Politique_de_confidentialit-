/**
 * Composant d'icône métro animée pour le pull-to-refresh
 * Utilise Animated de React Native pour les animations
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AnimatedMetroRefresh = ({ refreshing, theme }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (refreshing) {
      // Animation de rotation continue
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );

      // Animation de scale pulsé
      const scaleAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );

      rotateAnimation.start();
      scaleAnimation.start();

      return () => {
        rotateAnimation.stop();
        scaleAnimation.stop();
      };
    } else {
      // Reset des animations
      rotateAnim.setValue(0);
      scaleAnim.setValue(1);
    }
  }, [refreshing, rotateAnim, scaleAnim]);

  // Interpolation de la rotation (0 -> 360 degrés)
  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!refreshing) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [
              { rotate: rotation },
              { scale: scaleAnim },
            ],
            opacity: opacityAnim,
          },
        ]}
      >
        <Ionicons
          name="subway"
          size={40}
          color={theme?.colors?.iconActive || '#007AFF'}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AnimatedMetroRefresh;
