// Script pour activer le premium permanent pour un utilisateur
// Usage: node scripts/activatePremium.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, doc, updateDoc } = require('firebase/firestore');

// Configuration Firebase (utilise les mêmes credentials que l'app)
const firebaseConfig = {
  apiKey: "AIzaSyBpLRo4jbKFa8K9gOT8_1TcP1JFp_y6gAk",
  authDomain: "lini-c4f84.firebaseapp.com",
  projectId: "lini-c4f84",
  storageBucket: "lini-c4f84.firebasestorage.app",
  messagingSenderId: "424913653516",
  appId: "1:424913653516:web:9e4d8d5fbc0e6e8e1c8c0a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function activatePremium(email) {
  try {
    console.log(`🔍 Recherche de l'utilisateur: ${email}`);

    // Rechercher l'utilisateur par email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log('❌ Aucun utilisateur trouvé avec cet email');
      return;
    }

    const userDoc = querySnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    console.log(`📧 Utilisateur trouvé: ${userData.firstName} ${userData.lastName}`);
    console.log(`🆔 User ID: ${userId}`);

    // Mettre à jour le statut premium
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isPremium: true,
      premiumExpiresAt: null, // Premium permanent
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Premium activé avec succès!');
    console.log('💎 Statut: Premium Permanent');
    console.log('⏰ Expiration: Jamais');

  } catch (error) {
    console.error('❌ Erreur lors de l\'activation:', error);
  }

  process.exit(0);
}

// Email à activer
const emailToActivate = 'quentinmichaud93460@hotmail.fr';
activatePremium(emailToActivate);
