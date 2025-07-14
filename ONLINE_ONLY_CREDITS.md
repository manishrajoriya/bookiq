# Online-Only Credit System Implementation

## Overview

The credit system has been completely refactored to remove offline credit tracking and make all credit operations fully online-controlled through Supabase. This ensures better security, consistency, and prevents credit manipulation.

## Changes Made

### 1. **Removed Local Credit Storage**

**Files Modified:**
- `services/historyStorage.ts`

**Removed Functions:**
- `initCreditsTable()`
- `initExpiringCreditsTable()`
- `addExpiringCredits()`
- `getCredits()`
- `addCredits()`
- `spendCredits()`
- `cleanupExpiredCredits()`

**Removed Tables:**
- `credits` (local SQLite table)
- `expiring_credits` (local SQLite table)

### 2. **Updated Subscription Service**

**Files Modified:**
- `services/subscriptionService.ts`

**Changes:**
- Removed imports for local credit functions
- Updated `purchasePackage()` to only add credits online
- Updated `getCurrentCredits()` to return only online credits
- Updated `spendCredits()` to only use online credits
- Simplified credit management logic

### 3. **Updated Profile Page**

**Files Modified:**
- `app/(tabs)/profile.tsx`

**Changes:**
- Added import for `subscriptionService`
- Updated `loadUserData()` to use `subscriptionService.getCurrentCredits()`
- Removed dependency on local `getCredits()` function

## Benefits of Online-Only Credits

### 1. **Security**
- Credits cannot be manipulated locally
- All credit operations are logged and auditable
- User authentication required for all credit operations

### 2. **Consistency**
- Credits are always in sync across devices
- No risk of local/online credit discrepancies
- Centralized credit management

### 3. **Reliability**
- No local storage corruption issues
- Automatic backup through Supabase
- Better error handling and recovery

### 4. **User Experience**
- Credits available on all devices when signed in
- Real-time credit updates
- No need to sync between local and online storage

## How It Works Now

### 1. **Credit Purchase**
```typescript
// Purchase flow
const result = await subscriptionService.purchasePackage(pack);
// Credits are added directly to Supabase
await addExpiringCreditsOnline(creditsToAdd, expirationDate);
```

### 2. **Credit Spending**
```typescript
// Spending flow
const result = await subscriptionService.spendCredits(amount);
// Credits are deducted from Supabase only
const success = await spendCreditsOnline(amount);
```

### 3. **Credit Display**
```typescript
// Getting credits
const creditData = await subscriptionService.getCurrentCredits();
// Returns: { online: number, total: number }
```

## Authentication Requirements

### **All Credit Operations Require Authentication**
- Users must be signed in to purchase credits
- Users must be signed in to spend credits
- Users must be signed in to view credits

### **Error Handling**
- If user is not authenticated, appropriate error messages are shown
- Purchase flow guides users to sign in if needed
- Graceful fallbacks for offline scenarios

## Database Schema

The online credit system uses these Supabase tables:

### **credits** (Permanent Credits)
```sql
CREATE TABLE credits (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance INTEGER DEFAULT 0 CHECK (balance >= 0),
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **expiring_credits** (Time-Limited Credits)
```sql
CREATE TABLE expiring_credits (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Migration Notes

### **For Existing Users**
- Local credits are no longer accessible
- Users need to sign in to access their credits
- Any local credit data will be lost (this is intentional for security)

### **For New Users**
- All credit operations require authentication
- Credits are stored only in Supabase
- No local credit storage

## Testing Checklist

### **Authentication Flow**
- [ ] User can sign in/sign up
- [ ] Credits are displayed after authentication
- [ ] Credits show 0 when not authenticated

### **Purchase Flow**
- [ ] Purchase requires authentication
- [ ] Credits are added to online storage
- [ ] Credits appear immediately after purchase
- [ ] Credits persist across app restarts

### **Spending Flow**
- [ ] Credit spending requires authentication
- [ ] Credits are deducted from online storage
- [ ] Insufficient credits are handled properly
- [ ] Error messages are clear and helpful

### **Cross-Device Sync**
- [ ] Credits appear on all devices when signed in
- [ ] Credit changes sync immediately
- [ ] No local credit discrepancies

## Security Considerations

### **Row Level Security (RLS)**
- All credit tables have RLS enabled
- Users can only access their own credits
- Database-level security prevents unauthorized access

### **Authentication Checks**
- All credit functions verify user authentication
- Proper error handling for unauthenticated users
- No credit operations possible without valid session

### **Data Integrity**
- Database constraints prevent negative credits
- Automatic cleanup of expired credits
- Transaction-based credit operations

## Future Enhancements

### **Potential Improvements**
- Credit usage analytics
- Credit expiration notifications
- Bulk credit operations
- Credit transfer between users (admin only)
- Credit purchase history

### **Monitoring**
- Credit usage patterns
- Purchase success rates
- Authentication failures
- Database performance metrics

## Support

If users experience issues:

1. **"Not authenticated" errors**: Guide users to sign in
2. **Credit not appearing**: Check Supabase connection and authentication
3. **Purchase failures**: Verify payment processing and online storage
4. **Sync issues**: Ensure user is signed in on all devices

The online-only credit system provides a more secure, reliable, and consistent experience for users while preventing potential abuse through local credit manipulation. 