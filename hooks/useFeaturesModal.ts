import { useState } from 'react';

export const useFeaturesModal = () => {
  const [isVisible, setIsVisible] = useState(false);

  const showFeatures = () => {
    setIsVisible(true);
  };

  const hideFeatures = () => {
    setIsVisible(false);
  };

  return {
    isVisible,
    showFeatures,
    hideFeatures,
  };
}; 