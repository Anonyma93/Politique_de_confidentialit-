import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { subscribeToComments, addComment, deleteComment } from '../services/commentService';
import { submitReport } from '../services/reportService';
import { getCurrentUser, getUserData } from '../services/authService';
import PremiumBadge from './PremiumBadge';
import { formatUserName } from '../utils/formatUserName';

// Raisons de signalement pour les commentaires
const COMMENT_REPORT_REASONS = [
  { key: 'spam', label: 'Spam ou hors-sujet' },
  { key: 'inappropriate', label: 'Contenu inapproprié' },
  { key: 'dangerous', label: 'Contenu dangereux' },
  { key: 'misinformation', label: 'Désinformation' },
];

// Composant pour un commentaire individuel
const CommentItem = ({ comment, index, currentUser, theme, fontSize, handleUserPress, handleDeleteComment, formatDate, handleReportComment, reportedComments }) => {
  const isOwnComment = comment.userId === currentUser?.uid;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Fonction helper pour formater le nom d'utilisateur
  const getFormattedUserName = (displayName, userId, userHideLastNames) => {
    if (!displayName) return 'Utilisateur';

    // Séparer le prénom et le nom
    const nameParts = displayName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return formatUserName(firstName, lastName, userHideLastNames, userId, currentUser?.uid);
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  return (
    <Animated.View
      style={[
        styles.commentWrapper,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          alignItems: isOwnComment ? 'flex-end' : 'flex-start',
        }
      ]}
    >
      <View style={[
        styles.commentContainer,
        { flexDirection: isOwnComment ? 'row-reverse' : 'row' }
      ]}>
        {/* Bulle de commentaire */}
        <View style={[
          styles.bubbleRow,
          { flexDirection: isOwnComment ? 'row-reverse' : 'row' }
        ]}>
          {/* Bulle de message */}
          <View style={styles.bubbleContainer}>
            {isOwnComment ? (
              <LinearGradient
                colors={['#8CE9F6', '#5DD6A0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.bubble,
                  styles.ownBubble,
                ]}
              >
                {/* Bouton supprimer en haut à droite */}
                <TouchableOpacity
                  onPress={() => handleDeleteComment(comment.id, comment.userId)}
                  style={styles.deleteButtonTopRight}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={16} color="rgba(0,0,0,0.3)" />
                </TouchableOpacity>

                {/* Message */}
                <Text style={[styles.bubbleText, { color: '#000', fontSize: fontSize.sizes.body, fontFamily: 'Fredoka_400Regular' }]}>
                  {comment.text}
                </Text>

                {/* Heure */}
                <View style={styles.bubbleFooter}>
                  <Text style={[styles.bubbleTime, { color: 'rgba(0,0,0,0.45)', fontSize: 10, fontFamily: 'Fredoka_400Regular' }]}>
                    {formatDate(comment.createdAt)}
                  </Text>
                </View>
              </LinearGradient>
            ) : (
              <View style={[
                styles.bubble,
                styles.otherBubble,
                { backgroundColor: theme.colors.navbar }
              ]}>
                {/* Bouton signalement en haut à droite */}
                <TouchableOpacity
                  onPress={() => handleReportComment(comment)}
                  style={styles.deleteButtonTopRight}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  disabled={reportedComments?.has(comment.id)}
                >
                  <Ionicons
                    name="flag-outline"
                    size={14}
                    color={reportedComments?.has(comment.id) ? '#FF6B6B' : 'rgba(0,0,0,0.2)'}
                  />
                </TouchableOpacity>

                {/* Message */}
                <Text style={[styles.bubbleText, { color: theme.colors.text, fontSize: fontSize.sizes.body, fontFamily: 'Fredoka_400Regular' }]}>
                  {comment.text}
                </Text>

                {/* Heure en bas à droite */}
                <View style={styles.bubbleFooter}>
                  <Text style={[styles.bubbleTime, { color: theme.colors.textSecondary, fontSize: 10, fontFamily: 'Fredoka_400Regular' }]}>
                    {formatDate(comment.createdAt)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Avatar et nom empilés verticalement */}
          <TouchableOpacity
            onPress={() => handleUserPress(comment.userId)}
            activeOpacity={0.7}
            style={styles.userInfoColumn}
          >
            {/* Avatar */}
            {comment.userPhotoURL ? (
              <Image
                source={{ uri: comment.userPhotoURL }}
                style={[
                  styles.commentAvatarSmall,
                  { borderWidth: 2, borderColor: isOwnComment ? theme.colors.iconActive : theme.colors.border }
                ]}
              />
            ) : (
              <LinearGradient
                colors={isOwnComment ? ['#8CE9F6', '#5DD6A0'] : ['#E0E0E0', '#BDBDBD']}
                style={[styles.commentAvatarSmall, styles.defaultAvatar]}
              >
                <Ionicons
                  name="person"
                  size={14}
                  color="#FFF"
                />
              </LinearGradient>
            )}

            {/* Nom et badge */}
            <View style={[
              styles.nameTag,
              {
                backgroundColor: isOwnComment
                  ? 'rgba(140, 233, 246, 0.3)'
                  : theme.name === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
              }
            ]}>
              <Text style={[
                styles.nameTagText,
                {
                  color: isOwnComment
                    ? 'rgba(0,0,0,0.7)'
                    : theme.colors.iconActive,
                  fontSize: 10,
                  fontFamily: 'Fredoka_500Medium'
                }
              ]}>
                {getFormattedUserName(comment.userDisplayName, comment.userId, comment.userHideLastNames)}
              </Text>
              {comment.userIsPremium && <PremiumBadge size={8} />}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

export default function CommentsModal({ visible, onClose, post, navigation }) {
  const { theme, fontSize } = useTheme();
  const currentUser = getCurrentUser();
  const [currentUserData, setCurrentUserData] = useState({ hideLastNames: false, isPremium: false });
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reportedComments, setReportedComments] = useState(new Set());
  const flatListRef = useRef(null);

  // Charger les données utilisateur
  useEffect(() => {
    const loadUserData = async () => {
      if (currentUser) {
        const result = await getUserData(currentUser.uid);
        if (result.success) {
          setCurrentUserData({
            hideLastNames: result.data.hideLastNames || false,
            isPremium: result.data.isPremium || false
          });
        }
      }
    };
    if (visible) {
      loadUserData();
    }
  }, [visible, currentUser]);

  // Écouter les commentaires en temps réel
  useEffect(() => {
    if (!visible || !post?.id) return;

    setLoading(true);
    const unsubscribe = subscribeToComments(post.id, (newComments) => {
      setComments(newComments.filter(c => !c.hidden));
      setLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [visible, post?.id]);

  // Scroller vers le bas quand de nouveaux commentaires arrivent
  useEffect(() => {
    if (comments.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [comments.length]);

  // Envoyer un commentaire
  const handleSendComment = async () => {
    if (!newComment.trim() || !currentUser) return;

    const commentText = newComment.trim();
    setSending(true);
    setNewComment(''); // Vider le champ immédiatement

    try {
      const result = await addComment(
        post.id,
        currentUser.uid,
        currentUser.displayName || 'Utilisateur',
        currentUser.photoURL,
        commentText,
        currentUserData.isPremium,
        currentUserData.hideLastNames,
        post.userId // postOwnerId pour les notifications
      );

      if (!result.success) {
        // En cas d'erreur, restaurer le texte
        setNewComment(commentText);
      }
    } catch (error) {
      console.error('Erreur:', error);
      // En cas d'erreur, restaurer le texte
      setNewComment(commentText);
    } finally {
      setSending(false);
    }
  };

  // Supprimer un commentaire
  const handleDeleteComment = (commentId, commentUserId) => {
    if (commentUserId !== currentUser?.uid) return;

    Alert.alert(
      'Supprimer le commentaire',
      'Êtes-vous sûr de vouloir supprimer ce commentaire ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteComment(commentId, post?.id);
          },
        },
      ]
    );
  };

  // Signaler un commentaire
  const handleReportComment = (comment) => {
    if (reportedComments.has(comment.id)) return;

    Alert.alert(
      'Signaler ce commentaire',
      'Pourquoi souhaitez-vous signaler ce commentaire ?',
      [
        ...COMMENT_REPORT_REASONS.map((r) => ({
          text: r.label,
          onPress: async () => {
            const result = await submitReport({
              contentType: 'comment',
              contentId: comment.id,
              postId: post?.id || comment.postId,
              reason: r.key,
              currentUser,
            });

            if (result.alreadyReported) {
              Alert.alert('Déjà signalé', 'Vous avez déjà signalé ce commentaire.');
            } else if (result.success) {
              setReportedComments(prev => new Set([...prev, comment.id]));
              Alert.alert('Signalement envoyé', 'Merci, votre signalement a bien été pris en compte.');
            } else {
              Alert.alert('Erreur', 'Une erreur est survenue. Veuillez réessayer.');
            }
          },
        })),
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  // Formater la date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Naviguer vers le profil de l'utilisateur
  const handleUserPress = (userId) => {
    if (!navigation || !userId) return;

    // Fermer la modale d'abord
    onClose();

    // Attendre que la modale soit fermée avant de naviguer (fix pour iPhone)
    setTimeout(() => {
      navigation.navigate('UserProfile', { userId });
    }, 300);
  };

  // Rendu d'un commentaire
  const renderComment = ({ item: comment, index }) => {
    return (
      <CommentItem
        comment={comment}
        index={index}
        currentUser={currentUser}
        theme={theme}
        fontSize={fontSize}
        handleUserPress={handleUserPress}
        handleDeleteComment={handleDeleteComment}
        formatDate={formatDate}
        handleReportComment={handleReportComment}
        reportedComments={reportedComments}
      />
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
          {/* Header avec gradient */}
          <LinearGradient
            colors={theme.name === 'dark' ? ['#1A1A1A', theme.colors.navbar] : ['#FFFFFF', theme.colors.navbar]}
            style={styles.modalHeader}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <View style={[styles.commentsBadge, { backgroundColor: theme.colors.iconActive }]}>
                  <Ionicons name="chatbubbles" size={18} color="#FFF" />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
                    Commentaires
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                    {comments.length} {comments.length > 1 ? 'messages' : 'message'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close-circle" size={32} color={theme.colors.iconInactive} />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Liste des commentaires */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.iconActive} />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <LinearGradient
                colors={['#8CE9F6', '#5DD6A0']}
                style={styles.emptyIcon}
              >
                <Ionicons name="chatbubbles" size={48} color="#FFF" />
              </LinearGradient>
              <Text style={[styles.emptyText, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
                Aucun commentaire
              </Text>
              <Text style={[styles.emptySubText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Lancez la conversation ! 💬
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={comments}
              renderItem={renderComment}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.commentsList}
            />
          )}

          {/* Input pour nouveau commentaire */}
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.background }]}>
            <View style={[
              styles.inputWrapper,
              {
                backgroundColor: theme.colors.navbar,
                borderColor: theme.colors.border,
              }
            ]}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    fontSize: fontSize.sizes.body,
                  }
                ]}
                placeholder="Écrivez un message..."
                placeholderTextColor={theme.colors.textSecondary}
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={500}
              />
            </View>
            {newComment.trim() ? (
              <TouchableOpacity
                onPress={handleSendComment}
                disabled={sending}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#8CE9F6', '#5DD6A0']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendButton}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Ionicons
                      name="send"
                      size={22}
                      color="#000"
                    />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={[styles.sendButton, { backgroundColor: theme.colors.border, opacity: 0.5 }]}>
                <Ionicons name="send" size={22} color={theme.colors.textSecondary} />
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    marginTop: 100,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  commentsBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  modalSubtitle: {
    fontFamily: 'Fredoka_400Regular',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  emptyText: {
    fontFamily: 'Fredoka_600SemiBold',
    textAlign: 'center',
  },
  emptySubText: {
    fontFamily: 'Fredoka_400Regular',
    textAlign: 'center',
  },
  commentsList: {
    padding: 16,
    paddingBottom: 20,
  },
  commentWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  commentContainer: {
    alignItems: 'flex-end',
    gap: 8,
  },
  defaultAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '85%',
  },
  bubbleContainer: {
    flex: 1,
    maxWidth: '100%',
  },
  bubble: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  ownBubble: {
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  bubbleText: {
    lineHeight: 20,
  },
  bubbleFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  bubbleTime: {
    opacity: 0.7,
  },
  deleteButtonCompact: {
    padding: 0,
  },
  deleteButtonTopRight: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
  },
  userInfoColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  commentAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  nameTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  nameTagText: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  input: {
    fontFamily: 'Fredoka_400Regular',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
