# Features Modal Component

This document explains how to use the new FeaturesModal and FeaturesButton components that display app features with images in a beautiful modal.

## Components Created

### 1. FeaturesModal.tsx
A modal component that displays app features with images, icons, and descriptions.

### 2. FeaturesButton.tsx
A reusable button component that can be easily added anywhere to trigger the features modal.

### 3. useFeaturesModal.ts
A custom hook that manages the modal state.

## How to Use

### Option 1: Using FeaturesButton (Recommended)
The easiest way to add the features modal anywhere in your app:

```tsx
import FeaturesButton from '@/components/FeaturesButton';

// In your component
<FeaturesButton 
  variant="primary" 
  size="medium" 
  title="View Features" 
/>

// Or as an icon button
<FeaturesButton variant="icon" size="small" />

// Or with custom styling
<FeaturesButton 
  variant="secondary" 
  size="large" 
  title="Discover Features"
  style={{ marginTop: 20 }}
/>
```

### Option 2: Using the Hook Directly
For more control over the modal:

```tsx
import FeaturesModal from '@/components/FeaturesModal';
import { useFeaturesModal } from '@/hooks/useFeaturesModal';

const MyComponent = () => {
  const { isVisible, showFeatures, hideFeatures } = useFeaturesModal();

  return (
    <>
      <TouchableOpacity onPress={showFeatures}>
        <Text>Show Features</Text>
      </TouchableOpacity>

      <FeaturesModal visible={isVisible} onClose={hideFeatures} />
    </>
  );
};
```

## FeaturesButton Variants

### Size Options
- `small`: Compact button
- `medium`: Standard size (default)
- `large`: Larger button

### Style Variants
- `primary`: Gold background with dark text
- `secondary`: Transparent with gold border
- `icon`: Circular icon-only button

## Features Displayed

The modal shows the following app features:

1. **AI Document Scanning** - Scan any document and get instant AI-powered analysis
2. **Smart Quiz Generation** - Create personalized quizzes from study materials
3. **Interactive Flash Cards** - Build and study with AI-generated flash cards
4. **Mind Maps Creation** - Visualize complex topics with AI-powered mind mapping
5. **Study Notes Organization** - Keep all notes organized and searchable
6. **Multi-Subject Support** - Study any subject with specialized tools

## Customization

### Adding New Features
To add new features, edit the `appFeatures` array in `FeaturesModal.tsx`:

```tsx
const appFeatures = [
  // ... existing features
  {
    id: 7,
    title: 'New Feature',
    description: 'Description of the new feature',
    icon: 'new-icon-outline',
    image: require('../assets/images/feature-image.png'),
    color: '#FF6B6B'
  }
];
```

### Changing Images
Replace the placeholder images in the `appFeatures` array with your actual feature images:

```tsx
image: require('../assets/images/your-feature-image.png')
```

### Styling
The components use the same dark theme styling as your existing PayWallModel component. You can customize colors, spacing, and animations by modifying the StyleSheet in each component.

## Example Usage in Different Screens

### Home Screen
```tsx
// Add to your home screen header
<View style={styles.header}>
  <Text style={styles.title}>BookIQ</Text>
  <FeaturesButton variant="icon" size="small" />
</View>
```

### Settings Screen
```tsx
// Add to your settings list
<View style={styles.settingItem}>
  <Text style={styles.settingText}>App Features</Text>
  <FeaturesButton variant="secondary" size="small" title="View" />
</View>
```

### Onboarding
```tsx
// Add to your onboarding flow
<View style={styles.onboardingContent}>
  <Text style={styles.welcomeText}>Welcome to BookIQ!</Text>
  <FeaturesButton 
    variant="primary" 
    size="large" 
    title="Discover Features" 
  />
</View>
```

## Benefits

- **Easy Integration**: One line of code to add anywhere
- **Consistent Design**: Matches your app's existing design language
- **Responsive**: Works on all screen sizes
- **Accessible**: Proper touch targets and animations
- **Customizable**: Multiple variants and styling options
- **Reusable**: Can be used throughout your app

## Technical Details

- Built with React Native and Expo
- Uses Ionicons for consistent iconography
- Implements smooth animations with Animated API
- Follows your app's dark theme color scheme
- Fully typed with TypeScript
- Responsive design that adapts to different screen sizes 