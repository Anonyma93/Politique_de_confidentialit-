import { useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { shouldSendNotification, sendIncidentNotification } from '../services/notificationService';
import { lignes } from '../data/lignes';

export const useNotificationListener = (currentUser) => {
  const lastPostIdRef = useRef(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!currentUser) return;

    let unsubscribe;

    const setupListener = async () => {
      try {
        // Récupérer les lignes préférées de l'utilisateur depuis Firebase
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
          return;
        }

        const preferredLines = userDoc.data().preferredLines || [];
        const preferredStations = userDoc.data().preferredStations || [];

        if (preferredLines.length === 0 && preferredStations.length === 0) {
          // Pas de préférence configurée
          return;
        }

        // Créer une requête pour surveiller les nouveaux posts
        const postsQuery = query(
          collection(db, 'posts'),
          orderBy('createdAt', 'desc')
        );

        unsubscribe = onSnapshot(postsQuery, async (snapshot) => {
          // Ignorer le premier snapshot (chargement initial)
          if (!isInitializedRef.current) {
            if (snapshot.docs.length > 0) {
              lastPostIdRef.current = snapshot.docs[0].id;
            }
            isInitializedRef.current = true;
            return;
          }

          // Vérifier s'il y a de nouveaux posts
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const post = {
                id: change.doc.id,
                ...change.doc.data(),
              };

              // Ne pas notifier pour ses propres posts
              if (post.userId === currentUser.uid) {
                return;
              }

              // Vérifier si c'est un nouveau post (pas le chargement initial)
              if (lastPostIdRef.current && post.id !== lastPostIdRef.current) {
                // Vérifier si le post concerne une des lignes ou stations préférées
                const isPreferredLine = preferredLines.length > 0 && preferredLines.includes(post.line);
                const isPreferredStation = preferredStations.length > 0 && preferredStations.includes(post.station);

                if (isPreferredLine || isPreferredStation) {
                  // Vérifier si on doit envoyer une notification selon les préférences
                  const shouldNotify = await shouldSendNotification(post);

                  if (shouldNotify) {
                    // Trouver les infos de la ligne
                    const ligne = lignes.find(l => l.value === post.line);

                    // Envoyer la notification
                    await sendIncidentNotification(post, ligne);
                  }
                }
              }

              // Mettre à jour le dernier post ID
              lastPostIdRef.current = post.id;
            }
          });
        });
      } catch (error) {
        console.error('Error setting up notification listener:', error);
      }
    };

    setupListener();

    // Cleanup
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser]);
};
