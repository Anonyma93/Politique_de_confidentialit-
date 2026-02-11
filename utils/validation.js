/**
 * Utilitaires de validation et de sanitization pour sécuriser l'application
 */

/**
 * Sanitize du texte pour prévenir les attaques XSS
 * @param {string} text - Texte à nettoyer
 * @returns {string} - Texte nettoyé
 */
export const sanitizeText = (text) => {
  if (typeof text !== 'string') {
    return '';
  }

  // Dans React Native, les composants Text n'interprètent pas le HTML,
  // donc on n'a pas besoin d'encoder les entités HTML.
  // On se contente de supprimer les balises HTML potentiellement dangereuses.
  return text
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Supprimer les scripts
    .replace(/<[^>]+>/g, '') // Supprimer toutes les balises HTML
    .trim();
};

/**
 * Valider un post avant de l'enregistrer
 * @param {Object} postData - Données du post
 * @returns {Object} - { valid: boolean, error: string }
 */
export const validatePost = (postData) => {
  // Vérifier que les champs requis existent
  if (!postData.line || typeof postData.line !== 'string') {
    return { valid: false, error: 'La ligne est requise' };
  }

  if (!postData.station || typeof postData.station !== 'string') {
    return { valid: false, error: 'La station est requise' };
  }

  if (!postData.comment || typeof postData.comment !== 'string') {
    return { valid: false, error: 'Le commentaire est requis' };
  }

  if (!postData.severity || typeof postData.severity !== 'string') {
    return { valid: false, error: 'La gravité est requise' };
  }

  if (!postData.type || typeof postData.type !== 'string') {
    return { valid: false, error: 'Le type est requis' };
  }

  // Vérifier les longueurs
  if (postData.line.length > 50) {
    return { valid: false, error: 'Le nom de la ligne est trop long (max 50 caractères)' };
  }

  if (postData.station.length > 100) {
    return { valid: false, error: 'Le nom de la station est trop long (max 100 caractères)' };
  }

  if (postData.comment.length < 1) {
    return { valid: false, error: 'Le commentaire ne peut pas être vide' };
  }

  if (postData.comment.length > 500) {
    return { valid: false, error: 'Le commentaire est trop long (max 500 caractères)' };
  }

  // Vérifier les valeurs valides
  const validSeverities = ['sans', 'minime', 'perturbe', 'tres_perturbe', 'interrompu'];
  if (!validSeverities.includes(postData.severity)) {
    return { valid: false, error: 'Gravité invalide' };
  }

  const validTypes = ['incident', 'information'];
  if (!validTypes.includes(postData.type)) {
    return { valid: false, error: 'Type invalide' };
  }

  // Vérifier la destination si elle existe
  if (postData.destination && postData.destination.length > 100) {
    return { valid: false, error: 'La destination est trop longue (max 100 caractères)' };
  }

  // Vérifier l'incident si il existe
  if (postData.incident && postData.incident.length > 100) {
    return { valid: false, error: 'Le motif de l\'incident est trop long (max 100 caractères)' };
  }

  return { valid: true };
};

/**
 * Sanitize les données d'un post
 * @param {Object} postData - Données du post
 * @returns {Object} - Données nettoyées
 */
export const sanitizePostData = (postData) => {
  return {
    ...postData,
    line: sanitizeText(postData.line),
    station: sanitizeText(postData.station),
    comment: sanitizeText(postData.comment),
    destination: postData.destination ? sanitizeText(postData.destination) : '',
    incident: postData.incident ? sanitizeText(postData.incident) : '',
    direction: postData.direction ? sanitizeText(postData.direction) : '',
  };
};

/**
 * Valider un commentaire
 * @param {string} text - Texte du commentaire
 * @returns {Object} - { valid: boolean, error: string }
 */
export const validateComment = (text) => {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: 'Le commentaire est requis' };
  }

  if (text.trim().length < 1) {
    return { valid: false, error: 'Le commentaire ne peut pas être vide' };
  }

  if (text.length > 500) {
    return { valid: false, error: 'Le commentaire est trop long (max 500 caractères)' };
  }

  return { valid: true };
};

/**
 * Valider un nom d'utilisateur
 * @param {string} name - Nom à valider
 * @returns {Object} - { valid: boolean, error: string }
 */
export const validateUserName = (name) => {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Le nom est requis' };
  }

  if (name.trim().length < 1) {
    return { valid: false, error: 'Le nom ne peut pas être vide' };
  }

  if (name.length > 50) {
    return { valid: false, error: 'Le nom est trop long (max 50 caractères)' };
  }

  return { valid: true };
};

/**
 * Valider une adresse email
 * @param {string} email - Email à valider
 * @returns {Object} - { valid: boolean, error: string }
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'L\'email est requis' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Email invalide' };
  }

  if (email.length > 254) {
    return { valid: false, error: 'Email trop long' };
  }

  return { valid: true };
};

/**
 * Vérifier si du contenu contient des patterns suspects (spam, injection, etc.)
 * @param {string} text - Texte à vérifier
 * @returns {boolean} - true si le texte semble suspect
 */
export const containsSuspiciousContent = (text) => {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Patterns suspects
  const suspiciousPatterns = [
    /<script/i,                    // Script tags
    /javascript:/i,                // JavaScript protocol
    /on\w+\s*=/i,                 // Event handlers (onclick, onload, etc.)
    /eval\(/i,                     // eval()
    /document\./i,                 // document object
    /window\./i,                   // window object
    /<iframe/i,                    // iframes
    /<embed/i,                     // embed tags
    /<object/i,                    // object tags
  ];

  return suspiciousPatterns.some(pattern => pattern.test(text));
};

/**
 * Valeurs autorisées pour la durée estimée d'un incident
 */
export const VALID_DURATIONS = [
  null,        // Non spécifié
  '15min',     // 15 minutes
  '30min',     // 30 minutes
  '1h',        // 1 heure
  '2h',        // 2 heures
  'half_day',  // Demi-journée
  'full_day',  // Journée entière
  'unknown',   // Indéterminée
];

/**
 * Valider une durée estimée
 * @param {string|null} duration - Durée à valider
 * @returns {Object} - { valid: boolean, error: string }
 */
export const validateEstimatedDuration = (duration) => {
  // null est autorisé (non spécifié)
  if (duration === null || duration === undefined) {
    return { valid: true };
  }

  if (typeof duration !== 'string') {
    return { valid: false, error: 'La durée doit être une chaîne de caractères' };
  }

  if (!VALID_DURATIONS.includes(duration)) {
    return { valid: false, error: 'Durée invalide' };
  }

  return { valid: true };
};
