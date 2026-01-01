import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function PrivacyPolicyScreen({ navigation }) {
  const { theme, fontSize } = useTheme();

  const handleEmailPress = () => {
    Linking.openURL('mailto:quentin.michaud.pro@gmail.com');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text, fontSize: fontSize.sizes.title }]}>
          Politique de confidentialité
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* Introduction */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Introduction
          </Text>
          <Text style={[styles.text, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
            Lini s'engage à protéger votre vie privée. Cette politique de confidentialité explique comment nous collectons, utilisons et protégeons vos données personnelles.
          </Text>
        </View>

        {/* Données collectées */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Données collectées
          </Text>
          <Text style={[styles.text, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
            Nous collectons les informations suivantes :
          </Text>
          <View style={styles.list}>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Informations de profil (nom, prénom, email, photo de profil)
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Préférences de transport (lignes et stations favorites)
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Publications et interactions (posts, likes)
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Statistiques d'utilisation et score utilisateur
            </Text>
          </View>
        </View>

        {/* Utilisation des données */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Utilisation des données
          </Text>
          <Text style={[styles.text, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
            Vos données sont utilisées pour :
          </Text>
          <View style={styles.list}>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Fournir et améliorer nos services
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Personnaliser votre expérience
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Envoyer des notifications pertinentes
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Calculer vos statistiques et votre grade
            </Text>
          </View>
        </View>

        {/* Partage des données */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Partage des données
          </Text>
          <Text style={[styles.text, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
            Nous ne vendons jamais vos données personnelles. Les informations suivantes sont visibles par les autres utilisateurs :
          </Text>
          <View style={styles.list}>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Votre nom et prénom
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Votre photo de profil
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Vos publications publiques
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Vos statistiques et votre grade
            </Text>
          </View>
        </View>

        {/* Sécurité */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Sécurité
          </Text>
          <Text style={[styles.text, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
            Nous utilisons Firebase pour stocker vos données de manière sécurisée. Vos mots de passe sont cryptés et nous appliquons les meilleures pratiques de sécurité pour protéger vos informations.
          </Text>
        </View>

        {/* Vos droits */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Vos droits
          </Text>
          <Text style={[styles.text, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
            Vous avez le droit de :
          </Text>
          <View style={styles.list}>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Accéder à vos données personnelles
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Modifier vos informations de profil
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Supprimer votre compte et vos données
            </Text>
            <Text style={[styles.listItem, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
              • Vous opposer au traitement de vos données
            </Text>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Notifications
          </Text>
          <Text style={[styles.text, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
            Vous pouvez activer ou désactiver les notifications à tout moment dans les paramètres de l'application. Les notifications sont envoyées uniquement selon vos préférences (lignes favorites, gravité, plage horaire).
          </Text>
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Contact
          </Text>
          <Text style={[styles.text, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
            Pour toute question concernant cette politique de confidentialité ou vos données personnelles, vous pouvez nous contacter :
          </Text>
          <TouchableOpacity
            style={[styles.emailButton, { backgroundColor: theme.colors.iconActive }]}
            onPress={handleEmailPress}
          >
            <Ionicons name="mail" size={20} color="#fff" />
            <Text style={[styles.emailText, { fontSize: fontSize.sizes.body }]}>
              quentin.michaud.pro@gmail.com
            </Text>
          </TouchableOpacity>
        </View>

        {/* Modifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
            Modifications
          </Text>
          <Text style={[styles.text, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
            Nous nous réservons le droit de modifier cette politique de confidentialité à tout moment. Les modifications seront effectives dès leur publication dans l'application.
          </Text>
        </View>

        {/* Date */}
        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    marginBottom: 12,
  },
  text: {
    fontFamily: 'Fredoka_400Regular',
    lineHeight: 24,
    marginBottom: 8,
  },
  list: {
    marginTop: 8,
    gap: 8,
  },
  listItem: {
    fontFamily: 'Fredoka_400Regular',
    lineHeight: 24,
    paddingLeft: 8,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  emailText: {
    color: '#fff',
    fontFamily: 'Fredoka_600SemiBold',
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 20,
    marginTop: 20,
  },
  footerText: {
    fontFamily: 'Fredoka_400Regular',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
