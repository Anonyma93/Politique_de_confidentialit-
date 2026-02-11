// Script pour nettoyer les anciens tokens FCM
const admin = require('firebase-admin');
const serviceAccount = require('./functions/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanupOldTokens() {
  try {
    console.log('🧹 Nettoyage des anciens tokens FCM...');

    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    let count = 0;
    const batch = db.batch();

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken || data.fcmTokenType) {
        console.log(`🧹 Nettoyage pour utilisateur: ${doc.id}`);
        batch.update(doc.ref, {
          fcmToken: admin.firestore.FieldValue.delete(),
          fcmTokenType: admin.firestore.FieldValue.delete()
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`✅ ${count} utilisateur(s) nettoyé(s)`);
    } else {
      console.log('ℹ️ Aucun ancien token à nettoyer');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

cleanupOldTokens();
