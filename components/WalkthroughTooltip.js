import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Tooltip from 'react-native-walkthrough-tooltip';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWalkthrough } from '../context/WalkthroughContext';

export default function WalkthroughTooltip({
  children,
  stepId,
  title,
  content,
  placement = 'bottom',
  previousStepId = null,
  onNext,
  onSkip,
  onShow,
  isLastStep = false,
}) {
  const { theme, fontSize } = useTheme();
  const { showWalkthrough, isStepCompleted, completeStep, dismissWalkthrough, completedSteps, isLoading } = useWalkthrough();

  // Ne pas afficher si le walkthrough est désactivé ou si l'étape est déjà complétée
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    // Attendre que le contexte soit chargé avant d'afficher les tooltips
    if (isLoading) {
      return;
    }

    // Vérifier si on peut afficher ce tooltip
    const canShow = showWalkthrough &&
                    !isStepCompleted(stepId) &&
                    (!previousStepId || isStepCompleted(previousStepId));

    if (canShow) {
      // Petit délai pour s'assurer que le composant est monté
      const timer = setTimeout(() => {
        setIsVisible(true);
        // Appeler onShow si fourni
        if (onShow) {
          onShow();
        }
      }, 300);
      return () => clearTimeout(timer);
    } else if (isStepCompleted(stepId)) {
      setIsVisible(false);
    }
  }, [showWalkthrough, stepId, previousStepId, completedSteps, isLoading, onShow]);

  const handleNext = () => {
    setIsVisible(false);
    completeStep(stepId);
    if (onNext) {
      setTimeout(() => onNext(), 100);
    }
  };

  const handleSkip = () => {
    setIsVisible(false);
    dismissWalkthrough();
    if (onSkip) {
      onSkip();
    }
  };

  return (
    <Tooltip
      isVisible={isVisible}
      content={
        <View style={styles.tooltipContent}>
          {/* En-tête */}
          <View style={styles.tooltipHeader}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.iconActive }]}>
              <Ionicons name="bulb" size={20} color="#fff" />
            </View>
            <Text
              style={[
                styles.tooltipTitle,
                {
                  color: theme.colors.text,
                  fontSize: fontSize.sizes.subtitle,
                  fontFamily: 'Fredoka_600SemiBold',
                },
              ]}
            >
              {title}
            </Text>
          </View>

          {/* Contenu */}
          <Text
            style={[
              styles.tooltipText,
              {
                color: theme.colors.textSecondary,
                fontSize: fontSize.sizes.body,
                fontFamily: 'Fredoka_400Regular',
              },
            ]}
          >
            {content}
          </Text>

          {/* Boutons */}
          <View style={styles.tooltipButtons}>
            <TouchableOpacity
              style={[styles.skipButton, { borderColor: theme.colors.border }]}
              onPress={handleSkip}
            >
              <Text
                style={[
                  styles.skipButtonText,
                  {
                    color: theme.colors.textSecondary,
                    fontSize: fontSize.sizes.body,
                    fontFamily: 'Fredoka_500Medium',
                  },
                ]}
              >
                Passer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: theme.colors.iconActive }]}
              onPress={handleNext}
            >
              <Text
                style={[
                  styles.nextButtonText,
                  {
                    fontSize: fontSize.sizes.body,
                    fontFamily: 'Fredoka_600SemiBold',
                  },
                ]}
              >
                {isLastStep ? 'Terminé' : 'Suivant'}
              </Text>
              {!isLastStep && <Ionicons name="arrow-forward" size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      }
      placement={placement}
      onClose={() => setIsVisible(false)}
      backgroundColor="rgba(0,0,0,0.5)"
      contentStyle={[
        styles.tooltipContentStyle,
        { backgroundColor: theme.colors.navbar },
      ]}
      tooltipStyle={styles.tooltip}
      arrowStyle={{ borderTopColor: theme.colors.navbar }}
      useInteractionManager={true}
      showChildInTooltip={false}
      disableShadow={false}
    >
      {children}
    </Tooltip>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tooltipContentStyle: {
    borderRadius: 16,
    padding: 0,
    maxWidth: 340,
  },
  tooltipContent: {
    padding: 20,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipTitle: {
    flex: 1,
  },
  tooltipText: {
    marginBottom: 20,
    lineHeight: 22,
  },
  tooltipButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    // styles dynamiques
  },
  nextButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  nextButtonText: {
    color: '#fff',
  },
});
