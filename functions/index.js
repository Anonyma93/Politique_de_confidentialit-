/**
 * Cloud Functions pour Lini
 *
 * - Reset quotidien des posts à 4h00 du matin
 * - Notifications push pour les lignes préférées
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

// Initialiser Firebase Admin
initializeApp();
const db = getFirestore();

/**
 * Fonction planifiée : Reset des posts quotidien à 4h00 du matin (heure de Paris)
 *
 * Cron: '0 4 * * *' = Tous les jours à 4h00
 * Timezone: 'Europe/Paris' = Heure de Paris (gère automatiquement été/hiver)
 *
 * Cette fonction :
 * - Supprime TOUS les documents de la collection 'posts'
 * - NE TOUCHE PAS à la collection 'users' (stats préservées)
 * - Garde intact : postsCount, likesCount, userScore, engagementRate, grade
 */
exports.resetPostsDaily = onSchedule(
  {
    schedule: '0 4 * * *', // Tous les jours à 4h00
    timeZone: 'Europe/Paris', // Fuseau horaire de Paris
    memory: '256MiB', // Mémoire allouée
    region: 'europe-west1', // Région européenne (proche de Paris)
  },
  async (event) => {
    console.log('🔄 Démarrage du reset quotidien des posts...');
    console.log(`⏰ Heure d'exécution: ${new Date().toISOString()}`);

    try {
      // Récupérer tous les posts
      const postsRef = db.collection('posts');
      const snapshot = await postsRef.get();

      if (snapshot.empty) {
        console.log('ℹ️ Aucun post à supprimer');
        return {
          success: true,
          deletedCount: 0,
          message: 'Aucun post à supprimer'
        };
      }

      // Supprimer tous les posts par batch (max 500 par batch)
      const batchSize = 500;
      let deletedCount = 0;

      // Firestore limite à 500 opérations par batch
      const batches = [];
      let currentBatch = db.batch();
      let operationCount = 0;

      snapshot.docs.forEach((doc) => {
        currentBatch.delete(doc.ref);
        operationCount++;
        deletedCount++;

        // Si on atteint 500 opérations, créer un nouveau batch
        if (operationCount === batchSize) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          operationCount = 0;
        }
      });

      // Ajouter le dernier batch s'il contient des opérations
      if (operationCount > 0) {
        batches.push(currentBatch);
      }

      // Exécuter tous les batches
      console.log(`📦 Exécution de ${batches.length} batch(es) de suppression...`);
      await Promise.all(batches.map(batch => batch.commit()));

      console.log(`✅ Reset terminé avec succès`);
      console.log(`🗑️ ${deletedCount} posts supprimés`);
      console.log(`👥 Les statistiques utilisateurs sont préservées`);

      return {
        success: true,
        deletedCount: deletedCount,
        timestamp: new Date().toISOString(),
        message: `${deletedCount} posts supprimés avec succès`
      };

    } catch (error) {
      console.error('❌ Erreur lors du reset des posts:', error);

      // Ne pas throw l'erreur pour éviter les retry automatiques
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
);

/**
 * IMPORTANT: Les statistiques utilisateurs ne sont PAS affectées
 *
 * La collection 'users' contient :
 * - postsCount: Nombre total de posts créés (historique)
 * - likesCount: Nombre total de likes reçus (historique)
 * - userScore: Score calculé basé sur l'engagement
 * - engagementRate: Taux d'engagement (likes/posts)
 * - grade: Grade automatique basé sur le score
 *
 * Ces données restent intactes et continuent d'évoluer avec l'activité.
 */

/**
 * Vérifier si on doit envoyer une notification selon les préférences utilisateur
 */
const shouldSendNotificationToUser = (userData, postData) => {
  // Vérifier si les notifications sont activées
  if (userData.notificationsEnabled === false) {
    return { should: false, reason: 'Notifications disabled' };
  }

  // Vérifier la gravité
  if (userData.selectedSeverities && Array.isArray(userData.selectedSeverities)) {
    if (!userData.selectedSeverities.includes(postData.severity)) {
      return { should: false, reason: `Severity ${postData.severity} not in preferences` };
    }
  }

  // Vérifier le jour de la semaine (fuseau horaire Europe/Paris)
  if (userData.selectedDays && Array.isArray(userData.selectedDays)) {
    const now = new Date();
    // Convertir en heure de Paris (UTC+1 ou UTC+2 selon été/hiver)
    const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const currentDay = parisTime.getDay();
    if (!userData.selectedDays.includes(currentDay)) {
      return { should: false, reason: `Day ${currentDay} not in preferences` };
    }
  }

  // Vérifier l'heure (fuseau horaire Europe/Paris)
  if (userData.startHour !== undefined && userData.endHour !== undefined) {
    const now = new Date();
    const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const currentHour = parisTime.getHours();
    const startHour = userData.startHour;
    const endHour = userData.endHour;

    // Gérer les plages horaires qui traversent minuit (ex: 23h-1h)
    if (startHour <= endHour) {
      // Plage normale (ex: 8h-18h)
      if (currentHour < startHour || currentHour >= endHour) {
        return { should: false, reason: `Hour ${currentHour} outside range ${startHour}-${endHour}` };
      }
    } else {
      // Plage qui traverse minuit (ex: 23h-1h)
      if (currentHour < startHour && currentHour >= endHour) {
        return { should: false, reason: `Hour ${currentHour} outside range ${startHour}-${endHour}` };
      }
    }
  }

  return { should: true };
};

/**
 * Fonction déclenchée : Envoyer des notifications push quand un post est créé
 *
 * Cette fonction :
 * - Se déclenche automatiquement quand un nouveau post est créé dans Firestore
 * - Récupère tous les utilisateurs qui ont la ligne du post dans leurs préférences
 * - Vérifie les préférences de notification (plage horaire, jours, sévérité)
 * - Envoie une notification push aux utilisateurs concernés (s'ils ont un token FCM)
 * - Ne notifie PAS l'auteur du post
 */
exports.sendNotificationOnNewPost = onDocumentCreated(
  {
    document: 'posts/{postId}',
    region: 'europe-west1',
  },
  async (event) => {
    try {
      const postData = event.data.data();
      const postId = event.params.postId;

      console.log(`📢 Nouveau post créé: ${postId}`);
      console.log(`📍 Ligne: ${postData.line}, Station: ${postData.station}, Sévérité: ${postData.severity}`);

      // Récupérer tous les utilisateurs qui ont cette ligne dans leurs préférences
      const usersRef = db.collection('users');
      const snapshot = await usersRef
        .where('preferredLines', 'array-contains', postData.line)
        .get();

      if (snapshot.empty) {
        console.log('ℹ️ Aucun utilisateur n\'a cette ligne en préférence');
        return { success: true, notificationsSent: 0 };
      }

      console.log(`👥 ${snapshot.size} utilisateur(s) concerné(s)`);

      // Préparer les notifications
      const notifications = [];
      const severityEmojis = {
        sans: '✅',
        minime: '⚠️',
        perturbe: '🚨',
        tres_perturbe: '🔴',
        interrompu: '🛑',
      };

      const severityLabels = {
        sans: 'Sans perturbation',
        minime: 'Perturbation minime',
        perturbe: 'Perturbé',
        tres_perturbe: 'Très perturbé',
        interrompu: 'Interrompu',
      };

      let skippedCount = 0;

      snapshot.docs.forEach((doc) => {
        const userData = doc.data();
        const userId = doc.id;

        // Ne pas notifier l'auteur du post
        if (userId === postData.userId) {
          console.log(`⏭️ Skipping author: ${userId}`);
          skippedCount++;
          return;
        }

        // Vérifier si l'utilisateur a un token FCM
        if (!userData.fcmToken) {
          console.log(`⏭️ No FCM token for user: ${userId}`);
          skippedCount++;
          return;
        }

        // Vérifier les préférences de notification (plage horaire, jours, sévérité)
        const check = shouldSendNotificationToUser(userData, postData);
        if (!check.should) {
          console.log(`⏭️ User ${userId}: ${check.reason}`);
          skippedCount++;
          return;
        }

        const emoji = severityEmojis[postData.severity] || '📢';
        const severityLabel = severityLabels[postData.severity] || postData.severity;

        // Créer le message de notification FCM
        const message = {
          token: userData.fcmToken,
          notification: {
            title: `${emoji} ${postData.line} - ${postData.incident}`,
            body: `${severityLabel} à ${postData.station}`,
          },
          data: {
            postId: postId,
            line: postData.line,
            station: postData.station,
            severity: postData.severity || '',
            incident: postData.incident || '',
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
          android: {
            notification: {
              sound: 'default',
              channelId: 'incidents',
            },
          },
        };

        notifications.push(message);
      });

      console.log(`📊 Résumé: ${notifications.length} notification(s) à envoyer, ${skippedCount} utilisateur(s) ignoré(s)`);

      if (notifications.length === 0) {
        console.log('ℹ️ Aucune notification à envoyer');
        return { success: true, notificationsSent: 0 };
      }

      // Envoyer les notifications via Firebase Cloud Messaging
      console.log(`📤 Envoi de ${notifications.length} notification(s) via FCM...`);
      const results = await getMessaging().sendEach(notifications);

      console.log(`✅ ${results.successCount} notification(s) envoyée(s)`);
      if (results.failureCount > 0) {
        console.log(`❌ ${results.failureCount} échec(s)`);
        results.responses.forEach((response, idx) => {
          if (!response.success) {
            console.error(`❌ Erreur pour notification ${idx}:`, response.error);
          }
        });
      }

      return {
        success: true,
        notificationsSent: results.successCount,
        failures: results.failureCount,
      };

    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi des notifications:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
);

/**
 * Fonction déclenchée : Envoyer des notifications push quand un commentaire est créé
 *
 * Cette fonction :
 * - Se déclenche automatiquement quand un nouveau commentaire est créé dans Firestore
 * - Récupère le post associé pour trouver l'auteur du post
 * - Envoie une notification push à l'auteur du post (s'il a un token FCM)
 * - Ne notifie PAS l'auteur du commentaire
 */
exports.sendNotificationOnNewComment = onDocumentCreated(
  {
    document: 'comments/{commentId}',
    region: 'europe-west1',
  },
  async (event) => {
    try {
      const commentData = event.data.data();
      const commentId = event.params.commentId;

      console.log(`💬 Nouveau commentaire créé: ${commentId}`);
      console.log(`📝 Post: ${commentData.postId}, Par: ${commentData.userDisplayName}`);

      // Récupérer le post pour obtenir l'auteur
      const postRef = db.collection('posts').doc(commentData.postId);
      const postDoc = await postRef.get();

      if (!postDoc.exists) {
        console.log('⚠️ Post introuvable');
        return { success: false, error: 'Post not found' };
      }

      const postData = postDoc.data();
      const postAuthorId = postData.userId;

      console.log(`👤 Auteur du post: ${postAuthorId}`);

      // Ne pas notifier si l'auteur du commentaire est aussi l'auteur du post
      if (commentData.userId === postAuthorId) {
        console.log('⏭️ L\'auteur commente son propre post, pas de notification');
        return { success: true, notificationsSent: 0, skipped: 'self-comment' };
      }

      // Récupérer les données de l'auteur du post
      const postAuthorRef = db.collection('users').doc(postAuthorId);
      const postAuthorDoc = await postAuthorRef.get();

      if (!postAuthorDoc.exists) {
        console.log('⚠️ Auteur du post introuvable dans users');
        return { success: false, error: 'Post author not found' };
      }

      const postAuthorData = postAuthorDoc.data();

      // Vérifier si l'auteur a un token FCM
      if (!postAuthorData.fcmToken) {
        console.log('⏭️ L\'auteur du post n\'a pas de token FCM');
        return { success: true, notificationsSent: 0, skipped: 'no-fcm-token' };
      }

      // Vérifier si les notifications sont activées pour l'auteur
      if (postAuthorData.notificationsEnabled === false) {
        console.log('⏭️ Notifications désactivées pour l\'auteur du post');
        return { success: true, notificationsSent: 0, skipped: 'notifications-disabled' };
      }

      // Créer le message de notification FCM
      const message = {
        token: postAuthorData.fcmToken,
        notification: {
          title: `💬 Nouveau commentaire de ${commentData.userDisplayName}`,
          body: commentData.text,
        },
        data: {
          type: 'comment',
          commentId: commentId,
          postId: commentData.postId,
          userId: commentData.userId,
          userDisplayName: commentData.userDisplayName || '',
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        android: {
          notification: {
            sound: 'default',
            channelId: 'comments',
          },
        },
      };

      // Envoyer la notification via FCM
      console.log('📤 Envoi de la notification via FCM...');
      const result = await getMessaging().send(message);

      console.log('✅ Notification envoyée avec succès:', result);

      return {
        success: true,
        notificationsSent: 1,
        messageId: result,
      };

    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de la notification:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
);
