/**
 * Cloud Functions pour Lini
 *
 * - Reset quotidien des posts à 4h00 du matin
 * - Notifications push pour les lignes préférées
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { Expo } = require('expo-server-sdk');

// Initialiser Firebase Admin
initializeApp();
const db = getFirestore();

// Initialiser Expo Push Notification client
const expo = new Expo();

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
 * Vérifier si l'utilisateur est premium
 */
const isUserPremium = (userData) => {
  // Premium via RevenueCat (synchronisé dans Firestore)
  if (userData.isPremium === true) {
    return true;
  }
  // Premium manuel défini par admin
  if (userData.isManualPremium === true) {
    return true;
  }
  return false;
};

/**
 * Vérifier si on doit envoyer une notification selon les préférences utilisateur
 */
const shouldSendNotificationToUser = (userData, postData) => {
  // Vérifier si l'utilisateur est premium (notifications réservées aux premium)
  if (!isUserPremium(userData)) {
    return { should: false, reason: 'User is not premium' };
  }

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

      // Récupérer tous les utilisateurs qui ont cette ligne OU cette station dans leurs préférences
      const usersRef = db.collection('users');

      // Requête 1 : Utilisateurs avec cette ligne en préférence
      const lineSnapshot = await usersRef
        .where('preferredLines', 'array-contains', postData.line)
        .get();

      // Requête 2 : Utilisateurs avec cette station en préférence
      const stationSnapshot = await usersRef
        .where('preferredStations', 'array-contains', postData.station)
        .get();

      // Fusionner les résultats en éliminant les doublons
      const usersMap = new Map();
      lineSnapshot.docs.forEach(doc => {
        usersMap.set(doc.id, doc);
      });
      stationSnapshot.docs.forEach(doc => {
        if (!usersMap.has(doc.id)) {
          usersMap.set(doc.id, doc);
        }
      });

      const usersDocs = Array.from(usersMap.values());

      if (usersDocs.length === 0) {
        console.log('ℹ️ Aucun utilisateur n\'a cette ligne ou station en préférence');
        return { success: true, notificationsSent: 0 };
      }

      console.log(`👥 ${usersDocs.length} utilisateur(s) concerné(s) (${lineSnapshot.size} par ligne, ${stationSnapshot.size} par station)`);

      // Préparer les notifications
      const notifications = [];
      const severityLabels = {
        sans: 'Sans perturbation',
        minime: 'Perturbation minime',
        perturbe: 'Perturbé',
        tres_perturbe: 'Très perturbé',
        interrompu: 'Interrompu',
      };

      let skippedCount = 0;

      usersDocs.forEach((doc) => {
        const userData = doc.data();
        const userId = doc.id;

        // Vérifier le type de notification préféré de l'utilisateur
        const notificationType = userData.notificationType || 'both'; // Par défaut 'both' pour rétrocompatibilité

        // Vérifier si l'utilisateur correspond aux critères de notification selon son type
        const hasLineInPreferences = (userData.preferredLines || []).includes(postData.line);
        const hasStationInPreferences = (userData.preferredStations || []).includes(postData.station);

        let shouldNotify = false;
        if (notificationType === 'lines') {
          shouldNotify = hasLineInPreferences;
        } else if (notificationType === 'stations') {
          shouldNotify = hasStationInPreferences;
        } else { // 'both'
          shouldNotify = hasLineInPreferences || hasStationInPreferences;
        }

        // Si l'utilisateur ne correspond pas aux critères, passer au suivant
        if (!shouldNotify) {
          skippedCount++;
          console.log(`⏭️ Skipping user ${userId}: notificationType=${notificationType}, hasLine=${hasLineInPreferences}, hasStation=${hasStationInPreferences}`);
          return;
        }

        // Ne pas notifier l'auteur du post
        if (userId === postData.userId) {
          console.log(`⏭️ Skipping author: ${userId}`);
          skippedCount++;
          return;
        }

        // Vérifier si l'utilisateur a un token Expo Push
        if (!userData.expoPushToken) {
          console.log(`⏭️ No Expo Push token for user: ${userId}`);
          skippedCount++;
          return;
        }

        // Vérifier que le token est valide
        if (!Expo.isExpoPushToken(userData.expoPushToken)) {
          console.log(`⏭️ Invalid Expo Push token for user: ${userId}`);
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

        const severityLabel = severityLabels[postData.severity] || postData.severity;

        // Créer le message de notification Expo Push
        const message = {
          to: userData.expoPushToken,
          sound: 'default',
          title: `${postData.line} - ${postData.incident}`,
          body: `${severityLabel} à ${postData.station}`,
          data: {
            postId: postId,
            line: postData.line,
            station: postData.station,
            severity: postData.severity || '',
            incident: postData.incident || '',
          },
          badge: 1,
          channelId: 'incidents',
        };

        notifications.push(message);
      });

      console.log(`📊 Résumé: ${notifications.length} notification(s) à envoyer, ${skippedCount} utilisateur(s) ignoré(s)`);

      if (notifications.length === 0) {
        console.log('ℹ️ Aucune notification à envoyer');
        return { success: true, notificationsSent: 0 };
      }

      // Envoyer les notifications via Expo Push Notification Service
      console.log(`📤 Envoi de ${notifications.length} notification(s) via Expo Push...`);

      // Diviser en lots (chunks) - Expo recommande max 100 par requête
      const chunks = expo.chunkPushNotifications(notifications);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('❌ Erreur lors de l\'envoi d\'un chunk:', error);
        }
      }

      // Analyser les résultats
      let successCount = 0;
      let failureCount = 0;
      const cleanupPromises = [];

      tickets.forEach((ticket, idx) => {
        if (ticket.status === 'ok') {
          successCount++;
        } else if (ticket.status === 'error') {
          failureCount++;
          console.error(`❌ Erreur pour notification ${idx}:`, ticket.message);

          // Si le token est invalide (DeviceNotRegistered), le supprimer
          if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
            const invalidToken = notifications[idx].to;
            console.log('🧹 Nettoyage du token Expo invalide:', invalidToken);

            // Trouver l'utilisateur avec ce token et le supprimer
            const cleanupPromise = db.collection('users')
              .where('expoPushToken', '==', invalidToken)
              .get()
              .then((snapshot) => {
                const updates = [];
                snapshot.forEach((doc) => {
                  updates.push(doc.ref.update({
                    expoPushToken: null,
                    platform: null,
                  }));
                });
                return Promise.all(updates);
              })
              .then(() => {
                console.log('✅ Token invalide supprimé de la base de données');
              })
              .catch((cleanupError) => {
                console.error('❌ Erreur lors du nettoyage du token:', cleanupError);
              });

            cleanupPromises.push(cleanupPromise);
          }
        }
      });

      // Attendre que tous les nettoyages soient terminés
      await Promise.all(cleanupPromises);

      console.log(`✅ ${successCount} notification(s) envoyée(s)`);
      if (failureCount > 0) {
        console.log(`❌ ${failureCount} échec(s)`);
      }

      return {
        success: true,
        notificationsSent: successCount,
        failures: failureCount,
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

      // Vérifier si l'auteur a un token Expo Push
      if (!postAuthorData.expoPushToken) {
        console.log('⏭️ L\'auteur du post n\'a pas de token Expo Push');
        return { success: true, notificationsSent: 0, skipped: 'no-expo-push-token' };
      }

      // Vérifier que le token est valide
      if (!Expo.isExpoPushToken(postAuthorData.expoPushToken)) {
        console.log('⏭️ Token Expo Push invalide pour l\'auteur du post');
        return { success: true, notificationsSent: 0, skipped: 'invalid-token' };
      }

      // Vérifier si les notifications sont activées pour l'auteur
      if (postAuthorData.notificationsEnabled === false) {
        console.log('⏭️ Notifications désactivées pour l\'auteur du post');
        return { success: true, notificationsSent: 0, skipped: 'notifications-disabled' };
      }

      // Vérifier si l'auteur du post est premium
      if (!isUserPremium(postAuthorData)) {
        console.log('⏭️ L\'auteur du post n\'est pas premium');
        return { success: true, notificationsSent: 0, skipped: 'not-premium' };
      }

      // Créer le message de notification Expo Push avec plus de contexte
      const message = {
        to: postAuthorData.expoPushToken,
        sound: 'default',
        title: `${commentData.userDisplayName} a commenté votre post`,
        body: `${postData.line} - ${postData.station}: "${commentData.text.length > 80 ? commentData.text.substring(0, 80) + '...' : commentData.text}"`,
        data: {
          type: 'comment',
          commentId: commentId,
          postId: commentData.postId,
          userId: commentData.userId,
          userDisplayName: commentData.userDisplayName || '',
        },
        badge: 1,
        channelId: 'comments',
      };

      // Envoyer la notification via Expo Push
      console.log('📤 Envoi de la notification via Expo Push...');
      const tickets = await expo.sendPushNotificationsAsync([message]);
      const ticket = tickets[0];

      if (ticket.status === 'error') {
        console.error('❌ Erreur lors de l\'envoi:', ticket.message);

        // Si le token est invalide, le supprimer
        if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
          console.log('🧹 Nettoyage du token Expo invalide');
          await postAuthorRef.update({
            expoPushToken: null,
            platform: null,
          });
          return { success: true, notificationsSent: 0, skipped: 'invalid-token-cleaned' };
        }

        return { success: false, error: ticket.message };
      }

      console.log('✅ Notification envoyée avec succès:', ticket.id);

      return {
        success: true,
        notificationsSent: 1,
        ticketId: ticket.id,
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

/**
 * Fonction déclenchée : Envoyer des notifications push quand un post reçoit un like
 *
 * Cette fonction :
 * - Se déclenche automatiquement quand un post est mis à jour dans Firestore
 * - Vérifie si le champ likedBy a été modifié (nouveau like ajouté)
 * - Envoie une notification push à l'auteur du post (s'il a un token)
 * - Ne notifie PAS l'auteur du post s'il se like lui-même
 */
exports.sendNotificationOnNewLike = onDocumentUpdated(
  {
    document: 'posts/{postId}',
    region: 'europe-west1',
  },
  async (event) => {
    try {
      const beforeData = event.data.before.data();
      const afterData = event.data.after.data();
      const postId = event.params.postId;

      // Vérifier si likedBy a changé
      const beforeLikes = beforeData.likedBy || [];
      const afterLikes = afterData.likedBy || [];

      // Si aucun nouveau like, ne rien faire
      if (afterLikes.length <= beforeLikes.length) {
        return { success: true, notificationsSent: 0, skipped: 'no-new-like' };
      }

      // Trouver le nouveau like (utilisateur qui vient de liker)
      const newLikes = afterLikes.filter(uid => !beforeLikes.includes(uid));
      if (newLikes.length === 0) {
        return { success: true, notificationsSent: 0, skipped: 'no-new-like' };
      }

      // Prendre seulement le dernier like
      const likerUserId = newLikes[newLikes.length - 1];

      console.log(`❤️ Nouveau like sur post ${postId} par ${likerUserId}`);

      // Ne pas notifier si l'auteur like son propre post
      if (likerUserId === afterData.userId) {
        console.log('⏭️ L\'auteur a liké son propre post, pas de notification');
        return { success: true, notificationsSent: 0, skipped: 'self-like' };
      }

      // Récupérer les données de l'auteur du post
      const postAuthorRef = db.collection('users').doc(afterData.userId);
      const postAuthorDoc = await postAuthorRef.get();

      if (!postAuthorDoc.exists) {
        console.log('⚠️ Auteur du post introuvable');
        return { success: false, error: 'Post author not found' };
      }

      const postAuthorData = postAuthorDoc.data();

      // Vérifier si l'auteur a un token Expo Push
      if (!postAuthorData.expoPushToken || !Expo.isExpoPushToken(postAuthorData.expoPushToken)) {
        console.log('⏭️ Pas de token Expo Push valide pour l\'auteur');
        return { success: true, notificationsSent: 0, skipped: 'no-valid-token' };
      }

      // Vérifier si les notifications sont activées
      if (postAuthorData.notificationsEnabled === false) {
        console.log('⏭️ Notifications désactivées');
        return { success: true, notificationsSent: 0, skipped: 'notifications-disabled' };
      }

      // Vérifier si l'auteur du post est premium
      if (!isUserPremium(postAuthorData)) {
        console.log('⏭️ L\'auteur du post n\'est pas premium');
        return { success: true, notificationsSent: 0, skipped: 'not-premium' };
      }

      // Récupérer les infos du likeur
      const likerRef = db.collection('users').doc(likerUserId);
      const likerDoc = await likerRef.get();
      const likerName = likerDoc.exists ? (likerDoc.data().displayName || 'Un utilisateur') : 'Un utilisateur';

      // Créer le message de notification
      const likesCount = afterData.likesCount || afterLikes.length;
      const message = {
        to: postAuthorData.expoPushToken,
        sound: 'default',
        title: `${likerName} a aimé votre post`,
        body: `${afterData.line} - ${afterData.station} (${likesCount} like${likesCount > 1 ? 's' : ''})`,
        data: {
          type: 'like',
          postId: postId,
          userId: likerUserId,
          userDisplayName: likerName,
        },
        badge: 1,
        channelId: 'likes',
      };

      // Envoyer la notification
      console.log('📤 Envoi de la notification de like...');
      const tickets = await expo.sendPushNotificationsAsync([message]);
      const ticket = tickets[0];

      if (ticket.status === 'error') {
        console.error('❌ Erreur:', ticket.message);
        // Nettoyer le token invalide
        if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
          await postAuthorRef.update({ expoPushToken: null, platform: null });
        }
        return { success: false, error: ticket.message };
      }

      console.log('✅ Notification de like envoyée');
      return { success: true, notificationsSent: 1, ticketId: ticket.id };

    } catch (error) {
      console.error('❌ Erreur:', error);
      return { success: false, error: error.message };
    }
  }
);

