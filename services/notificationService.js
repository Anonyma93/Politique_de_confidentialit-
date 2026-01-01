import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Demander les permissions de notification
export const requestNotificationPermissions = async () => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return { success: false, error: 'Permission refusée' };
    }

    // Configuration pour iOS
    if (Platform.OS === 'ios') {
      await Notifications.setNotificationCategoryAsync('incident', [
        {
          identifier: 'view',
          buttonTitle: 'Voir',
          options: {
            opensAppToForeground: true,
          },
        },
      ]);
    }

    return { success: true };
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return { success: false, error: error.message };
  }
};

// Vérifier si on doit envoyer une notification selon les préférences
export const shouldSendNotification = async (post) => {
  try {
    // Vérifier si les notifications sont activées
    const notificationsEnabled = await AsyncStorage.getItem('notificationsEnabled');
    if (notificationsEnabled !== 'true') {
      return false;
    }

    // Vérifier la gravité
    const selectedSeveritiesStr = await AsyncStorage.getItem('selectedSeverities');
    if (selectedSeveritiesStr) {
      const selectedSeverities = JSON.parse(selectedSeveritiesStr);
      if (!selectedSeverities.includes(post.severity)) {
        return false;
      }
    }

    // Vérifier le jour de la semaine
    const selectedDaysStr = await AsyncStorage.getItem('selectedDays');
    if (selectedDaysStr) {
      const selectedDays = JSON.parse(selectedDaysStr);
      const currentDay = new Date().getDay();
      if (!selectedDays.includes(currentDay)) {
        return false;
      }
    }

    // Vérifier l'heure
    const startHourStr = await AsyncStorage.getItem('startHour');
    const endHourStr = await AsyncStorage.getItem('endHour');
    if (startHourStr && endHourStr) {
      const currentHour = new Date().getHours();
      const startHour = parseInt(startHourStr);
      const endHour = parseInt(endHourStr);

      // Gérer les plages horaires qui traversent minuit (ex: 23h-1h)
      if (startHour <= endHour) {
        // Plage normale (ex: 8h-18h)
        if (currentHour < startHour || currentHour >= endHour) {
          return false;
        }
      } else {
        // Plage qui traverse minuit (ex: 23h-1h)
        if (currentHour < startHour && currentHour >= endHour) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking notification preferences:', error);
    return false;
  }
};

// Envoyer une notification locale pour un incident
export const sendIncidentNotification = async (post, ligne) => {
  try {
    const severityLabels = {
      perturbe: 'Perturbé',
      tres_perturbe: 'Très perturbé',
      interrompu: 'Interrompu',
    };

    const severityEmojis = {
      perturbe: '⚠️',
      tres_perturbe: '🚨',
      interrompu: '🛑',
    };

    const emoji = severityEmojis[post.severity] || '📢';
    const severityLabel = severityLabels[post.severity] || post.severity;

    // Titre avec ligne ou station
    const title = ligne?.label
      ? `${emoji} Incident ${ligne.label}`
      : `${emoji} Incident à ${post.station}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: `${severityLabel} - ${post.incident} à ${post.station}`,
        data: {
          postId: post.id,
          line: post.line,
          station: post.station,
          severity: post.severity,
        },
        sound: true,
        badge: 1,
        categoryIdentifier: 'incident',
      },
      trigger: null, // Notification immédiate
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

// Effacer toutes les notifications
export const clearAllNotifications = async () => {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
    return { success: true };
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return { success: false, error: error.message };
  }
};

// Obtenir le badge count actuel
export const getBadgeCount = async () => {
  try {
    const count = await Notifications.getBadgeCountAsync();
    return count;
  } catch (error) {
    console.error('Error getting badge count:', error);
    return 0;
  }
};

// Définir le badge count
export const setBadgeCount = async (count) => {
  try {
    await Notifications.setBadgeCountAsync(count);
    return { success: true };
  } catch (error) {
    console.error('Error setting badge count:', error);
    return { success: false, error: error.message };
  }
};
