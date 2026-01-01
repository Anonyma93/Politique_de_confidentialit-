/**
 * Traduire les codes d'erreur Firebase en messages français clairs
 */
export const getFirebaseErrorMessage = (errorCode) => {
  const errorMessages = {
    // Erreurs d'authentification
    'auth/email-already-in-use': 'Cet email est déjà utilisé. Essayez de vous connecter ou utilisez un autre email.',
    'auth/invalid-email': 'L\'adresse email n\'est pas valide.',
    'auth/operation-not-allowed': 'L\'opération n\'est pas autorisée.',
    'auth/weak-password': 'Le mot de passe est trop faible. Utilisez au moins 6 caractères.',
    'auth/user-disabled': 'Ce compte a été désactivé.',
    'auth/user-not-found': 'Aucun compte ne correspond à cet email.',
    'auth/wrong-password': 'Email ou mot de passe incorrect.',
    'auth/invalid-credential': 'Les identifiants sont invalides.',
    'auth/too-many-requests': 'Trop de tentatives. Réessayez dans quelques minutes.',
    'auth/network-request-failed': 'Erreur de connexion. Vérifiez votre connexion internet.',

    // Erreurs Firestore
    'permission-denied': 'Vous n\'avez pas la permission d\'effectuer cette action.',
    'not-found': 'Document non trouvé.',
    'already-exists': 'Ce document existe déjà.',

    // Erreurs Storage
    'storage/unauthorized': 'Vous n\'êtes pas autorisé à uploader des fichiers.',
    'storage/canceled': 'L\'upload a été annulé.',
    'storage/unknown': 'Une erreur est survenue lors de l\'upload. Vérifiez que Firebase Storage est activé.',
    'storage/object-not-found': 'Fichier non trouvé.',
    'storage/quota-exceeded': 'Quota de stockage dépassé.',
    'storage/unauthenticated': 'Vous devez être connecté pour uploader des fichiers.',
  };

  return errorMessages[errorCode] || 'Une erreur est survenue. Veuillez réessayer.';
};

/**
 * Extraire le code d'erreur d'une erreur Firebase
 */
export const parseFirebaseError = (error) => {
  if (error.code) {
    return getFirebaseErrorMessage(error.code);
  }

  if (error.message) {
    // Essayer d'extraire le code depuis le message
    const match = error.message.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      return getFirebaseErrorMessage(match[1]);
    }
  }

  return 'Une erreur est survenue. Veuillez réessayer.';
};
