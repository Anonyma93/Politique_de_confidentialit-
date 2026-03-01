import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Switch,
  Image,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme, fontSizes } from '../context/ThemeContext';
import { useScreenGuide } from '../context/ScreenGuideContext';
import ScreenGuide from '../components/ScreenGuide';
import { logout, changePassword, deleteAccount, getCurrentUser } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { requestNotificationPermissions } from '../services/notificationService';
import { LinearGradient } from 'expo-linear-gradient';
import { activatePremiumForUser, deactivatePremiumForUser } from '../utils/activatePremiumDev';
import PremiumBadge from '../components/PremiumBadge';
import { usePremium } from '../context/PremiumContext';

const DRUM_ITEM_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DRUM_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const DrumPicker = ({ items, value, onChange, theme, cardBackground, formatItem }) => {
  const scrollRef = useRef(null);
  const currentIndex = items.indexOf(value);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: safeIndex * DRUM_ITEM_HEIGHT, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleMomentumScrollEnd = (event) => {
    const y = event.nativeEvent.contentOffset.y;
    const idx = Math.round(y / DRUM_ITEM_HEIGHT);
    onChange(items[Math.max(0, Math.min(items.length - 1, idx))]);
  };

  return (
    <View style={{ flex: 1, height: DRUM_ITEM_HEIGHT * 5, position: 'relative', overflow: 'hidden' }}>

      {/* 1. Highlight fixe — rendu EN PREMIER = derrière le ScrollView */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: DRUM_ITEM_HEIGHT * 2,
          left: 4,
          right: 4,
          height: DRUM_ITEM_HEIGHT,
          backgroundColor: theme.colors.primary,
          borderRadius: 10,
        }}
      />

      {/* 2. ScrollView — rendu après le highlight, fond transparent, texte visible par-dessus le vert */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={DRUM_ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumScrollEnd}
        contentContainerStyle={{ paddingVertical: DRUM_ITEM_HEIGHT * 2 }}
        style={{ backgroundColor: 'transparent' }}
      >
        {items.map((item, index) => {
          const isSelected = item === value;
          return (
            <View
              key={index}
              style={{ height: DRUM_ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text
                style={{
                  fontFamily: isSelected ? 'Fredoka_700Bold' : 'Fredoka_400Regular',
                  fontSize: isSelected ? 26 : 17,
                  color: isSelected ? '#1a1a1a' : theme.colors.text,
                  opacity: isSelected ? 1 : 0.4,
                }}
              >
                {formatItem ? formatItem(item) : item.toString()}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* 3. Fondus — rendus EN DERNIER = par-dessus tout (ScrollView + highlight) */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: DRUM_ITEM_HEIGHT * 2 }}>
        <View style={{ flex: 1, backgroundColor: cardBackground, opacity: 0.92 }} />
        <View style={{ flex: 1, backgroundColor: cardBackground, opacity: 0.55 }} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: DRUM_ITEM_HEIGHT * 2 }}>
        <View style={{ flex: 1, backgroundColor: cardBackground, opacity: 0.55 }} />
        <View style={{ flex: 1, backgroundColor: cardBackground, opacity: 0.92 }} />
      </View>

    </View>
  );
};

export default function OptionScreen() {
  const { theme, changeTheme, fontSize, changeFontSize, customColor, setCustomColor } = useTheme();
  const { resetGuides } = useScreenGuide();
  const navigation = useNavigation();
  const { isPremium, refreshPremiumStatus } = usePremium();

  const [loading, setLoading] = useState(false);
  const currentUser = getCurrentUser();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [hexInput, setHexInput] = useState('');

  // Refs pour le scroll automatique vers les tooltips
  const scrollViewRef = useRef(null);
  const introRef = useRef(null);
  const themeRef = useRef(null);
  const notificationsRef = useRef(null);
  const adminSectionRef = useRef(null);

  // États pour le modal de changement de mot de passe
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // États pour les notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationType, setNotificationType] = useState('both'); // 'lines', 'stations', 'both'
  const [selectedSeverities, setSelectedSeverities] = useState(['perturbe', 'tres_perturbe', 'interrompu']);
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]); // Lundi à Vendredi par défaut
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(18);
  const [startMinute, setStartMinute] = useState(0);
  const [endMinute, setEndMinute] = useState(0);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [tempStartHour, setTempStartHour] = useState(8);
  const [tempEndHour, setTempEndHour] = useState(18);
  const [tempStartMinute, setTempStartMinute] = useState(0);
  const [tempEndMinute, setTempEndMinute] = useState(0);

  // États pour le récapitulatif matinal
  const [morningSummaryEnabled, setMorningSummaryEnabled] = useState(false);
  const [morningSummaryHour, setMorningSummaryHour] = useState(7);
  const [morningSummaryMinute, setMorningSummaryMinute] = useState(0);
  const [showMorningPickerModal, setShowMorningPickerModal] = useState(false);
  const [tempMorningHour, setTempMorningHour] = useState(7);
  const [tempMorningMinute, setTempMorningMinute] = useState(0);

  // États pour le récapitulatif du soir
  const [eveningSummaryEnabled, setEveningSummaryEnabled] = useState(false);
  const [eveningSummaryHour, setEveningSummaryHour] = useState(18);
  const [eveningSummaryMinute, setEveningSummaryMinute] = useState(0);
  const [showEveningPickerModal, setShowEveningPickerModal] = useState(false);
  const [tempEveningHour, setTempEveningHour] = useState(18);
  const [tempEveningMinute, setTempEveningMinute] = useState(0);

  // État pour la ville
  const [selectedCities, setSelectedCities] = useState(['Paris']);

  // État pour masquer les noms de famille
  const [hideLastNames, setHideLastNames] = useState(false);

  // État pour le type d'authentification (Apple ou email/password)
  const [isAppleUser, setIsAppleUser] = useState(false);

  // États pour la section admin
  const [userEmail, setUserEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  // État pour le modal de déconnexion
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // Toutes les options de thème
  const allThemeOptions = [
    { key: 'custom', icon: 'color-palette', label: 'Custom', premiumOnly: true },
    { key: 'normal', icon: 'partly-sunny', label: 'Normal' },
    { key: 'dark', icon: 'moon', label: 'Sombre' },
  ];

  // Palette de couleurs étendue (36 couleurs)
  const colorPalette = [
    // Pastels clairs
    { color: '#C9F2DF', label: 'Menthe' },
    { color: '#FFB3BA', label: 'Rose' },
    { color: '#BAFFC9', label: 'Vert' },
    { color: '#BAE1FF', label: 'Bleu' },
    { color: '#FFFFBA', label: 'Jaune' },
    { color: '#FFD4BA', label: 'Orange' },
    { color: '#E0BBE4', label: 'Lavande' },
    { color: '#FEC8D8', label: 'Rose pâle' },
    { color: '#D4F1F4', label: 'Cyan' },
    { color: '#FFE5B4', label: 'Pêche' },
    { color: '#C7CEEA', label: 'Pervenche' },
    { color: '#B5EAD7', label: 'Menthe claire' },
    // Couleurs vives
    { color: '#FF6B9D', label: 'Rose vif' },
    { color: '#00D9FF', label: 'Cyan vif' },
    { color: '#FFD93D', label: 'Jaune vif' },
    { color: '#6BCB77', label: 'Vert vif' },
    { color: '#FF6B6B', label: 'Rouge corail' },
    { color: '#4D96FF', label: 'Bleu vif' },
    { color: '#9D84B7', label: 'Violet' },
    { color: '#FF9A8B', label: 'Saumon' },
    { color: '#A8E6CF', label: 'Menthe foncé' },
    { color: '#FFD1DC', label: 'Rose bonbon' },
    { color: '#B4E7CE', label: 'Jade' },
    { color: '#FFDAC1', label: 'Abricot' },
    // Couleurs supplémentaires
    { color: '#F3A683', label: 'Orange doux' },
    { color: '#F7D794', label: 'Miel' },
    { color: '#778BEB', label: 'Indigo' },
    { color: '#E77F67', label: 'Terracotta' },
    { color: '#CF6A87', label: 'Rose ancien' },
    { color: '#F19066', label: 'Mandarine' },
    { color: '#546DE5', label: 'Bleu roi' },
    { color: '#C44569', label: 'Framboise' },
    { color: '#786FA6', label: 'Mauve' },
    { color: '#F8B500', label: 'Or' },
    { color: '#63CDDA', label: 'Turquoise' },
    { color: '#EE5A6F', label: 'Pastèque' },
  ];

  // Gestionnaire pour la sélection de couleur
  const handleColorSelect = (color) => {
    setCustomColor(color);
    setShowColorPicker(false);
  };

  // Gestionnaire pour l'input hexadécimal
  const handleHexSubmit = () => {
    const hex = hexInput.trim();
    // Validation du format hex (#RRGGBB)
    const hexRegex = /^#([A-Fa-f0-9]{6})$/;

    if (hexRegex.test(hex)) {
      setCustomColor(hex);
      setHexInput('');
      setShowColorPicker(false);
    } else {
      Alert.alert('Format invalide', 'Veuillez entrer une couleur au format #RRGGBB (ex: #C9F2DF)');
    }
  };

  const fontSizeOptions = [
    { key: 'small', icon: 'text', label: 'Petit', iconSize: 20 },
    { key: 'normal', icon: 'text', label: 'Normal', iconSize: 26 },
    { key: 'large', icon: 'text', label: 'Grand', iconSize: 32 },
  ];

  const severityOptions = [
    { key: 'sans', label: 'Sans', color: '#8CE9F6', icon: 'checkmark-circle' },
    { key: 'minime', label: 'Minime', color: '#9FFFB4', icon: 'information-circle' },
    { key: 'perturbe', label: 'Perturbé', color: '#EBD6C3', icon: 'alert-circle' },
    { key: 'tres_perturbe', label: 'Très perturbé', color: '#F69B4C', icon: 'warning' },
    { key: 'interrompu', label: 'Interrompu', color: '#BE1313', icon: 'close-circle' },
  ];

  const daysOfWeek = [
    { key: 1, label: 'Lun', fullLabel: 'Lundi' },
    { key: 2, label: 'Mar', fullLabel: 'Mardi' },
    { key: 3, label: 'Mer', fullLabel: 'Mercredi' },
    { key: 4, label: 'Jeu', fullLabel: 'Jeudi' },
    { key: 5, label: 'Ven', fullLabel: 'Vendredi' },
    { key: 6, label: 'Sam', fullLabel: 'Samedi' },
    { key: 0, label: 'Dim', fullLabel: 'Dimanche' },
  ];

  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Fonction pour scroller vers un tooltip
  const scrollToTooltip = (ref, offset = 100) => {
    if (ref.current && scrollViewRef.current) {
      ref.current.measureLayout(
        scrollViewRef.current,
        (_x, y) => {
          scrollViewRef.current.scrollTo({
            y: y - offset, // Offset pour que le tooltip soit bien visible
            animated: true,
          });
        },
        () => {
          console.log('Erreur de mesure du layout');
        }
      );
    }
  };

  // Fonction pour charger les préférences
  const loadPreferences = async () => {
      try {
        const enabled = await AsyncStorage.getItem('notificationsEnabled');
        const notifType = await AsyncStorage.getItem('notificationType');
        const severities = await AsyncStorage.getItem('selectedSeverities');
        const days = await AsyncStorage.getItem('selectedDays');
        const start = await AsyncStorage.getItem('startHour');
        const end = await AsyncStorage.getItem('endHour');
        const startMin = await AsyncStorage.getItem('startMinute');
        const endMin = await AsyncStorage.getItem('endMinute');

        if (enabled !== null) {
          setNotificationsEnabled(enabled === 'true');
        }
        if (notifType !== null) {
          setNotificationType(notifType);
        }
        if (severities !== null) {
          setSelectedSeverities(JSON.parse(severities));
        }
        if (days !== null) {
          setSelectedDays(JSON.parse(days));
        }
        if (start !== null) {
          setStartHour(parseInt(start));
        }
        if (end !== null) {
          setEndHour(parseInt(end));
        }
        if (startMin !== null) {
          setStartMinute(parseInt(startMin));
        }
        if (endMin !== null) {
          setEndMinute(parseInt(endMin));
        }

        // Charger la ville et les préférences depuis Firestore
        if (currentUser) {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();

            // Charger l'email et vérifier si admin
            const email = userData.email || '';
            setUserEmail(email);
            setIsAdmin(email === 'quentinmichaud93460@hotmail.fr');

            // Charger la préférence hideLastNames
            const hideNames = userData.hideLastNames || false;
            setHideLastNames(hideNames);

            // Charger les préférences du récapitulatif matinal
            if (userData.morningSummaryEnabled !== undefined) {
              setMorningSummaryEnabled(userData.morningSummaryEnabled);
            }
            if (userData.morningSummaryHour !== undefined) {
              setMorningSummaryHour(userData.morningSummaryHour);
            }
            if (userData.morningSummaryMinute !== undefined) {
              setMorningSummaryMinute(userData.morningSummaryMinute);
            }

            // Charger les préférences du récapitulatif du soir
            if (userData.eveningSummaryEnabled !== undefined) {
              setEveningSummaryEnabled(userData.eveningSummaryEnabled);
            }
            if (userData.eveningSummaryHour !== undefined) {
              setEveningSummaryHour(userData.eveningSummaryHour);
            }
            if (userData.eveningSummaryMinute !== undefined) {
              setEveningSummaryMinute(userData.eveningSummaryMinute);
            }

            // Migration : écrire les minutes à 0 si elles n'existent pas encore en Firestore
            const migrationFields = {};
            if (userData.morningSummaryHour !== undefined && userData.morningSummaryMinute === undefined) {
              migrationFields.morningSummaryMinute = 0;
            }
            if (userData.eveningSummaryHour !== undefined && userData.eveningSummaryMinute === undefined) {
              migrationFields.eveningSummaryMinute = 0;
            }
            if (Object.keys(migrationFields).length > 0) {
              await updateDoc(doc(db, 'users', currentUser.uid), migrationFields);
            }

            // Charger les villes (nouveau format tableau ou ancien format string)
            let userCities = [];
            if (userData.cities && Array.isArray(userData.cities)) {
              userCities = userData.cities;
            } else if (userData.city) {
              // Migration de l'ancien format
              userCities = [userData.city];
            }
            setSelectedCities(userCities);

            // Vérifier si l'utilisateur s'est connecté via Apple
            setIsAppleUser(userData.authProvider === 'apple');
          }
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };

  // Charger les préférences de notifications et la ville
  useEffect(() => {
    loadPreferences();
  }, [currentUser]);

  // Réagir aux changements de statut premium (géré par PremiumContext)
  useEffect(() => {
    console.log('💎 OptionScreen: isPremium changed to:', isPremium);

    const handlePremiumChange = async () => {
      if (!currentUser) return;

      // Si l'utilisateur n'est pas Premium et a le thème custom, basculer vers normal
      if (!isPremium && theme.name === 'custom') {
        console.log('🎨 Basculement thème custom -> normal');
        changeTheme('normal');
      }

      // Si l'utilisateur n'est plus Premium mais a hideLastNames activé, le désactiver
      if (!isPremium && hideLastNames) {
        setHideLastNames(false);
        await updateDoc(doc(db, 'users', currentUser.uid), {
          hideLastNames: false
        });
      }

      // Si l'utilisateur n'est plus Premium mais a un récapitulatif activé, le désactiver
      if (!isPremium && morningSummaryEnabled) {
        setMorningSummaryEnabled(false);
        await updateDoc(doc(db, 'users', currentUser.uid), {
          morningSummaryEnabled: false
        });
      }
      if (!isPremium && eveningSummaryEnabled) {
        setEveningSummaryEnabled(false);
        await updateDoc(doc(db, 'users', currentUser.uid), {
          eveningSummaryEnabled: false
        });
      }

      // Si l'utilisateur n'est plus Premium mais a plusieurs villes, garder uniquement la première
      if (!isPremium && selectedCities.length > 1) {
        const firstCity = [selectedCities[0]];
        setSelectedCities(firstCity);
        await updateDoc(doc(db, 'users', currentUser.uid), {
          cities: firstCity,
          city: firstCity[0]
        });
        console.log('🏙️ Villes réduites à une seule (fin abonnement):', firstCity);
      }
    };

    handlePremiumChange();
  }, [isPremium, currentUser]);

  // Scroller vers le haut quand on arrive sur la page
  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  // Sauvegarder les préférences de notifications
  const saveNotificationPreferences = async (enabled, notifType, severities, days, start, end, startMin = 0, endMin = 0) => {
    try {
      await AsyncStorage.setItem('notificationsEnabled', enabled.toString());
      await AsyncStorage.setItem('notificationType', notifType);
      await AsyncStorage.setItem('selectedSeverities', JSON.stringify(severities));
      await AsyncStorage.setItem('selectedDays', JSON.stringify(days));
      await AsyncStorage.setItem('startHour', start.toString());
      await AsyncStorage.setItem('endHour', end.toString());
      await AsyncStorage.setItem('startMinute', startMin.toString());
      await AsyncStorage.setItem('endMinute', endMin.toString());

      // Sauvegarder également dans Firebase si l'utilisateur est connecté
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          notificationsEnabled: enabled,
          notificationType: notifType,
          selectedSeverities: severities,
          selectedDays: days,
          startHour: start,
          endHour: end,
          startMinute: startMin,
          endMinute: endMin,
        });
      }
    } catch (error) {
      console.error('Error saving notification preferences:', error);
    }
  };

  // Gérer le changement de l'état des notifications
  const handleNotificationsToggle = async (value) => {
    if (value) {
      // Demander les permissions si on active les notifications
      const result = await requestNotificationPermissions();
      if (!result.success) {
        Alert.alert(
          'Permissions refusées',
          'Vous devez autoriser les notifications dans les réglages de votre téléphone pour recevoir des alertes.'
        );
        return;
      }
    }

    setNotificationsEnabled(value);
    await saveNotificationPreferences(value, notificationType, selectedSeverities, selectedDays, startHour, endHour);
  };

  // Gérer le changement des niveaux de gravité
  const handleSeverityToggle = async (severity) => {
    let newSeverities;
    if (selectedSeverities.includes(severity)) {
      // Ne pas permettre de tout désélectionner
      if (selectedSeverities.length === 1) {
        Alert.alert('Erreur', 'Vous devez sélectionner au moins une gravité');
        return;
      }
      newSeverities = selectedSeverities.filter(s => s !== severity);
    } else {
      newSeverities = [...selectedSeverities, severity];
    }
    setSelectedSeverities(newSeverities);
    await saveNotificationPreferences(notificationsEnabled, notificationType, newSeverities, selectedDays, startHour, endHour);
  };

  // Gérer le changement du type de notification
  const handleNotificationTypeChange = async (type) => {
    setNotificationType(type);
    await saveNotificationPreferences(notificationsEnabled, type, selectedSeverities, selectedDays, startHour, endHour);
  };

  // Gérer le changement des jours
  const handleDayToggle = async (day) => {
    let newDays;
    if (selectedDays.includes(day)) {
      // Ne pas permettre de tout désélectionner
      if (selectedDays.length === 1) {
        Alert.alert('Erreur', 'Vous devez sélectionner au moins un jour');
        return;
      }
      newDays = selectedDays.filter(d => d !== day);
    } else {
      newDays = [...selectedDays, day];
    }
    setSelectedDays(newDays);
    await saveNotificationPreferences(notificationsEnabled, notificationType, selectedSeverities, newDays, startHour, endHour);
  };

  // Gérer le changement du récapitulatif matinal
  const handleMorningSummaryToggle = async (value) => {
    try {
      setMorningSummaryEnabled(value);

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          morningSummaryEnabled: value,
          updatedAt: new Date().toISOString(),
        });
        console.log('✅ Récapitulatif matinal:', value ? 'activé' : 'désactivé');
      }
    } catch (error) {
      console.error('Error updating morning summary:', error);
      setMorningSummaryEnabled(!value);
      Alert.alert('Erreur', 'Impossible de mettre à jour cette préférence');
    }
  };

  // Sauvegarder l'heure+minute du récapitulatif matinal
  const saveMorningSummary = async (hour, minute) => {
    try {
      setMorningSummaryHour(hour);
      setMorningSummaryMinute(minute);

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          morningSummaryHour: hour,
          morningSummaryMinute: minute,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error updating morning summary:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour l\'heure');
    }
  };

  // Gérer le changement du récapitulatif du soir
  const handleEveningSummaryToggle = async (value) => {
    try {
      setEveningSummaryEnabled(value);

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          eveningSummaryEnabled: value,
          updatedAt: new Date().toISOString(),
        });
        console.log('✅ Récapitulatif du soir:', value ? 'activé' : 'désactivé');
      }
    } catch (error) {
      console.error('Error updating evening summary:', error);
      setEveningSummaryEnabled(!value);
      Alert.alert('Erreur', 'Impossible de mettre à jour cette préférence');
    }
  };

  // Sauvegarder l'heure+minute du récapitulatif du soir
  const saveEveningSummary = async (hour, minute) => {
    try {
      setEveningSummaryHour(hour);
      setEveningSummaryMinute(minute);

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          eveningSummaryHour: hour,
          eveningSummaryMinute: minute,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error updating evening summary:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour l\'heure');
    }
  };

  // Gérer le changement de ville
  const handleCityChange = async (city) => {
    try {
      let newCities;

      if (isPremium) {
        // Premium : permettre la sélection multiple
        if (selectedCities.includes(city)) {
          // Désélectionner si déjà sélectionné (mais garder au moins une ville)
          if (selectedCities.length > 1) {
            newCities = selectedCities.filter(c => c !== city);
          } else {
            Alert.alert('Information', 'Vous devez avoir au moins une ville sélectionnée');
            return;
          }
        } else {
          // Ajouter la ville
          newCities = [...selectedCities, city];
        }
      } else {
        // Non-premium : une seule ville à la fois
        if (selectedCities.includes(city)) {
          // Déjà sélectionné, ne rien faire
          return;
        } else {
          // Afficher un message pour inciter au premium si tentative de sélectionner les deux
          if (selectedCities.length > 0) {
            Alert.alert(
              'Lini Premium',
              'Avec Lini Premium, vous pouvez sélectionner plusieurs villes. Passez à Premium pour profiter de cette fonctionnalité !',
              [
                { text: 'Plus tard', style: 'cancel' },
                {
                  text: 'Voir Premium',
                  onPress: () => navigation.navigate('Premium')
                }
              ]
            );
          }
          newCities = [city];
        }
      }

      setSelectedCities(newCities);
      console.log('🏙️ Nouvelles villes sélectionnées:', newCities);

      // Marquer le changement de ville pour réinitialiser le formulaire de post
      await AsyncStorage.setItem('cityChangedTimestamp', Date.now().toString());

      // Sauvegarder dans Firestore
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          cities: newCities,
          city: newCities[0], // Pour rétro-compatibilité
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error updating city:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour la ville');
    }
  };

  // Toggle pour masquer les noms de famille
  const handleHideLastNamesToggle = async (value) => {
    try {
      setHideLastNames(value);

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          hideLastNames: value,
          updatedAt: new Date().toISOString(),
        });
        console.log('✅ Préférence hideLastNames mise à jour:', value);
      }
    } catch (error) {
      console.error('Error updating hideLastNames:', error);
      setHideLastNames(!value);
      Alert.alert('Erreur', 'Impossible de mettre à jour cette préférence');
    }
  };

  // ADMIN : Activer le premium pour un utilisateur par email
  const handleAdminActivatePremium = async () => {
    if (!adminEmailInput.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email');
      return;
    }

    Alert.alert(
      'Activer Premium',
      `Voulez-vous activer le statut Premium pour l'utilisateur avec l'email ${adminEmailInput.trim()} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Activer',
          onPress: async () => {
            setAdminLoading(true);
            const result = await activatePremiumForUser(adminEmailInput.trim());
            setAdminLoading(false);

            if (result.success) {
              setAdminEmailInput('');
              Alert.alert('Succès', 'Premium activé avec succès !');
            } else {
              Alert.alert('Erreur', result.error || 'Impossible d\'activer le premium');
            }
          },
        },
      ]
    );
  };

  // ADMIN : Désactiver le premium pour un utilisateur par email
  const handleAdminDeactivatePremium = async () => {
    if (!adminEmailInput.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email');
      return;
    }

    Alert.alert(
      'Désactiver Premium',
      `Voulez-vous désactiver le statut Premium pour l'utilisateur avec l'email ${adminEmailInput.trim()} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Désactiver',
          style: 'destructive',
          onPress: async () => {
            setAdminLoading(true);
            const result = await deactivatePremiumForUser(adminEmailInput.trim());
            setAdminLoading(false);

            if (result.success) {
              setAdminEmailInput('');
              Alert.alert('Succès', 'Premium désactivé avec succès !');
            } else {
              Alert.alert('Erreur', result.error || 'Impossible de désactiver le premium');
            }
          },
        },
      ]
    );
  };

  // Rejouer le walkthrough
  const handleRestartWalkthrough = () => {
    Alert.alert(
      'Tutoriel',
      'Voulez-vous revoir le tutoriel de présentation de l\'application ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Lancer',
          onPress: async () => {
            await resetGuides();
            // Naviguer vers l'accueil pour démarrer le tutoriel
            navigation.navigate('Main', { screen: 'Home' });
          },
        },
      ]
    );
  };

  // Gérer la déconnexion
  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  // Confirmer la déconnexion
  const confirmLogout = async () => {
    setLogoutModalVisible(false);
    setLoading(true);
    const result = await logout();
    setLoading(false);

    if (!result.success) {
      Alert.alert('Erreur', result.error || 'Erreur lors de la déconnexion');
    }
    // Si succès, onAuthStateChanged dans App.js gérera automatiquement
    // la redirection vers l'écran de connexion
  };

  // Gérer le changement de mot de passe
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert('Erreur', 'Les nouveaux mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    const result = await changePassword(currentPassword, newPassword);
    setLoading(false);

    if (result.success) {
      Alert.alert('Succès', 'Votre mot de passe a été changé avec succès');
      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } else {
      Alert.alert('Erreur', result.error || 'Erreur lors du changement de mot de passe');
    }
  };

  // Gérer la suppression du compte
  const handleDeleteAccount = () => {
    const confirmationMessage = isAppleUser
      ? 'Cette action est irréversible. Vous devrez vous authentifier avec Apple pour confirmer la suppression.'
      : 'Cette action est irréversible. Êtes-vous absolument sûr de vouloir supprimer votre compte ?';

    Alert.alert(
      'Supprimer le compte',
      confirmationMessage,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (isAppleUser) {
              // Pour les utilisateurs Apple, pas besoin de mot de passe
              // La ré-authentification se fait via Apple Sign-In
              setLoading(true);
              const result = await deleteAccount(null, true);
              setLoading(false);

              if (result.success) {
                Alert.alert(
                  'Compte supprimé',
                  'Votre compte a été supprimé avec succès',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        navigation.reset({
                          index: 0,
                          routes: [{ name: 'Login' }],
                        });
                      },
                    },
                  ]
                );
              } else if (!result.canceled) {
                Alert.alert('Erreur', result.error || 'Erreur lors de la suppression du compte');
              }
            } else {
              // Pour les utilisateurs email/password, demander le mot de passe
              Alert.prompt(
                'Confirmation',
                'Entrez votre mot de passe pour confirmer la suppression',
                async (password) => {
                  if (!password) {
                    Alert.alert('Erreur', 'Mot de passe requis');
                    return;
                  }

                  setLoading(true);
                  const result = await deleteAccount(password, false);
                  setLoading(false);

                  if (result.success) {
                    Alert.alert(
                      'Compte supprimé',
                      'Votre compte a été supprimé avec succès',
                      [
                        {
                          text: 'OK',
                          onPress: () => {
                            navigation.reset({
                              index: 0,
                              routes: [{ name: 'Login' }],
                            });
                          },
                        },
                      ]
                    );
                  } else {
                    Alert.alert('Erreur', result.error || 'Erreur lors de la suppression du compte');
                  }
                },
                'secure-text'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Mesh Gradient Background */}
{/*       <View style={styles.meshGradientContainer} pointerEvents="none">
        <LinearGradient
          colors={['rgba(201, 242, 223, 0.3)', 'transparent']}
          style={[styles.meshGradient, { top: 0, left: 0 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={['transparent', 'rgba(141, 228, 192, 0.25)']}
          style={[styles.meshGradient, { top: '30%', right: 0 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={['rgba(93, 214, 160, 0.2)', 'transparent']}
          style={[styles.meshGradient, { bottom: '20%', left: '10%' }]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <LinearGradient
          colors={['transparent', 'rgba(140, 233, 246, 0.15)']}
          style={[styles.meshGradient, { bottom: 0, right: '5%' }]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
        />
      </View> */}

      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'android' ? 150 : 100 }}
        keyboardShouldPersistTaps="handled"
      >
      {/* Titre de la page */}
      <View style={[styles.pageHeader, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.pageTitle, { color: theme.colors.text, fontSize: fontSize.sizes.title }]}>
          Options
        </Text>
      </View>

      {/* Section Ville */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleAccent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Villes
          </Text>
        </View>

        <View style={[styles.modernThemeContainer, { flexWrap: 'wrap', gap: 8 }]}>
          <TouchableOpacity
            style={[
              styles.modernThemeCard,
              {
                backgroundColor: selectedCities.includes('Bordeaux') ? theme.colors.primary : theme.colors.post,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => handleCityChange('Bordeaux')}
          >
            <Image
              source={require('../assets/bordeaux.png')}
              style={{
                width: 55,
                height: 55,
                marginBottom: 4,
                opacity: selectedCities.includes('Bordeaux') ? 1 : 0.5,
                tintColor: theme.colors.iconActive,
              }}
              resizeMode="contain"
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.modernThemeLabel,
                {
                  color: selectedCities.includes('Bordeaux') ? theme.colors.text : theme.colors.text,
                  fontSize: fontSize.sizes.body,
                }
              ]}
            >
              Bordeaux
            </Text>
            {selectedCities.includes('Bordeaux') && (
              <View style={styles.modernCheckmarkContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.colors.iconActive}
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modernThemeCard,
              {
                backgroundColor: selectedCities.includes('Lille') ? theme.colors.primary : theme.colors.post,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => handleCityChange('Lille')}
          >
            <Image
              source={require('../assets/lille.png')}
              style={{
                width: 55,
                height: 55,
                marginBottom: 4,
                opacity: selectedCities.includes('Lille') ? 1 : 0.5,
                tintColor: theme.colors.iconActive,
              }}
              resizeMode="contain"
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.modernThemeLabel,
                {
                  color: selectedCities.includes('Lille') ? theme.colors.text : theme.colors.text,
                  fontSize: fontSize.sizes.body,
                }
              ]}
            >
              Lille
            </Text>
            {selectedCities.includes('Lille') && (
              <View style={styles.modernCheckmarkContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.colors.iconActive}
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modernThemeCard,
              {
                backgroundColor: selectedCities.includes('Lyon') ? theme.colors.primary : theme.colors.post,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => handleCityChange('Lyon')}
          >
            <Image
              source={require('../assets/lyon.png')}
              style={{
                width: 55,
                height: 55,
                marginBottom: 4,
                opacity: selectedCities.includes('Lyon') ? 1 : 0.5,
                tintColor: theme.colors.iconActive,
              }}
              resizeMode="contain"
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.modernThemeLabel,
                {
                  color: selectedCities.includes('Lyon') ? theme.colors.text : theme.colors.text,
                  fontSize: fontSize.sizes.body,
                }
              ]}
            >
              Lyon
            </Text>
            {selectedCities.includes('Lyon') && (
              <View style={styles.modernCheckmarkContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.colors.iconActive}
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modernThemeCard,
              {
                backgroundColor: selectedCities.includes('Marseille') ? theme.colors.primary : theme.colors.post,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => handleCityChange('Marseille')}
          >
            <Image
              source={require('../assets/marseille.png')}
              style={{
                width: 55,
                height: 55,
                marginBottom: 4,
                opacity: selectedCities.includes('Marseille') ? 1 : 0.5,
                tintColor: theme.colors.iconActive,
              }}
              resizeMode="contain"
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.modernThemeLabel,
                {
                  color: selectedCities.includes('Marseille') ? theme.colors.text : theme.colors.text,
                  fontSize: fontSize.sizes.body,
                }
              ]}
            >
              Marseille
            </Text>
            {selectedCities.includes('Marseille') && (
              <View style={styles.modernCheckmarkContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.colors.iconActive}
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modernThemeCard,
              {
                backgroundColor: selectedCities.includes('Montpellier') ? theme.colors.primary : theme.colors.post,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => handleCityChange('Montpellier')}
          >
            <Image
              source={require('../assets/montpellier.png')}
              style={{
                width: 55,
                height: 55,
                marginBottom: 4,
                opacity: selectedCities.includes('Montpellier') ? 1 : 0.5,
                tintColor: theme.colors.iconActive,
              }}
              resizeMode="contain"
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.modernThemeLabel,
                {
                  color: selectedCities.includes('Montpellier') ? theme.colors.text : theme.colors.text,
                  fontSize: fontSize.sizes.body,
                }
              ]}
            >
              Montpellier
            </Text>
            {selectedCities.includes('Montpellier') && (
              <View style={styles.modernCheckmarkContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.colors.iconActive}
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modernThemeCard,
              {
                backgroundColor: selectedCities.includes('Nantes') ? theme.colors.primary : theme.colors.post,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => handleCityChange('Nantes')}
          >
            <Image
              source={require('../assets/nantes.png')}
              style={{
                width: 55,
                height: 55,
                marginBottom: 4,
                opacity: selectedCities.includes('Nantes') ? 1 : 0.5,
                tintColor: theme.colors.iconActive,
              }}
              resizeMode="contain"
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.modernThemeLabel,
                {
                  color: selectedCities.includes('Nantes') ? theme.colors.text : theme.colors.text,
                  fontSize: fontSize.sizes.body,
                }
              ]}
            >
              Nantes
            </Text>
            {selectedCities.includes('Nantes') && (
              <View style={styles.modernCheckmarkContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.colors.iconActive}
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modernThemeCard,
              {
                backgroundColor: selectedCities.includes('Nice') ? theme.colors.primary : theme.colors.post,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => handleCityChange('Nice')}
          >
            <Image
              source={require('../assets/nice.png')}
              style={{
                width: 55,
                height: 55,
                marginBottom: 4,
                opacity: selectedCities.includes('Nice') ? 1 : 0.5,
                tintColor: theme.colors.iconActive,
              }}
              resizeMode="contain"
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.modernThemeLabel,
                {
                  color: selectedCities.includes('Nice') ? theme.colors.text : theme.colors.text,
                  fontSize: fontSize.sizes.body,
                }
              ]}
            >
              Nice
            </Text>
            {selectedCities.includes('Nice') && (
              <View style={styles.modernCheckmarkContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.colors.iconActive}
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modernThemeCard,
              {
                backgroundColor: selectedCities.includes('Paris') ? theme.colors.primary : theme.colors.post,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => handleCityChange('Paris')}
          >
            <Image
              source={require('../assets/paris.png')}
              style={{
                width: 55,
                height: 55,
                marginBottom: 4,
                opacity: selectedCities.includes('Paris') ? 1 : 0.5,
                tintColor: theme.colors.iconActive,
              }}
              resizeMode="contain"
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.modernThemeLabel,
                {
                  color: selectedCities.includes('Paris') ? theme.colors.text : theme.colors.text,
                  fontSize: fontSize.sizes.body,
                }
              ]}
            >
              Paris
            </Text>
            {selectedCities.includes('Paris') && (
              <View style={styles.modernCheckmarkContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.colors.iconActive}
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modernThemeCard,
              {
                backgroundColor: selectedCities.includes('Rennes') ? theme.colors.primary : theme.colors.post,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => handleCityChange('Rennes')}
          >
            <Image
              source={require('../assets/rennes.png')}
              style={{
                width: 55,
                height: 55,
                marginBottom: 4,
                opacity: selectedCities.includes('Rennes') ? 1 : 0.5,
                tintColor: theme.colors.iconActive,
              }}
              resizeMode="contain"
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.modernThemeLabel,
                {
                  color: selectedCities.includes('Rennes') ? theme.colors.text : theme.colors.text,
                  fontSize: fontSize.sizes.body,
                }
              ]}
            >
              Rennes
            </Text>
            {selectedCities.includes('Rennes') && (
              <View style={styles.modernCheckmarkContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.colors.iconActive}
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modernThemeCard,
              {
                backgroundColor: selectedCities.includes('Strasbourg') ? theme.colors.primary : theme.colors.post,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => handleCityChange('Strasbourg')}
          >
            <Image
              source={require('../assets/strasbourg.png')}
              style={{
                width: 55,
                height: 55,
                marginBottom: 4,
                opacity: selectedCities.includes('Strasbourg') ? 1 : 0.5,
                tintColor: theme.colors.iconActive,
              }}
              resizeMode="contain"
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.modernThemeLabel,
                {
                  color: selectedCities.includes('Strasbourg') ? theme.colors.text : theme.colors.text,
                  fontSize: fontSize.sizes.body,
                }
              ]}
            >
              Strasbourg
            </Text>
            {selectedCities.includes('Strasbourg') && (
              <View style={styles.modernCheckmarkContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.colors.iconActive}
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modernThemeCard,
              {
                backgroundColor: selectedCities.includes('Toulouse') ? theme.colors.primary : theme.colors.post,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => handleCityChange('Toulouse')}
          >
            <Image
              source={require('../assets/toulouse.png')}
              style={{
                width: 55,
                height: 55,
                marginBottom: 4,
                opacity: selectedCities.includes('Toulouse') ? 1 : 0.5,
                tintColor: theme.colors.iconActive,
              }}
              resizeMode="contain"
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.modernThemeLabel,
                {
                  color: selectedCities.includes('Toulouse') ? theme.colors.text : theme.colors.text,
                  fontSize: fontSize.sizes.body,
                }
              ]}
            >
              Toulouse
            </Text>
            {selectedCities.includes('Toulouse') && (
              <View style={styles.modernCheckmarkContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.colors.iconActive}
                />
              </View>
            )}
          </TouchableOpacity>

          <View
            style={[
              styles.modernThemeCard,
              {
                backgroundColor: theme.colors.post,
                borderColor: theme.colors.border,
                opacity: 0.5,
              }
            ]}
          >
            <View style={[
              styles.modernThemeIconContainer,
              {
                backgroundColor: theme.colors.background,
              }
            ]}>
              <Ionicons
                name="add-circle-outline"
                size={28}
                color={theme.colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.modernThemeLabel,
                {
                  color: theme.colors.textSecondary,
                  fontSize: fontSize.sizes.body,
                }
              ]}
            >
              Bientôt...
            </Text>
          </View>
        </View>
      </View>

      {/* Section Notifications */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleAccent} />
          <View ref={notificationsRef}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              Notifications
            </Text>
          </View>
        </View>

        {/* Activer les notifications (Premium uniquement) */}
        {isPremium ? (
          <View style={[styles.notificationOption, { backgroundColor: theme.colors.post, borderColor: theme.colors.border }]}>
            <View style={[styles.notificationIconContainer, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="notifications" size={22} color="#1a1a1a" />
            </View>
            <View style={[styles.notificationDivider, { backgroundColor: theme.colors.primary, opacity: 1 }]} />
            <View style={styles.notificationContent}>
              <Text style={[styles.notificationLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                Activer les notifications
              </Text>
              <Text style={[styles.notificationSubLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Recevez des alertes pour les incidents
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: theme.colors.border, true: '#4CD964' }}
              thumbColor="#fff"
              style={{ alignSelf: 'center' }}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.accountOption,
              { backgroundColor: theme.colors.post, borderColor: '#FFD700', opacity: 0.6 }
            ]}
            onPress={() => navigation.navigate('Premium')}
          >
            <View style={[styles.accountIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
              <Ionicons name="notifications" size={22} color="#fff" />
            </View>
            <View style={styles.accountDivider} />
            <View style={styles.accountContent}>
              <Text style={[styles.accountLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                Activer les notifications
              </Text>
            </View>
            <View style={{ position: 'relative' }}>
              <Ionicons name="diamond" size={24} color="#FFD700" />
            </View>
          </TouchableOpacity>
        )}

        {/* Type de notifications */}
        {notificationsEnabled && isPremium && (
          <View style={styles.severityContainer}>
            <Text style={[styles.filterLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
              Recevoir des alertes pour
            </Text>
            <View style={styles.modernThemeContainer}>
              <TouchableOpacity
                style={[
                  styles.modernThemeCard,
                  {
                    backgroundColor: notificationType === 'lines' ? theme.colors.primary : theme.colors.post,
                    borderColor: theme.colors.border,
                  }
                ]}
                onPress={() => handleNotificationTypeChange('lines')}
              >
                <View style={[
                  styles.modernThemeIconContainer,
                  {
                    backgroundColor: notificationType === 'lines' ? theme.colors.background : theme.colors.background,
                  }
                ]}>
                  <Ionicons
                    name="train"
                    size={28}
                    color={notificationType === 'lines' ? theme.colors.iconActive : theme.colors.iconInactive}
                  />
                </View>
                <Text
                  style={[
                    styles.modernThemeLabel,
                    {
                      color: notificationType === 'lines' ? theme.colors.text : theme.colors.text,
                      fontSize: fontSize.sizes.small,
                    }
                  ]}
                >
                  Mes lignes
                </Text>
                {notificationType === 'lines' && (
                  <View style={styles.modernCheckmarkContainer}>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={theme.colors.iconActive}
                    />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modernThemeCard,
                  {
                    backgroundColor: notificationType === 'stations' ? theme.colors.primary : theme.colors.post,
                    borderColor: theme.colors.border,
                  }
                ]}
                onPress={() => handleNotificationTypeChange('stations')}
              >
                <View style={[
                  styles.modernThemeIconContainer,
                  {
                    backgroundColor: notificationType === 'stations' ? theme.colors.background : theme.colors.background,
                  }
                ]}>
                  <Ionicons
                    name="location"
                    size={28}
                    color={notificationType === 'stations' ? theme.colors.iconActive : theme.colors.iconInactive}
                  />
                </View>
                <Text
                  style={[
                    styles.modernThemeLabel,
                    {
                      color: notificationType === 'stations' ? theme.colors.text : theme.colors.text,
                      fontSize: fontSize.sizes.small,
                    }
                  ]}
                >
                  Mes stations
                </Text>
                {notificationType === 'stations' && (
                  <View style={styles.modernCheckmarkContainer}>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={theme.colors.iconActive}
                    />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modernThemeCard,
                  {
                    backgroundColor: notificationType === 'both' ? theme.colors.primary : theme.colors.post,
                    borderColor: theme.colors.border,
                  }
                ]}
                onPress={() => handleNotificationTypeChange('both')}
              >
                <View style={[
                  styles.modernThemeIconContainer,
                  {
                    backgroundColor: notificationType === 'both' ? theme.colors.background : theme.colors.background,
                  }
                ]}>
                  <Ionicons
                    name="star"
                    size={28}
                    color={notificationType === 'both' ? theme.colors.iconActive : theme.colors.iconInactive}
                  />
                </View>
                <Text
                  style={[
                    styles.modernThemeLabel,
                    {
                      color: notificationType === 'both' ? theme.colors.text : theme.colors.text,
                      fontSize: fontSize.sizes.small,
                    }
                  ]}
                >
                  Les deux
                </Text>
                {notificationType === 'both' && (
                  <View style={styles.modernCheckmarkContainer}>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={theme.colors.iconActive}
                    />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Sélection des gravités */}
        {notificationsEnabled && isPremium && (
          <View style={styles.severityContainer}>
            <Text style={[styles.filterLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
              Gravités concernées
            </Text>
            <View style={styles.severityCardsContainer}>
              {severityOptions.map((option) => {
                const isSelected = selectedSeverities.includes(option.key);
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.severityCard,
                      {
                        backgroundColor: isSelected ? option.color : theme.colors.post,
                        borderColor: theme.colors.border,
                      }
                    ]}
                    onPress={() => handleSeverityToggle(option.key)}
                  >
                    <View style={[
                      styles.severityIconContainer,
                      {
                        backgroundColor: isSelected ? theme.colors.background : theme.colors.primary,
                      }
                    ]}>
                      <Ionicons
                        name={option.icon}
                        size={24}
                        color={isSelected ? option.color : theme.colors.iconInactive}
                      />
                    </View>
                    <Text
                      style={[
                        styles.severityCardLabel,
                        {
                          color: isSelected ? '#000' : theme.colors.text,
                          fontSize: fontSize.sizes.small,
                        }
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected && (
                      <View style={styles.modernCheckmarkContainer}>
                        <Ionicons
                          name="checkmark-circle"
                          size={24}
                          color="#000"
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Sélection des jours */}
        {notificationsEnabled && isPremium && (
          <View style={styles.severityContainer}>
            <Text style={[styles.filterLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
              Jours actifs
            </Text>
            <View style={styles.daysContainer}>
              {daysOfWeek.map((day) => {
                const isSelected = selectedDays.includes(day.key);
                return (
                  <TouchableOpacity
                    key={day.key}
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: isSelected ? theme.colors.primary : theme.colors.post,
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        borderWidth: 1,
                      }
                    ]}
                    onPress={() => handleDayToggle(day.key)}
                  >
                    <Text
                      style={[
                        styles.dayLabel,
                        {
                          color: isSelected ? theme.colors.text : theme.colors.text,
                          fontSize: fontSize.sizes.small,
                        }
                      ]}
                    >
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Plage horaire */}
        {notificationsEnabled && isPremium && (
          <View style={styles.severityContainer}>
            <Text style={[styles.filterLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
              Plage horaire
            </Text>

            <TouchableOpacity
              style={[styles.notificationOption, { backgroundColor: theme.colors.post, borderColor: theme.colors.border, marginBottom: 0 }]}
              onPress={() => {
                setTempStartHour(startHour);
                setTempEndHour(endHour);
                setTempStartMinute(startMinute);
                setTempEndMinute(endMinute);
                setShowTimePickerModal(true);
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.notificationIconContainer, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="time-outline" size={22} color="#1a1a1a" />
              </View>
              <View style={[styles.notificationDivider, { backgroundColor: theme.colors.primary, opacity: 1 }]} />
              <View style={styles.notificationContent}>
                <Text style={[styles.notificationLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                  Plage active
                </Text>
                <Text style={[styles.notificationSubLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  {startHour.toString().padStart(2, '0')}:{startMinute.toString().padStart(2, '0')} — {endHour.toString().padStart(2, '0')}:{endMinute.toString().padStart(2, '0')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Récapitulatif matinal (Premium uniquement) */}
        {notificationsEnabled && isPremium && (
          <View style={styles.severityContainer}>
            <Text style={[styles.filterLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
              Récapitulatif matinal
            </Text>
            <Text style={[styles.helperText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginBottom: 12 }]}>
              Recevez un résumé des incidents sur vos lignes favorites chaque matin
            </Text>

            {isPremium ? (
              <>
                {/* Toggle récapitulatif matinal */}
                <View style={[styles.notificationOption, { backgroundColor: theme.colors.post, borderColor: theme.colors.border, marginBottom: 12 }]}>
                  <View style={[styles.notificationIconContainer, { backgroundColor: theme.colors.primary }]}>
                    <Ionicons name="sunny" size={22} color="#1a1a1a" />
                  </View>
                  <View style={[styles.notificationDivider, { backgroundColor: theme.colors.primary, opacity: 1 }]} />
                  <View style={styles.notificationContent}>
                    <Text style={[styles.notificationLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                      Activer le récapitulatif
                    </Text>
                    <Text style={[styles.notificationSubLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                      Notification quotidienne à l'heure choisie
                    </Text>
                  </View>
                  <Switch
                    value={morningSummaryEnabled}
                    onValueChange={handleMorningSummaryToggle}
                    trackColor={{ false: theme.colors.border, true: '#4CD964' }}
                    thumbColor="#fff"
                  />
                </View>

                {/* Carte heure du récapitulatif matinal */}
                {morningSummaryEnabled && (
                  <TouchableOpacity
                    style={[styles.notificationOption, { backgroundColor: theme.colors.post, borderColor: theme.colors.border, marginBottom: 0 }]}
                    onPress={() => {
                      setTempMorningHour(morningSummaryHour);
                      setTempMorningMinute(morningSummaryMinute);
                      setShowMorningPickerModal(true);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.notificationIconContainer, { backgroundColor: theme.colors.primary }]}>
                      <Ionicons name="alarm-outline" size={22} color="#1a1a1a" />
                    </View>
                    <View style={[styles.notificationDivider, { backgroundColor: theme.colors.primary, opacity: 1 }]} />
                    <View style={styles.notificationContent}>
                      <Text style={[styles.notificationLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                        Heure d'envoi
                      </Text>
                      <Text style={[styles.notificationSubLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                        {morningSummaryHour.toString().padStart(2, '0')}:{morningSummaryMinute.toString().padStart(2, '0')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <TouchableOpacity
                style={[
                  styles.accountOption,
                  { backgroundColor: theme.colors.post, borderColor: '#FFD700', opacity: 0.6 }
                ]}
                onPress={() => navigation.navigate('Premium')}
              >
                <View style={[styles.accountIconContainer, { backgroundColor: theme.colors.iconActive }]}>
                  <Ionicons name="sunny" size={22} color="#fff" />
                </View>
                <View style={styles.accountDivider} />
                <View style={styles.accountContent}>
                  <Text style={[styles.accountLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                    Activer le récapitulatif
                  </Text>
                </View>
                <View style={{ position: 'relative' }}>
                  <Ionicons name="diamond" size={24} color="#FFD700" />
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Récapitulatif du soir (Premium uniquement) */}
        {notificationsEnabled && isPremium && (
          <View style={styles.severityContainer}>
            <Text style={[styles.filterLabel, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
              Récapitulatif du soir
            </Text>
            <Text style={[styles.helperText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginBottom: 12 }]}>
              Recevez un résumé des incidents sur vos lignes favorites chaque soir
            </Text>

            {isPremium ? (
              <>
                {/* Toggle récapitulatif du soir */}
                <View style={[styles.notificationOption, { backgroundColor: theme.colors.post, borderColor: theme.colors.border, marginBottom: 12 }]}>
                  <View style={[styles.notificationIconContainer, { backgroundColor: theme.colors.primary }]}>
                    <Ionicons name="moon" size={22} color="#1a1a1a" />
                  </View>
                  <View style={[styles.notificationDivider, { backgroundColor: theme.colors.primary, opacity: 1 }]} />
                  <View style={styles.notificationContent}>
                    <Text style={[styles.notificationLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                      Activer le récapitulatif
                    </Text>
                    <Text style={[styles.notificationSubLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                      Notification quotidienne à l'heure choisie
                    </Text>
                  </View>
                  <Switch
                    value={eveningSummaryEnabled}
                    onValueChange={handleEveningSummaryToggle}
                    trackColor={{ false: theme.colors.border, true: '#4CD964' }}
                    thumbColor="#fff"
                  />
                </View>

                {/* Carte heure du récapitulatif du soir */}
                {eveningSummaryEnabled && (
                  <TouchableOpacity
                    style={[styles.notificationOption, { backgroundColor: theme.colors.post, borderColor: theme.colors.border, marginBottom: 0 }]}
                    onPress={() => {
                      setTempEveningHour(eveningSummaryHour);
                      setTempEveningMinute(eveningSummaryMinute);
                      setShowEveningPickerModal(true);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.notificationIconContainer, { backgroundColor: theme.colors.primary }]}>
                      <Ionicons name="alarm-outline" size={22} color="#1a1a1a" />
                    </View>
                    <View style={[styles.notificationDivider, { backgroundColor: theme.colors.primary, opacity: 1 }]} />
                    <View style={styles.notificationContent}>
                      <Text style={[styles.notificationLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                        Heure d'envoi
                      </Text>
                      <Text style={[styles.notificationSubLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                        {eveningSummaryHour.toString().padStart(2, '0')}:{eveningSummaryMinute.toString().padStart(2, '0')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <TouchableOpacity
                style={[
                  styles.accountOption,
                  { backgroundColor: theme.colors.post, borderColor: '#FFD700', opacity: 0.6 }
                ]}
                onPress={() => navigation.navigate('Premium')}
              >
                <View style={[styles.accountIconContainer, { backgroundColor: theme.colors.iconActive }]}>
                  <Ionicons name="moon" size={22} color="#fff" />
                </View>
                <View style={styles.accountDivider} />
                <View style={styles.accountContent}>
                  <Text style={[styles.accountLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                    Activer le récapitulatif
                  </Text>
                </View>
                <View style={{ position: 'relative' }}>
                  <Ionicons name="diamond" size={24} color="#FFD700" />
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Section Apparence */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer} ref={themeRef}>
          <View style={styles.titleAccent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Apparence
          </Text>
        </View>

        <View style={styles.modernThemeContainer}>
          {allThemeOptions.map((option) => {
            const isSelected = theme.name === option.key;
            const isLocked = option.premiumOnly && !isPremium;

            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.modernThemeCard,
                  {
                    backgroundColor: isSelected ? theme.colors.primary : theme.colors.post,
                    borderColor: isLocked ? '#FFD700' : theme.colors.border,
                    opacity: isLocked ? 0.6 : 1,
                  }
                ]}
                onPress={() => {
                  if (isLocked) {
                    scrollViewRef.current?.scrollTo({ y: 1200, animated: true });
                    return;
                  }
                  changeTheme(option.key);
                  if (option.key === 'custom') {
                    setShowColorPicker(true);
                  }
                }}
                disabled={isLocked}
              >
                <View style={{ position: 'relative' }}>
                  <View style={[
                    styles.modernThemeIconContainer,
                    { backgroundColor: isSelected ? theme.colors.background : theme.colors.background }
                  ]}>
                    <Ionicons
                      name={option.icon}
                      size={28}
                      color={isSelected ? theme.colors.iconActive : theme.colors.iconInactive}
                    />
                  </View>
                  {isLocked && (
                    <PremiumBadge size={24} style={styles.premiumBadge} />
                  )}
                </View>
                <Text style={[styles.modernThemeLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                  {option.label}
                </Text>
                {isSelected && !isLocked && (
                  <View style={styles.modernCheckmarkContainer}>
                    <Ionicons name="checkmark-circle" size={24} color={theme.colors.iconActive} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {theme.name === 'custom' && (
          <View style={styles.colorPickerContainer}>
            <TouchableOpacity
              style={[styles.colorPickerButton, { backgroundColor: theme.colors.primary, borderColor: theme.colors.border }]}
              onPress={() => setShowColorPicker(true)}
            >
              <View style={[styles.colorPreview, { backgroundColor: customColor }]} />
              <Text style={[styles.colorPickerButtonText, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                Personnaliser la couleur
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.iconActive} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Section Taille de police */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleAccent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Taille de police
          </Text>
        </View>

        <View style={styles.modernThemeContainer}>
          {fontSizeOptions.map((option) => {
            const isSelected = fontSize.name === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.modernThemeCard,
                  {
                    backgroundColor: isSelected ? theme.colors.primary : theme.colors.post,
                    borderColor: theme.colors.border,
                  }
                ]}
                onPress={() => changeFontSize(option.key)}
              >
                <View style={[
                  styles.modernThemeIconContainer,
                  { backgroundColor: isSelected ? theme.colors.background : theme.colors.background }
                ]}>
                  <Ionicons
                    name={option.icon}
                    size={option.iconSize}
                    color={isSelected ? theme.colors.iconActive : theme.colors.iconInactive}
                  />
                </View>
                <Text style={[styles.modernThemeLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                  {option.label}
                </Text>
                {isSelected && (
                  <View style={styles.modernCheckmarkContainer}>
                    <Ionicons name="checkmark-circle" size={24} color={theme.colors.iconActive} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Section Compte */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleAccent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Compte
          </Text>
        </View>

        {/* Lini Premium */}
        <TouchableOpacity
          style={[
            styles.accountOption,
            { backgroundColor: '#FFD700', borderColor: '#E5E5E5' }
          ]}
          onPress={() => navigation.navigate('Premium')}
        >
          <View style={[styles.accountIconContainer, { backgroundColor: 'rgba(0, 0, 0, 0.15)' }]}>
            <Ionicons name="diamond" size={22} color="#000" />
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountContent}>
            <Text style={[styles.accountLabel, { color: '#000', fontSize: fontSize.sizes.body }]}>
              Lini Premium
            </Text>
            <Text style={[styles.notificationSubLabel, { color: '#000', opacity: 0.7, fontSize: fontSize.sizes.small, marginTop: 2 }]}>
              Profitez de toutes les fonctionnalités pour 2.99€/mois
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#000" />
        </TouchableOpacity>

        {/* Masquer les noms de famille (Premium uniquement) */}
        {isPremium ? (
          <View style={[styles.notificationOption, { backgroundColor: theme.colors.post, borderColor: theme.colors.border }]}>
            <View style={[styles.notificationIconContainer, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="eye-off-outline" size={22} color="#1a1a1a" />
            </View>
            <View style={[styles.notificationDivider, { backgroundColor: theme.colors.primary, opacity: 1 }]} />
            <View style={styles.notificationContent}>
              <Text style={[styles.notificationLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                Masquer les noms de famille
              </Text>
              <Text style={[styles.notificationSubLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Protégez votre vie privée
              </Text>
            </View>
            <Switch
              value={hideLastNames}
              onValueChange={handleHideLastNamesToggle}
              trackColor={{ false: '#767577', true: theme.colors.primary }}
              thumbColor={hideLastNames ? '#fff' : '#f4f3f4'}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.accountOption,
              { backgroundColor: theme.colors.post, borderColor: '#FFD700', opacity: 0.6 }
            ]}
            onPress={() => navigation.navigate('Premium')}
          >
            <View style={[styles.accountIconContainer, { backgroundColor: theme.colors.cardBackgroundColor }]}>
              <Ionicons name="eye-off-outline" size={22} color="#fff" />
            </View>
            <View style={styles.accountDivider} />
            <View style={styles.accountContent}>
              <Text style={[styles.accountLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                Masquer les noms de famille
              </Text>
            </View>
            <View style={{ position: 'relative' }}>
              <Ionicons name="diamond" size={24} color="#FFD700" />
            </View>
          </TouchableOpacity>
        )}

        {/* Changer le mot de passe */}
        <TouchableOpacity
          style={[
            styles.accountOption,
            { backgroundColor: theme.colors.post, borderColor: '#E5E5E5' }
          ]}
          onPress={() => setPasswordModalVisible(true)}
          disabled={loading}
        >
          <View style={[styles.accountIconContainer, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="key-outline" size={22} color="#1a1a1a" />
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountContent}>
            <Text style={[styles.accountLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
              Changer le mot de passe
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.iconInactive} />
        </TouchableOpacity>

        {/* Déconnexion */}
        <TouchableOpacity
          style={[
            styles.accountOption,
            { backgroundColor: theme.colors.post, borderColor: '#E5E5E5' }
          ]}
          onPress={handleLogout}
          disabled={loading}
        >
          <View style={[styles.accountIconContainer, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="log-out-outline" size={22} color="#1a1a1a" />
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountContent}>
            <Text style={[styles.accountLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
              Se déconnecter
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.iconInactive} />
        </TouchableOpacity>

        {/* Supprimer le compte */}
        <TouchableOpacity
          style={[
            styles.accountOption,
            { backgroundColor: theme.colors.post, borderColor: '#DC3545' }
          ]}
          onPress={handleDeleteAccount}
          disabled={loading}
        >
          <View style={[styles.accountIconContainer, { backgroundColor: '#DC3545' }]}>
            <Ionicons name="trash-outline" size={22} color="#fff" />
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountContent}>
            <Text style={[styles.accountLabel, { color: '#DC3545', fontSize: fontSize.sizes.body }]}>
              Supprimer le compte
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#DC3545" />
        </TouchableOpacity>
      </View>

      {/* Section Aide */}
      <View style={styles.section}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleAccent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Aide
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.accountOption,
            { backgroundColor: theme.colors.post, borderColor: '#E5E5E5' }
          ]}
          onPress={handleRestartWalkthrough}
        >
          <View style={[styles.accountIconContainer, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="help-circle-outline" size={22} color="#1a1a1a" />
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountContent}>
            <Text style={[styles.accountLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
              Rejouer le tutoriel
            </Text>
            <Text style={[styles.notificationSubLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginTop: 2 }]}>
              Découvrez à nouveau comment utiliser l'application
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.iconInactive} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.accountOption,
            { backgroundColor: theme.colors.post, borderColor: '#E5E5E5' }
          ]}
          onPress={() => Linking.openURL('https://anonyma93.github.io/Politique_de_confidentialit-/privacy-policy.html')}
        >
          <View style={[styles.accountIconContainer, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#1a1a1a" />
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountContent}>
            <Text style={[styles.accountLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
              Politique de confidentialité
            </Text>
            <Text style={[styles.notificationSubLabel, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginTop: 2 }]}>
              En savoir plus sur la protection de vos données
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.iconInactive} />
        </TouchableOpacity>
      </View>

      {/* Section Admin - Visible uniquement pour l'admin */}
      {isAdmin && (
        <View style={styles.section} ref={adminSectionRef}>
          <View style={styles.sectionTitleContainer}>
            <View style={[styles.titleAccent, { backgroundColor: '#FF6B6B' }]} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              Administration
            </Text>
          </View>

          <View style={[styles.adminContainer, { backgroundColor: theme.colors.post, borderColor: '#E5E5E5' }]}>
            <View style={styles.adminHeader}>
              <Ionicons name="shield-checkmark" size={24} color="#FF6B6B" />
              <Text style={[styles.adminTitle, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                Gestion des comptes Premium
              </Text>
            </View>

            <Text style={[styles.adminDescription, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
              Entrez l'adresse email d'un utilisateur pour gérer son statut Premium
            </Text>

            <TextInput
              style={[
                styles.adminInput,
                {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  fontSize: fontSize.sizes.body,
                }
              ]}
              placeholder="exemple@email.com"
              placeholderTextColor={theme.colors.textSecondary}
              value={adminEmailInput}
              onChangeText={setAdminEmailInput}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!adminLoading}
              onFocus={() => {
                // Scroller vers la section admin quand le champ est activé
                setTimeout(() => {
                  adminSectionRef.current?.measureLayout(
                    scrollViewRef.current,
                    (_x, y) => {
                      scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
                    },
                    () => {}
                  );
                }, 100);
              }}
            />

            <View style={styles.adminButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.adminButton,
                  styles.adminButtonActivate,
                  adminLoading && styles.adminButtonDisabled
                ]}
                onPress={handleAdminActivatePremium}
                disabled={adminLoading || !adminEmailInput.trim()}
              >
                {adminLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="diamond" size={20} color="#fff" />
                    <Text style={[styles.adminButtonText, { fontSize: fontSize.sizes.body }]}>
                      Activer Premium
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.adminButton,
                  styles.adminButtonDeactivate,
                  adminLoading && styles.adminButtonDisabled
                ]}
                onPress={handleAdminDeactivatePremium}
                disabled={adminLoading || !adminEmailInput.trim()}
              >
                {adminLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="diamond-outline" size={20} color="#fff" />
                    <Text style={[styles.adminButtonText, { fontSize: fontSize.sizes.body }]}>
                      Désactiver Premium
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modal de changement de mot de passe */}
      <Modal
        visible={passwordModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
                Changer le mot de passe
              </Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <Ionicons name="close" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                Mot de passe actuel
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: theme.colors.navbar,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    fontSize: fontSize.sizes.body,
                  }
                ]}
                placeholder="Entrez votre mot de passe actuel"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                autoComplete="off"
                textContentType="oneTimeCode"
              />

              <Text style={[styles.inputLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                Nouveau mot de passe
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: theme.colors.navbar,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    fontSize: fontSize.sizes.body,
                  }
                ]}
                placeholder="Minimum 6 caractères"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                autoComplete="off"
                textContentType="oneTimeCode"
              />

              <Text style={[styles.inputLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                Confirmer le nouveau mot de passe
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: theme.colors.navbar,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    fontSize: fontSize.sizes.body,
                  }
                ]}
                placeholder="Retapez votre nouveau mot de passe"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                autoComplete="off"
                textContentType="oneTimeCode"
              />

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#007AFF' }]}
                onPress={handleChangePassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalButtonText, { fontSize: fontSize.sizes.body }]}>
                    Changer le mot de passe
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de confirmation de déconnexion */}
      <Modal
        visible={logoutModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
                Déconnexion
              </Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body, textAlign: 'center' }]}>
                Êtes-vous sûr de vouloir vous déconnecter ?
              </Text>
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButtonSecondary, { backgroundColor: theme.colors.navbar, borderColor: theme.colors.border }]}
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={[styles.modalButtonSecondaryText, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                  Annuler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#DC3545' }]}
                onPress={confirmLogout}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalButtonText, { fontSize: fontSize.sizes.body }]}>
                    Déconnexion
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal du sélecteur de couleur */}
      <Modal
        visible={showColorPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowColorPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.colorPickerModal, { backgroundColor: theme.colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
                Personnaliser la couleur
              </Text>
              <TouchableOpacity onPress={() => setShowColorPicker(false)}>
                <Ionicons name="close" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.colorPickerContent}
              contentContainerStyle={styles.colorPickerScrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {/* Couleur actuelle */}
              <View style={styles.currentColorSection}>
                <Text style={[styles.sectionLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                  Couleur actuelle
                </Text>
                <View style={styles.currentColorDisplay}>
                  <View style={[styles.colorPreviewLarge, { backgroundColor: customColor }]} />
                  <Text style={[styles.colorHexValue, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
                    {customColor}
                  </Text>
                </View>
              </View>

              {/* Palette de couleurs */}
              <View style={styles.paletteSection}>
                <Text style={[styles.sectionLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                  Sélectionner une couleur
                </Text>
                <View style={styles.colorPaletteGrid}>
                  {colorPalette.map((item) => (
                    <TouchableOpacity
                      key={item.color}
                      style={[
                        styles.colorOption,
                        {
                          backgroundColor: item.color,
                          borderWidth: customColor === item.color ? 3 : 1,
                          borderColor: customColor === item.color ? '#000' : theme.colors.border,
                        }
                      ]}
                      onPress={() => handleColorSelect(item.color)}
                    >
                      {customColor === item.color && (
                        <Ionicons name="checkmark" size={20} color="#000" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Input code hexadécimal */}
              <View style={styles.hexInputSection}>
                <Text style={[styles.sectionLabel, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                  Ou entrez un code couleur
                </Text>
                <View style={styles.hexInputContainer}>
                  <TextInput
                    style={[
                      styles.hexInput,
                      {
                        backgroundColor: theme.colors.navbar,
                        color: theme.colors.text,
                        borderColor: theme.colors.border,
                        fontSize: fontSize.sizes.body,
                      }
                    ]}
                    placeholder="#C9F2DF"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={hexInput}
                    onChangeText={setHexInput}
                    maxLength={7}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={[styles.hexSubmitButton, { backgroundColor: '#007AFF' }]}
                    onPress={handleHexSubmit}
                  >
                    <Ionicons name="checkmark" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.hexHelperText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  Format: #RRGGBB (ex: #FF6B9D)
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      </ScrollView>
      {/* Modal récapitulatif matinal */}
      <Modal
        visible={showMorningPickerModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMorningPickerModal(false)}
      >
        <View style={styles.timeModalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowMorningPickerModal(false)} />
          <View style={[styles.timeModalContent, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.timeModalHandle, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.timeModalTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              Récapitulatif matinal
            </Text>
            <Text style={[styles.timeModalSummary, { color: theme.colors.iconActive }]}>
              {tempMorningHour.toString().padStart(2, '0')}:{tempMorningMinute.toString().padStart(2, '0')}
            </Text>
            <View style={[styles.timeModalPickerContainer, { backgroundColor: theme.colors.post, borderColor: theme.colors.border }]}>
              <DrumPicker
                items={HOURS}
                value={tempMorningHour}
                onChange={setTempMorningHour}
                theme={theme}
                cardBackground={theme.colors.post}
                formatItem={(v) => v.toString().padStart(2, '0')}
              />
              <Text style={[styles.timePickerColon, { color: theme.colors.text }]}>:</Text>
              <DrumPicker
                items={DRUM_MINUTES}
                value={tempMorningMinute}
                onChange={setTempMorningMinute}
                theme={theme}
                cardBackground={theme.colors.post}
                formatItem={(v) => v.toString().padStart(2, '0')}
              />
            </View>
            <View style={styles.timeModalButtons}>
              <TouchableOpacity
                style={[styles.timeModalCancel, { backgroundColor: theme.colors.iconActive }]}
                onPress={() => setShowMorningPickerModal(false)}
              >
                <Text style={[styles.timeModalCancelText, { color: '#fff', fontSize: fontSize.sizes.body }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeModalConfirm, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  saveMorningSummary(tempMorningHour, tempMorningMinute);
                  setShowMorningPickerModal(false);
                }}
              >
                <Text style={[styles.timeModalConfirmText, { fontSize: fontSize.sizes.body }]}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal récapitulatif du soir */}
      <Modal
        visible={showEveningPickerModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEveningPickerModal(false)}
      >
        <View style={styles.timeModalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowEveningPickerModal(false)} />
          <View style={[styles.timeModalContent, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.timeModalHandle, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.timeModalTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              Récapitulatif du soir
            </Text>
            <Text style={[styles.timeModalSummary, { color: theme.colors.iconActive }]}>
              {tempEveningHour.toString().padStart(2, '0')}:{tempEveningMinute.toString().padStart(2, '0')}
            </Text>
            <View style={[styles.timeModalPickerContainer, { backgroundColor: theme.colors.post, borderColor: theme.colors.border }]}>
              <DrumPicker
                items={HOURS}
                value={tempEveningHour}
                onChange={setTempEveningHour}
                theme={theme}
                cardBackground={theme.colors.post}
                formatItem={(v) => v.toString().padStart(2, '0')}
              />
              <Text style={[styles.timePickerColon, { color: theme.colors.text }]}>:</Text>
              <DrumPicker
                items={DRUM_MINUTES}
                value={tempEveningMinute}
                onChange={setTempEveningMinute}
                theme={theme}
                cardBackground={theme.colors.post}
                formatItem={(v) => v.toString().padStart(2, '0')}
              />
            </View>
            <View style={styles.timeModalButtons}>
              <TouchableOpacity
                style={[styles.timeModalCancel, { backgroundColor: theme.colors.iconActive }]}
                onPress={() => setShowEveningPickerModal(false)}
              >
                <Text style={[styles.timeModalCancelText, { color: '#fff', fontSize: fontSize.sizes.body }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeModalConfirm, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  saveEveningSummary(tempEveningHour, tempEveningMinute);
                  setShowEveningPickerModal(false);
                }}
              >
                <Text style={[styles.timeModalConfirmText, { fontSize: fontSize.sizes.body }]}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal plage horaire */}
      <Modal
        visible={showTimePickerModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTimePickerModal(false)}
      >
        <View style={styles.timeModalOverlay}>
          {/* Backdrop : ferme le modal si on tape en dehors */}
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowTimePickerModal(false)}
          />
          {/* Contenu : séparé du backdrop, les ScrollViews fonctionnent normalement */}
          <View style={[styles.timeModalContent, { backgroundColor: theme.colors.background }]}>
              {/* Handle */}
              <View style={[styles.timeModalHandle, { backgroundColor: theme.colors.border }]} />

              <Text style={[styles.timeModalTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
                Plage horaire
              </Text>

              <Text style={[styles.timeModalSummary, { color: theme.colors.iconActive }]}>
                {tempStartHour.toString().padStart(2, '0')}:{tempStartMinute.toString().padStart(2, '0')} — {tempEndHour.toString().padStart(2, '0')}:{tempEndMinute.toString().padStart(2, '0')}
              </Text>

              {/* Pickers — une seule ligne unifiée HH:MM → HH:MM */}
              <View style={[styles.timeModalPickerContainer, { backgroundColor: theme.colors.post, borderColor: theme.colors.border }]}>
                <DrumPicker
                  items={HOURS}
                  value={tempStartHour}
                  onChange={setTempStartHour}
                  theme={theme}
                  cardBackground={theme.colors.post}
                  formatItem={(v) => v.toString().padStart(2, '0')}
                />
                <Text style={[styles.timePickerColon, { color: theme.colors.text }]}>:</Text>
                <DrumPicker
                  items={DRUM_MINUTES}
                  value={tempStartMinute}
                  onChange={setTempStartMinute}
                  theme={theme}
                  cardBackground={theme.colors.post}
                  formatItem={(v) => v.toString().padStart(2, '0')}
                />
                <Text style={[styles.timePickerArrow, { color: theme.colors.textSecondary }]}>→</Text>
                <DrumPicker
                  items={HOURS}
                  value={tempEndHour}
                  onChange={setTempEndHour}
                  theme={theme}
                  cardBackground={theme.colors.post}
                  formatItem={(v) => v.toString().padStart(2, '0')}
                />
                <Text style={[styles.timePickerColon, { color: theme.colors.text }]}>:</Text>
                <DrumPicker
                  items={DRUM_MINUTES}
                  value={tempEndMinute}
                  onChange={setTempEndMinute}
                  theme={theme}
                  cardBackground={theme.colors.post}
                  formatItem={(v) => v.toString().padStart(2, '0')}
                />
              </View>

              {/* Boutons */}
              <View style={styles.timeModalButtons}>
                <TouchableOpacity
                  style={[styles.timeModalCancel, { backgroundColor: theme.colors.iconActive }]}
                  onPress={() => setShowTimePickerModal(false)}
                >
                  <Text style={[styles.timeModalCancelText, { color: '#fff', fontSize: fontSize.sizes.body }]}>
                    Annuler
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.timeModalConfirm, { backgroundColor: theme.colors.primary }]}
                  onPress={() => {
                    setStartHour(tempStartHour);
                    setEndHour(tempEndHour);
                    setStartMinute(tempStartMinute);
                    setEndMinute(tempEndMinute);
                    saveNotificationPreferences(
                      notificationsEnabled, notificationType, selectedSeverities, selectedDays,
                      tempStartHour, tempEndHour, tempStartMinute, tempEndMinute
                    );
                    setShowTimePickerModal(false);
                  }}
                >
                  <Text style={[styles.timeModalConfirmText, { fontSize: fontSize.sizes.body }]}>
                    Confirmer
                  </Text>
                </TouchableOpacity>
              </View>
          </View>
        </View>
      </Modal>

      <ScreenGuide screenName="Options" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  meshGradientContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  meshGradient: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  pageHeader: {
    height: 120,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pageTitle: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  section: {
    padding: 20,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleAccent: {
    width: 4,
    height: 24,
    backgroundColor: '#C9F2DF',
    borderRadius: 2,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  themeContainer: {
    gap: 12,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  themeLabel: {
    fontSize: 18,
    fontWeight: '500',
    marginLeft: 16,
    flex: 1,
  },
  checkmark: {
    marginLeft: 'auto',
  },
  modernThemeContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  modernThemeCard: {
    width: '31%',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    minHeight: 90,
    justifyContent: 'center',
  },
  modernThemeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cityIcon: {
    width: 50,
    height: 50,
  },
  modernThemeLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    textAlign: 'center',
  },
  modernCheckmarkContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  premiumBadge: {
    position: 'absolute',
    bottom: -10,
    right: -5,
  },
  notificationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  notificationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationDivider: {
    width: 1,
    height: '65%',
    backgroundColor: '#999999',
    opacity: 0.5,
  },
  notificationContent: {
    flex: 1,
  },
  notificationLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    marginBottom: 2,
  },
  notificationSubLabel: {
    fontFamily: 'Fredoka_400Regular',
  },
  severityContainer: {
    marginTop: 8,
  },
  filterLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    marginBottom: 12,
  },
  helperText: {
    fontFamily: 'Fredoka_400Regular',
    fontStyle: 'italic',
  },
  severityCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  severityCard: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    minHeight: 100,
    justifyContent: 'center',
  },
  severityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  severityCardLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    textAlign: 'center',
  },
  severityOptions: {
    gap: 12,
  },
  severityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
  },
  severityLabel: {
    fontFamily: 'Fredoka_500Medium',
  },
  severityCheckmark: {
    marginLeft: 8,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'start',
  },
  dayChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  dayLabel: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  timeRangeTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 0,
    gap: 12,
  },
  timeRangeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeRangeInfo: {
    flex: 1,
    gap: 2,
  },
  timeRangeInfoLabel: {
    fontFamily: 'Fredoka_400Regular',
  },
  timeRangeInfoValue: {
    fontFamily: 'Fredoka_700Bold',
  },
  timeModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  timeModalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 44,
    alignItems: 'center',
    gap: 20,
  },
  timeModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  timeModalTitle: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  timeModalSummary: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 32,
    letterSpacing: 1,
  },
  timeModalPickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
    paddingHorizontal: 4,
  },
  timeModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  timeModalCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  timeModalCancelText: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  timeModalConfirm: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  timeModalConfirmText: {
    fontFamily: 'Fredoka_600SemiBold',
    color: '#1a1a1a',
  },
  timePickerRow: {
    flexDirection: 'row',
  },
  timePickerColumn: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 10,
    gap: 6,
  },
  timePickerLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.5,
  },
  timePickerHMRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timePickerColon: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
    paddingHorizontal: 2,
    zIndex: 3,
  },
  timePickerArrow: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    paddingHorizontal: 6,
    zIndex: 3,
  },
  timePickerDivider: {
    width: 1,
    marginVertical: 20,
  },
  timeRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timeRangeIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timeRangeTextContainer: {
    flex: 1,
    gap: 4,
  },
  timeRangeLabel: {
    fontFamily: 'Fredoka_400Regular',
  },
  timeRangeValue: {
    fontFamily: 'Fredoka_700Bold',
  },
  timeRangeContainer: {
    gap: 16,
  },
  timeSelector: {
    gap: 8,
  },
  timeLabel: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  hourScroll: {
    maxHeight: 50,
  },
  hourScrollContent: {
    gap: 8,
    paddingRight: 8,
  },
  hourChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  hourText: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  accountIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountDivider: {
    width: 1,
    height: '65%',
    backgroundColor: '#999999',
    opacity: 0.5,
  },
  accountContent: {
    flex: 1,
  },
  accountLabel: {
    fontFamily: 'Fredoka_500Medium',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    textAlign: 'center',
  },
  modalBody: {
    gap: 12,
  },
  inputLabel: {
    fontFamily: 'Fredoka_500Medium',
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontFamily: 'Fredoka_400Regular',
    marginBottom: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontFamily: 'Fredoka_600SemiBold',
    textAlign: 'center',
    width: '100%',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  modalButtonSecondary: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalButtonSecondaryText: {
    fontFamily: 'Fredoka_600SemiBold',
    textAlign: 'center',
    width: '100%',
  },
  introContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  introText: {
    fontFamily: 'Fredoka_400Regular',
    textAlign: 'center',
    flex: 1,
  },
  colorPickerContainer: {
    marginTop: 16,
  },
  colorPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  colorPreview: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  colorPickerButtonText: {
    fontFamily: 'Fredoka_600SemiBold',
    flex: 1,
  },
  colorPickerModal: {
    width: '90%',
    maxWidth: 500,
    borderRadius: 20,
    padding: 20,
    height: '80%',
  },
  colorPickerContent: {
    maxHeight: 500,
  },
  colorPickerScrollContent: {
    paddingBottom: 20,
  },
  currentColorSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  sectionLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    marginBottom: 16,
    textAlign: 'center',
  },
  currentColorDisplay: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  colorPreviewLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  colorHexValue: {
    fontFamily: 'Fredoka_600SemiBold',
    letterSpacing: 1.5,
    fontSize: 16,
  },
  paletteSection: {
    marginBottom: 12,
    alignItems: 'center',
  },
  colorPaletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    maxWidth: 320,
  },
  colorOption: {
    width: 55,
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hexInputSection: {
    marginBottom: 16,
  },
  hexInputContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontFamily: 'Fredoka_500Medium',
  },
  hexSubmitButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hexHelperText: {
    fontFamily: 'Fredoka_400Regular',
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Styles pour la section Admin
  adminContainer: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginTop: 10,
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  adminTitle: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  adminDescription: {
    fontFamily: 'Fredoka_400Regular',
    marginBottom: 15,
    lineHeight: 20,
  },
  adminInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontFamily: 'Fredoka_500Medium',
    marginBottom: 15,
  },
  adminButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  adminButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    gap: 8,
  },
  adminButtonActivate: {
    backgroundColor: '#4CAF50',
  },
  adminButtonDeactivate: {
    backgroundColor: '#DC3545',
  },
  adminButtonDisabled: {
    opacity: 0.5,
  },
  adminButtonText: {
    color: '#fff',
    fontFamily: 'Fredoka_600SemiBold',
  },
});
