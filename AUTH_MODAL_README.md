# AuthModal Component

A modern, theme-aware authentication modal component for React Native that provides a complete authentication experience with Supabase integration.

## Features

- **Modern Design**: Clean, responsive UI with theme support (light/dark mode)
- **Complete Auth Flow**: Sign in, sign up, password reset, and Google OAuth
- **Session Management**: Automatic session handling and user profile display
- **Accessibility**: Full accessibility support with proper labels and navigation
- **Error Handling**: Comprehensive error and success message display
- **Loading States**: Smooth loading indicators for all async operations

## Usage

### Basic Implementation

```tsx
import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import AuthModal from './components/AuthModal';
import type { Session } from '@supabase/supabase-js';

const MyComponent = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  return (
    <View>
      <TouchableOpacity onPress={() => setShowAuthModal(true)}>
        <Text>{session ? 'Account Settings' : 'Sign In'}</Text>
      </TouchableOpacity>

      <AuthModal 
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(session) => {
          setSession(session);
          setShowAuthModal(false);
        }}
      />
    </View>
  );
};
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `visible` | `boolean` | Yes | Controls modal visibility |
| `onClose` | `() => void` | Yes | Callback when modal is closed |
| `onAuthSuccess` | `(session: Session) => void` | No | Callback when authentication succeeds |

## Authentication Features

### Sign In
- Email and password authentication
- Form validation
- Error handling
- Loading states

### Sign Up
- New account creation
- Email confirmation flow
- Password strength validation

### Password Reset
- Email-based password reset
- User-friendly success messages

### Google OAuth
- One-click Google sign-in
- Automatic redirect handling

### Profile Management
- User profile display
- Account information
- Sign out functionality

## Theme Support

The component automatically adapts to your app's theme:

- **Light Mode**: Clean, bright interface
- **Dark Mode**: Dark-themed interface with proper contrast
- **Dynamic Colors**: Uses your app's theme colors for consistency

## Styling

The component uses a comprehensive styling system that includes:

- Responsive design for different screen sizes
- Proper spacing and typography
- Smooth animations and transitions
- Consistent with modern mobile UI patterns

## Integration with Profile Page

The AuthModal has been integrated into the profile page to replace the old edit profile functionality:

- **Before**: Simple edit profile modal with basic fields
- **After**: Complete authentication system with session management

### Profile Page Changes

1. **Button Text**: Changes based on authentication status
   - "Sign In" when not authenticated
   - "Account Settings" when authenticated

2. **User Display**: Shows actual user information when logged in
   - Email address from session
   - User avatar/initial

3. **Session Management**: Automatic session handling and updates

## Migration from SupabaseAuthButton

The old `SupabaseAuthButton` component has been replaced with the new `AuthModal`:

### Key Improvements

1. **Better UX**: Modal-based design instead of inline buttons
2. **Theme Support**: Full light/dark mode support
3. **Modern UI**: Updated design with better visual hierarchy
4. **Better Error Handling**: More informative error messages
5. **Accessibility**: Improved accessibility features
6. **Responsive**: Better mobile experience

### Migration Steps

1. Replace `SupabaseAuthButton` imports with `AuthModal`
2. Update component usage to use modal pattern
3. Handle session state in parent component
4. Update any related styling or layout

## Example Implementation

See `components/AuthExample.tsx` for a complete example of how to use the AuthModal component.

## Dependencies

- `@supabase/supabase-js`
- `@expo/vector-icons`
- `react-native`
- Theme provider hooks (useThemeColor, useThemeContext)

## Notes

- Ensure your Supabase configuration is properly set up
- The component requires theme context to be available
- Google OAuth requires proper redirect URL configuration
- Session persistence is handled automatically by Supabase 