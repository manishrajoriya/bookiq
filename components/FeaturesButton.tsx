import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useFeaturesModal } from '../hooks/useFeaturesModal';
import FeaturesModal from './FeaturesModal';

interface FeaturesButtonProps {
  variant?: 'primary' | 'secondary' | 'icon';
  size?: 'small' | 'medium' | 'large';
  title?: string;
  style?: any;
}

const FeaturesButton: React.FC<FeaturesButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  title = 'View Features',
  style
}) => {
  const { isVisible, showFeatures, hideFeatures } = useFeaturesModal();

  const getButtonStyle = () => {
    const baseStyle: any[] = [styles.button, styles[size]];
    if (variant === 'icon') {
      baseStyle.push(styles.iconButton);
    } else {
      baseStyle.push(styles[variant]);
    }
    if (style) baseStyle.push(style);
    return baseStyle;
  };

  const getTextStyle = () => {
    return [styles.text, styles[`${size}Text`], styles[`${variant}Text`]];
  };

  const getIconSize = () => {
    switch (size) {
      case 'small': return 16;
      case 'large': return 24;
      default: return 20;
    }
  };

  return (
    <>
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={showFeatures}
        activeOpacity={0.8}
      >
        {variant === 'icon' ? (
          <Ionicons name="star" size={getIconSize()} color="#FFD700" />
        ) : (
          <>
            <Ionicons name="star" size={getIconSize()} color="#FFD700" style={styles.icon} />
            <Text style={getTextStyle()}>{title}</Text>
          </>
        )}
      </TouchableOpacity>

      <FeaturesModal visible={isVisible} onClose={hideFeatures} />
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  // Size variants
  small: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  medium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  large: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  // Style variants
  primary: {
    backgroundColor: '#FFD700',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  iconButton: {
    backgroundColor: '#232323',
    borderRadius: 20,
    width: 40,
    height: 40,
  },
  // Text styles
  text: {
    fontWeight: 'bold',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  primaryText: {
    color: '#181818',
  },
  secondaryText: {
    color: '#FFD700',
  },
  iconText: {
    color: '#FFD700',
  },
  icon: {
    marginRight: 8,
  },
});

export default FeaturesButton; 