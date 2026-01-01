/**
 * Cloud Functions pour Lini
 *
 * Cette fonction supprime automatiquement tous les posts à 4h00 du matin
 * tous les jours, tout en préservant les statistiques des utilisateurs.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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
