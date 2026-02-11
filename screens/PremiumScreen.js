import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { usePremium } from '../context/PremiumContext';
import { getCurrentUser } from '../services/authService';
import {
  getSubscriptionStatus,
  getAvailableSubscriptions,
  purchaseSubscription,
  restorePurchases,
  initializeIAP,
  disconnectIAP,
} from '../services/subscriptionService';

export default function PremiumScreen({ navigation }) {
  const { theme, fontSize } = useTheme();
  const { refreshPremiumStatus } = usePremium();
  const currentUser = getCurrentUser();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [products, setProducts] = useState([]);
  const [currentPackage, setCurrentPackage] = useState(null);

  useEffect(() => {
    loadSubscriptionInfo();

    return () => {
      disconnectIAP();
    };
  }, []);

  const loadSubscriptionInfo = async () => {
    setLoading(true);

    try {
      // Initialiser RevenueCat avec l'userId
      console.log('🔄 Initialisation RevenueCat...');
      await initializeIAP(currentUser?.uid);

      // Charger le statut
      if (currentUser) {
        console.log('🔄 Chargement statut subscription...');
        const status = await getSubscriptionStatus(currentUser.uid);
        console.log('📊 Statut subscription:', status);
        setSubscriptionStatus(status);
      }

      // Charger les produits depuis RevenueCat
      console.log('🔄 Chargement produits RevenueCat...');
      const productsResult = await getAvailableSubscriptions();
      console.log('📦 Produits:', productsResult);

      if (productsResult.success && productsResult.products.length > 0) {
        setProducts(productsResult.products);
        // Garder le package pour l'achat
        if (productsResult.offerings?.availablePackages?.length > 0) {
          console.log('✅ Package trouvé:', productsResult.offerings.availablePackages[0].identifier);
          setCurrentPackage(productsResult.offerings.availablePackages[0]);
        } else {
          console.log('⚠️ Pas de package disponible dans offerings');
        }
      } else {
        console.log('⚠️ Pas de produits disponibles');
      }
    } catch (error) {
      console.error('❌ Erreur chargement subscription info:', error);
    }

    setLoading(false);
  };

  const handlePurchase = async () => {
    console.log('🛒 handlePurchase appelé, currentPackage:', currentPackage);

    if (!currentPackage) {
      // Essayer de recharger les produits
      console.log('🔄 Tentative de rechargement des produits...');
      const productsResult = await getAvailableSubscriptions();

      if (productsResult.offerings?.availablePackages?.length > 0) {
        const pkg = productsResult.offerings.availablePackages[0];
        setCurrentPackage(pkg);
        console.log('✅ Package rechargé:', pkg.identifier);
        // Continuer avec l'achat
        setPurchasing(true);
        const result = await purchaseSubscription(currentUser.uid, pkg);
        if (result.success) {
          // Rafraîchir le statut premium dans le contexte global
          await refreshPremiumStatus();
          Alert.alert(
            'Abonnement activé !',
            'Merci pour votre soutien ! Profitez de Lini Premium.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        } else if (!result.canceled) {
          Alert.alert('Erreur', result.error || 'Une erreur est survenue.');
        }
        setPurchasing(false);
        return;
      }

      Alert.alert(
        'Produit non disponible',
        'L\'abonnement n\'est pas disponible pour le moment. Veuillez réessayer plus tard.\n\nDétails: ' + JSON.stringify(productsResult, null, 2)
      );
      return;
    }

    setPurchasing(true);

    const result = await purchaseSubscription(currentUser.uid, currentPackage);

    if (result.success) {
      // Rafraîchir le statut premium dans le contexte global
      await refreshPremiumStatus();
      Alert.alert(
        'Abonnement activé !',
        'Merci pour votre soutien ! Profitez de Lini Premium.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else if (!result.canceled) {
      Alert.alert(
        'Erreur',
        result.error || 'Une erreur est survenue lors de l\'achat. Veuillez réessayer.'
      );
    }

    setPurchasing(false);
  };

  const handleRestore = async () => {
    setLoading(true);

    const result = await restorePurchases(currentUser.uid);

    if (result.success && result.restored) {
      // Rafraîchir le statut premium dans le contexte global
      await refreshPremiumStatus();
      Alert.alert('Succès', 'Votre abonnement a été restauré !');
      await loadSubscriptionInfo();
    } else if (result.success) {
      Alert.alert('Information', 'Aucun abonnement à restaurer.');
    } else {
      Alert.alert('Erreur', 'Impossible de restaurer les achats.');
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.iconActive} />
      </View>
    );
  }

  // Prix depuis RevenueCat ou valeur par défaut
  const displayPrice = products.length > 0 ? products[0].price : '2,99 €';

  const advantages = [
    { icon: 'close-circle-outline', text: 'Aucune publicité', color: '#FF6B9D' },
    { icon: 'flash-outline', text: 'Expérience fluide et rapide', color: '#8CE9F6' },
    { icon: 'heart-outline', text: 'Soutenez le développement', color: '#F69B4C' },
    { icon: 'shield-checkmark-outline', text: 'Accès complet à toutes les fonctionnalités', color: '#9FFFB4' },
  ];

  const isPremium = subscriptionStatus?.isPremium || subscriptionStatus?.isSubscribed;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header avec gradient */}
      <LinearGradient
        colors={['#C9F2DF', '#8DE4C0', '#5DD6A0']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Ionicons name="diamond" size={48} color="#000" style={styles.diamondIcon} />
          <Text style={[styles.headerTitle, { fontSize: fontSize.sizes.title }]}>
            Lini Premium
          </Text>
          <Text style={[styles.headerSubtitle, { fontSize: fontSize.sizes.body }]}>
            L'expérience complète sans publicité
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* Statut actuel */}
        {subscriptionStatus && (
          <View style={[styles.statusCard, { backgroundColor: theme.colors.post, borderColor: theme.colors.border }]}>
            {isPremium ? (
              <>
                <Ionicons name="checkmark-circle" size={40} color="#5DD6A0" />
                <Text style={[styles.statusTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
                  Vous êtes Premium !
                </Text>
                <Text style={[styles.statusSubtitle, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  {subscriptionStatus.isManualPremium ? 'Activé manuellement' : 'Merci pour votre soutien'}
                </Text>
                {subscriptionStatus.expiresAt && (
                  <Text style={[styles.statusSubtitle, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small, marginTop: 4 }]}>
                    {subscriptionStatus.willRenew ? 'Renouvellement' : 'Expire'} le {new Date(subscriptionStatus.expiresAt).toLocaleDateString('fr-FR')}
                  </Text>
                )}

                {/* Bouton pour gérer l'abonnement */}
                {!subscriptionStatus.isManualPremium && (
                  <TouchableOpacity
                    style={[styles.manageButton, { borderColor: theme.colors.border }]}
                    onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
                  >
                    <Ionicons name="settings-outline" size={18} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
                    <Text style={[styles.manageButtonText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                      Gérer mon abonnement
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                <Ionicons name="information-circle" size={40} color="#8CE9F6" />
                <Text style={[styles.statusTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
                  Version gratuite
                </Text>
                <Text style={[styles.statusSubtitle, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                  Passez à Premium pour une meilleure expérience
                </Text>
              </>
            )}
          </View>
        )}

        {/* Avantages */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Ce que vous obtenez
          </Text>

          {advantages.map((advantage, index) => (
            <View
              key={index}
              style={[styles.advantageCard, { backgroundColor: theme.colors.post, borderColor: theme.colors.border }]}
            >
              <View style={[styles.advantageIcon, { backgroundColor: advantage.color }]}>
                <Ionicons name={advantage.icon} size={24} color="#fff" />
              </View>
              <Text style={[styles.advantageText, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                {advantage.text}
              </Text>
            </View>
          ))}
        </View>

        {/* Prix et abonnement */}
        {!isPremium && (
          <View style={styles.section}>
            <View style={[styles.priceCard, { backgroundColor: '#5DD6A0' }]}>
              <Text style={[styles.priceAmount, { fontSize: fontSize.sizes.title }]}>
                {displayPrice}
              </Text>
              <Text style={[styles.priceSubtitle, { fontSize: fontSize.sizes.small }]}>
                par mois
              </Text>
              <Text style={[styles.priceInfo, { fontSize: fontSize.sizes.small }]}>
                Annulez à tout moment
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.subscribeButton, { backgroundColor: '#007AFF' }]}
              onPress={handlePurchase}
              disabled={purchasing}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="diamond" size={24} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={[styles.subscribeButtonText, { fontSize: fontSize.sizes.body }]}>
                    S'abonner à Lini Premium
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
            >
              <Text style={[styles.restoreButtonText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Restaurer mes achats
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Informations */}
        <View style={styles.infoSection}>
          <Text style={[styles.infoText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
            L'abonnement sera facturé via votre compte App Store. Il se renouvellera automatiquement sauf si vous l'annulez au moins 24h avant la fin de la période en cours.
          </Text>

          <View style={styles.legalLinks}>
            <TouchableOpacity
              onPress={() => Linking.openURL('https://anonyma93.github.io/Politique_de_confidentialit-/privacy-policy.html')}
            >
              <Text style={[styles.legalLinkText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Politique de confidentialité
              </Text>
            </TouchableOpacity>

            <Text style={[styles.legalSeparator, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
              {' | '}
            </Text>

            <TouchableOpacity
              onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
            >
              <Text style={[styles.legalLinkText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Conditions d'utilisation (EULA)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    position: 'relative',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  diamondIcon: {
    marginBottom: 12,
  },
  headerTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    color: '#000',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontFamily: 'Fredoka_400Regular',
    color: '#000',
    textAlign: 'center',
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  statusCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
  },
  statusTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    marginTop: 12,
    marginBottom: 4,
  },
  statusSubtitle: {
    fontFamily: 'Fredoka_400Regular',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  manageButtonText: {
    fontFamily: 'Fredoka_400Regular',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    marginBottom: 16,
  },
  advantageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  advantageIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  advantageText: {
    fontFamily: 'Fredoka_500Medium',
    flex: 1,
  },
  priceCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  priceAmount: {
    fontFamily: 'Fredoka_600SemiBold',
    color: '#fff',
    marginBottom: 4,
  },
  priceSubtitle: {
    fontFamily: 'Fredoka_400Regular',
    color: '#fff',
    opacity: 0.9,
    marginBottom: 12,
  },
  priceInfo: {
    fontFamily: 'Fredoka_400Regular',
    color: '#fff',
    opacity: 0.7,
  },
  subscribeButton: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  subscribeButtonText: {
    fontFamily: 'Fredoka_600SemiBold',
    color: '#fff',
  },
  restoreButton: {
    padding: 12,
    alignItems: 'center',
  },
  restoreButtonText: {
    fontFamily: 'Fredoka_400Regular',
    textDecorationLine: 'underline',
  },
  infoSection: {
    marginTop: 24,
  },
  infoText: {
    fontFamily: 'Fredoka_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    flexWrap: 'wrap',
  },
  legalLinkText: {
    fontFamily: 'Fredoka_400Regular',
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontFamily: 'Fredoka_400Regular',
  },
});