/**
 * Fonction HTTP : Synchroniser les compteurs de commentaires pour tous les posts
 *
 * Cette fonction peut être appelée manuellement pour corriger les compteurs de commentaires
 * des posts existants qui n'ont pas le champ commentsCount ou qui ont un compteur incorrect.
 *
 * Pour appeler: POST https://<region>-<project-id>.cloudfunctions.net/syncCommentsCount
 */
exports.syncCommentsCount = onRequest(
  {
    region: 'europe-west1',
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      console.log('🔄 Démarrage de la synchronisation des compteurs de commentaires...');

      // Récupérer tous les posts
      const postsSnapshot = await db.collection('posts').get();
      console.log(`📊 ${postsSnapshot.size} posts trouvés`);

      if (postsSnapshot.empty) {
        console.log('ℹ️ Aucun post à traiter');
        return res.status(200).json({
          success: true,
          processed: 0,
          updated: 0,
          skipped: 0,
        });
      }

      let updatedCount = 0;
      let skippedCount = 0;
      const updates = [];

      // Traiter chaque post
      for (const postDoc of postsSnapshot.docs) {
        const postId = postDoc.id;
        const postData = postDoc.data();

        // Compter les commentaires réels pour ce post
        const commentsSnapshot = await db.collection('comments')
          .where('postId', '==', postId)
          .get();

        const actualCount = commentsSnapshot.size;
        const currentCount = postData.commentsCount;

        // Si le compteur est déjà correct, on le garde
        if (currentCount === actualCount) {
          console.log(`⏭️  Post ${postId}: compteur déjà correct (${actualCount})`);
          skippedCount++;
          continue;
        }

        // Mettre à jour le post avec le compteur correct
        const updatePromise = db.collection('posts').doc(postId).update({
          commentsCount: actualCount
        });

        updates.push(updatePromise);

        console.log(`✅ Post ${postId}: ${currentCount || 0} → ${actualCount} commentaire(s)`);
        updatedCount++;
      }

      // Exécuter toutes les mises à jour
      await Promise.all(updates);

      console.log('\n✨ Synchronisation terminée!');
      console.log(`   - ${updatedCount} posts mis à jour`);
      console.log(`   - ${skippedCount} posts ignorés (déjà corrects)`);

      return res.status(200).json({
        success: true,
        processed: postsSnapshot.size,
        updated: updatedCount,
        skipped: skippedCount,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * Fonction HTTP : Gérer le statut Premium d'un utilisateur (ADMIN UNIQUEMENT)
 *
 * Cette fonction permet à un administrateur d'activer ou désactiver le premium pour un utilisateur.
 * Sécurisée par vérification de l'email admin.
 *
 * POST /managePremium
 * Body: { adminEmail: string, userEmail: string, action: 'activate' | 'deactivate' }
 */
/**
 * Fonction planifiée : Envoyer le récapitulatif matinal des incidents
 *
 * Cette fonction s'exécute toutes les heures et envoie un résumé des incidents
 * aux utilisateurs qui ont activé cette option et dont l'heure correspond.
 *
 * Cron: '0 * * * *' = Toutes les heures à 00 minutes
 * Timezone: 'Europe/Paris' = Heure de Paris
 */
exports.sendMorningSummary = onSchedule(
  {
    schedule: '*/5 * * * *', // Toutes les 5 minutes
    timeZone: 'Europe/Paris',
    memory: '256MiB',
    region: 'europe-west1',
  },
  async (event) => {
    console.log('🌅 Démarrage du récapitulatif...');

    try {
      // Obtenir l'heure actuelle à Paris
      const now = new Date();
      const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
      const currentHour = parisTime.getHours();
      const currentMinute = parisTime.getMinutes();

      console.log(`⏰ Heure actuelle à Paris: ${currentHour}h${currentMinute.toString().padStart(2, '0')}`);

      // Récupérer les utilisateurs qui ont activé le récapitulatif matinal pour cette heure et cette minute
      const usersRef = db.collection('users');
      const morningSnapshot = await usersRef
        .where('morningSummaryEnabled', '==', true)
        .where('morningSummaryHour', '==', currentHour)
        .where('morningSummaryMinute', '==', currentMinute)
        .where('notificationsEnabled', '==', true)
        .get();

      // Récupérer les utilisateurs qui ont activé le récapitulatif du soir pour cette heure et cette minute
      const eveningSnapshot = await usersRef
        .where('eveningSummaryEnabled', '==', true)
        .where('eveningSummaryHour', '==', currentHour)
        .where('eveningSummaryMinute', '==', currentMinute)
        .where('notificationsEnabled', '==', true)
        .get();

      // Fusionner les résultats en éliminant les doublons, en gardant le type de récapitulatif
      const userMap = new Map();

      morningSnapshot.docs.forEach(doc => {
        userMap.set(doc.id, { doc, type: 'morning' });
      });

      eveningSnapshot.docs.forEach(doc => {
        if (userMap.has(doc.id)) {
          // L'utilisateur a les deux récaps à la même heure, envoyer celui du soir
          userMap.set(doc.id, { doc, type: 'evening' });
        } else {
          userMap.set(doc.id, { doc, type: 'evening' });
        }
      });

      if (userMap.size === 0) {
        console.log('ℹ️ Aucun utilisateur n\'a de récapitulatif prévu pour cette heure');
        return { success: true, notificationsSent: 0 };
      }

      console.log(`👥 ${userMap.size} utilisateur(s) à notifier (${morningSnapshot.size} matin, ${eveningSnapshot.size} soir)`);

      // Récupérer tous les posts actuels
      const postsSnapshot = await db.collection('posts')
        .orderBy('createdAt', 'desc')
        .get();

      const allPosts = postsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log(`📰 ${allPosts.length} posts actifs`);

      const notifications = [];
      let skippedCount = 0;

      // Pour chaque utilisateur
      for (const [userId, { doc: userDoc, type: summaryType }] of userMap) {
        const userData = userDoc.data();

        // Vérifier si l'utilisateur est premium
        if (!isUserPremium(userData)) {
          console.log(`⏭️ Utilisateur non premium: ${userId}`);
          skippedCount++;
          continue;
        }

        // Vérifier le token Expo Push
        if (!userData.expoPushToken || !Expo.isExpoPushToken(userData.expoPushToken)) {
          console.log(`⏭️ Pas de token valide pour: ${userId}`);
          skippedCount++;
          continue;
        }

        // Filtrer les posts par lignes préférées
        const preferredLines = userData.preferredLines || [];
        if (preferredLines.length === 0) {
          console.log(`⏭️ Pas de lignes préférées pour: ${userId}`);
          skippedCount++;
          continue;
        }

        const matchingPosts = allPosts.filter(post =>
          preferredLines.includes(post.line)
        );

        // Construire le message de résumé
        const isMorning = summaryType === 'morning';
        let title = isMorning ? 'Récapitulatif du matin' : 'Récapitulatif du soir';
        let body = '';

        if (matchingPosts.length === 0) {
          body = isMorning
            ? 'Aucun incident signalé sur vos lignes favorites. Bonne journée !'
            : 'Aucun incident signalé sur vos lignes favorites. Bonne soirée !';
        } else {
          // Regrouper par ligne
          const lineIncidents = {};
          matchingPosts.forEach(post => {
            if (!lineIncidents[post.line]) {
              lineIncidents[post.line] = 0;
            }
            lineIncidents[post.line]++;
          });

          const linesSummary = Object.entries(lineIncidents)
            .map(([line, count]) => `${line}: ${count}`)
            .join(', ');

          body = `${matchingPosts.length} incident(s) sur vos lignes: ${linesSummary}`;
        }

        const message = {
          to: userData.expoPushToken,
          sound: 'default',
          title: title,
          body: body,
          data: {
            type: isMorning ? 'morning_summary' : 'evening_summary',
            incidentsCount: matchingPosts.length,
          },
          badge: matchingPosts.length,
          channelId: 'summary',
        };

        notifications.push(message);
      }

      console.log(`📊 ${notifications.length} notification(s) à envoyer, ${skippedCount} ignoré(s)`);

      if (notifications.length === 0) {
        return { success: true, notificationsSent: 0 };
      }

      // Envoyer les notifications
      const chunks = expo.chunkPushNotifications(notifications);
      let successCount = 0;
      let failureCount = 0;

      for (const chunk of chunks) {
        try {
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          tickets.forEach((ticket, idx) => {
            if (ticket.status === 'ok') {
              successCount++;
            } else {
              failureCount++;
              console.error(`❌ Erreur: ${ticket.message}`);

              // Nettoyer les tokens invalides
              if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
                const invalidToken = notifications[idx]?.to;
                if (invalidToken) {
                  db.collection('users')
                    .where('expoPushToken', '==', invalidToken)
                    .get()
                    .then(snapshot => {
                      snapshot.forEach(doc => {
                        doc.ref.update({ expoPushToken: null, platform: null });
                      });
                    });
                }
              }
            }
          });
        } catch (error) {
          console.error('❌ Erreur lors de l\'envoi:', error);
        }
      }

      console.log(`✅ ${successCount} récapitulatif(s) envoyé(s), ${failureCount} échec(s)`);

      return {
        success: true,
        notificationsSent: successCount,
        failures: failureCount,
        hour: currentHour,
      };

    } catch (error) {
      console.error('❌ Erreur:', error);
      return { success: false, error: error.message };
    }
  }
);

exports.managePremium = onRequest(
  {
    region: 'europe-west1',
    memory: '256MiB',
  },
  async (req, res) => {
    // Vérifier que c'est une requête POST
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
      const { adminEmail, userEmail, action } = req.body;

      // Vérifier que tous les paramètres sont présents
      if (!adminEmail || !userEmail || !action) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: adminEmail, userEmail, action'
        });
      }

      // Vérifier que l'action est valide
      if (action !== 'activate' && action !== 'deactivate') {
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Must be "activate" or "deactivate"'
        });
      }

      // Email admin autorisé (à personnaliser)
      const ADMIN_EMAIL = 'quentinmichaud93460@hotmail.fr';

      // Vérifier que l'appelant est admin
      if (adminEmail !== ADMIN_EMAIL) {
        console.log(`❌ Tentative d'accès non autorisée par: ${adminEmail}`);
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Admin access required'
        });
      }

      console.log(`🔍 Admin ${adminEmail} - ${action} premium pour ${userEmail}`);

      // Rechercher l'utilisateur par email
      const usersRef = db.collection('users');
      const q = usersRef.where('email', '==', userEmail);
      const querySnapshot = await q.get();

      if (querySnapshot.empty) {
        console.log(`❌ Utilisateur non trouvé: ${userEmail}`);
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const userDoc = querySnapshot.docs[0];
      const userId = userDoc.id;
      const userData = userDoc.data();

      console.log(`✅ Utilisateur trouvé: ${userData.firstName} ${userData.lastName} (${userId})`);

      // Mettre à jour le statut premium
      const isPremium = action === 'activate';
      await db.collection('users').doc(userId).update({
        isManualPremium: isPremium,
        premiumExpiresAt: null, // Premium permanent
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ Premium ${isPremium ? 'activé' : 'désactivé'} pour ${userEmail}`);

      return res.status(200).json({
        success: true,
        userId: userId,
        isPremium: isPremium,
        message: `Premium ${isPremium ? 'activé' : 'désactivé'} avec succès`
      });

    } catch (error) {
      console.error('❌ Erreur:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);
