import { useEffect, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getCurrentUser } from '../services/authService';
import { useNotificationListener } from '../hooks/useNotificationListener';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Import des écrans
import HomePage from '../screens/HomePage';
import FeedScreen from '../screens/FeedScreen';
import PostScreen from '../screens/PostScreen';
import OptionScreen from '../screens/OptionScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

// Composant de bulle animée qui suit l'onglet sélectionné
function AnimatedBubble({ activeIndex, totalTabs }) {
  // Largeur effective de la navbar (en tenant compte des marges left: 5 et right: 5)
  const NAVBAR_WIDTH = SCREEN_WIDTH - 10;

  // Initialiser avec la position de l'onglet actif
  const tabWidth = NAVBAR_WIDTH / totalTabs;
  const initialPosition = activeIndex * tabWidth + tabWidth / 2;

  const bubblePosition = useRef(new Animated.Value(initialPosition)).current;

  useEffect(() => {
    // Calculer la position X de la bulle en fonction de l'index actif
    const tabWidth = NAVBAR_WIDTH / totalTabs;
    const targetPosition = activeIndex * tabWidth + tabWidth / 2;

    // Animation de déplacement uniquement
    Animated.spring(bubblePosition, {
      toValue: targetPosition,
      friction: 7,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, totalTabs]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        bubbleStyles.bubble,
        {
          transform: [
            { translateX: bubblePosition },
            { translateY: 0 },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={['#C9F2DF', '#8DE4C0', '#5DD6A0']}
        style={bubbleStyles.bubbleGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
}

const bubbleStyles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: 75,
    height: 60,
    borderRadius: 30,
    marginLeft: -37.5, // Centrer la bulle (largeur / 2)
    top: 10,
    zIndex: 0,
    // Ombre pour effet de profondeur
    shadowColor: '#C9F2DF',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 12,
  },
  bubbleGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    opacity: 0.85,
  },
});

// Composant de tab bar personnalisé avec effet liquid glass
function CustomTabBar({ state, descriptors, navigation }) {
  const glassSupported = isLiquidGlassAvailable();

  return (
    <View style={tabBarStyles.glassContainer}>
      <GlassView
        glassEffectStyle="clear"
        isInteractive={true}
        tintColor="rgba(37, 37, 37, 0.6)"
        style={[
          tabBarStyles.glassView,
          !glassSupported && tabBarStyles.fallbackStyle
        ]}
      >
        {/* Bordure lumineuse supérieure pour l'effet de verre */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.05)', 'transparent']}
          style={tabBarStyles.topBorder}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        {/* Overlay de dégradé pour l'effet liquid */}
        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(255, 255, 255, 0.1)',
            'rgba(255, 255, 255, 0.05)',
            'transparent'
          ]}
          style={tabBarStyles.gradientOverlay}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        <View style={tabBarStyles.tabBarContent}>
          {/* Bulle animée qui suit l'onglet actif */}
          <AnimatedBubble activeIndex={state.index} totalTabs={state.routes.length} />

          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label =
              options.tabBarLabel !== undefined
                ? options.tabBarLabel
                : options.title !== undefined
                ? options.title
                : route.name;

            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            // Icônes
            let iconName;
            if (route.name === 'Home') {
              iconName = 'home';
            } else if (route.name === 'Feed') {
              iconName = 'list';
            } else if (route.name === 'Post') {
              iconName = 'add-circle';
            } else if (route.name === 'Option') {
              iconName = 'settings';
            } else if (route.name === 'Profile') {
              iconName = 'person';
            }

            const color = isFocused ? '#000000' : '#FFFFFF';

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={tabBarStyles.tabButton}
                hitSlop={{ top: 100, bottom: 15, left: 10, right: 10 }}
              >
                <Ionicons name={iconName} size={26} color={color} />
                <Text style={[tabBarStyles.tabLabel, { color }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </GlassView>
    </View>
  );
}

const tabBarStyles = StyleSheet.create({
  glassContainer: {
    position: 'absolute',
    bottom: 10,
    left: 5,
    right: 5,
    borderTopLeftRadius: 55,
    borderTopRightRadius: 55,
    borderBottomLeftRadius: 55,
    borderBottomRightRadius: 55,
    overflow: 'hidden',
    // Ombre pour effet de profondeur
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  glassView: {
    flex: 1,
    borderRadius: 45,
    overflow: 'hidden',
  },
  fallbackStyle: {
    backgroundColor: 'rgba(37, 37, 37, 0.8)',
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    zIndex: 10,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    zIndex: 1,
  },
  tabBarContent: {
    flexDirection: 'row',
    height: 80,
    paddingBottom: 10,
    paddingTop: 10,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    zIndex: 2,
  },
  tabLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 11,
    marginTop: 4,
  },
});

export default function TabNavigator() {
  const { theme, fontSize } = useTheme();
  const currentUser = getCurrentUser();

  // Activer l'écoute des notifications
  useNotificationListener(currentUser);

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomePage}
        options={{
          title: 'Accueil',
        }}
      />
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          title: 'Feed',
        }}
      />
      <Tab.Screen
        name="Post"
        component={PostScreen}
        options={{
          title: 'Publier',
        }}
      />
      <Tab.Screen
        name="Option"
        component={OptionScreen}
        options={{
          title: 'Options',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profil',
        }}
      />
    </Tab.Navigator>
  );
}
