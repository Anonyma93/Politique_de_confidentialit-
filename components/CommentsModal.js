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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { subscribeToComments, addComment, deleteComment } from '../services/commentService';
import { getCurrentUser } from '../services/authService';
import PremiumBadge from './PremiumBadge';

export default function CommentsModal({ visible, onClose, post }) {
  const { theme, fontSize } = useTheme();
  const currentUser = getCurrentUser();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  // Écouter les commentaires en temps réel
  useEffect(() => {
    if (!visible || !post?.id) return;

    setLoading(true);
    const unsubscribe = subscribeToComments(post.id, (newComments) => {
      setComments(newComments);
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

    setSending(true);
    try {
      const result = await addComment(
        post.id,
        currentUser.uid,
        currentUser.displayName || 'Utilisateur',
        currentUser.photoURL,
        newComment.trim(),
        post.userIsPremium || false
      );

      if (result.success) {
        setNewComment('');
      }
    } catch (error) {
      console.error('Erreur:', error);
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

  // Rendu d'un commentaire
  const renderComment = ({ item: comment }) => {
    const isOwnComment = comment.userId === currentUser?.uid;

    return (
      <View style={[styles.commentItem, { backgroundColor: theme.colors.navbar }]}>
        <View style={styles.commentHeader}>
          <View style={styles.commentUserInfo}>
            {comment.userPhotoURL ? (
              <Image
                source={{ uri: comment.userPhotoURL }}
                style={styles.commentAvatar}
              />
            ) : (
              <View style={[
                styles.commentAvatar,
                styles.defaultAvatar,
                { backgroundColor: theme.name === 'dark' ? '#FFFFFF' : '#000000' }
              ]}>
                <Ionicons
                  name="person"
                  size={16}
                  color={theme.name === 'dark' ? '#000000' : '#FFFFFF'}
                />
              </View>
            )}
            <View style={styles.commentUserDetails}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[styles.commentUserName, { color: theme.colors.text, fontSize: fontSize.sizes.small }]}>
                  {comment.userDisplayName}
                  {isOwnComment && ' (Vous)'}
                </Text>
                {comment.userIsPremium && <PremiumBadge size={14} />}
              </View>
              <Text style={[styles.commentTime, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                {formatDate(comment.createdAt)}
              </Text>
            </View>
          </View>

          {isOwnComment && (
            <TouchableOpacity
              onPress={() => handleDeleteComment(comment.id, comment.userId)}
              style={styles.deleteButton}
            >
              <Ionicons name="trash-outline" size={18} color="#FF4444" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.commentText, { color: theme.colors.text, fontSize: fontSize.sizes.body }]}>
          {comment.text}
        </Text>
      </View>
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
          {/* Header */}
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.navbar }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text, fontSize: fontSize.sizes.subtitle }]}>
              Commentaires ({comments.length})
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Liste des commentaires */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.iconActive} />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.iconInactive} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.body }]}>
                Aucun commentaire pour le moment
              </Text>
              <Text style={[styles.emptySubText, { color: theme.colors.textSecondary, fontSize: fontSize.sizes.small }]}>
                Soyez le premier à commenter !
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
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.navbar }]}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  fontSize: fontSize.sizes.body,
                }
              ]}
              placeholder="Ajouter un commentaire..."
              placeholderTextColor={theme.colors.textSecondary}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: newComment.trim() ? theme.colors.iconActive : theme.colors.border,
                }
              ]}
              onPress={handleSendComment}
              disabled={!newComment.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color="#FFF"
                />
              )}
            </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  closeButton: {
    padding: 5,
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
    gap: 10,
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
    padding: 20,
    paddingBottom: 20,
    gap: 15,
  },
  commentItem: {
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  commentUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  defaultAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentUserDetails: {
    flex: 1,
    gap: 2,
  },
  commentUserName: {
    fontFamily: 'Fredoka_600SemiBold',
  },
  commentTime: {
    fontFamily: 'Fredoka_400Regular',
  },
  deleteButton: {
    padding: 5,
  },
  commentText: {
    fontFamily: 'Fredoka_400Regular',
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    maxHeight: 100,
    fontFamily: 'Fredoka_400Regular',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
