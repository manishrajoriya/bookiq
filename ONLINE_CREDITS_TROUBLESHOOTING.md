# Online Credit System Troubleshooting Guide

## Issues Fixed

### 1. **Missing User ID Filtering**
**Problem**: Online storage functions were not filtering data by user_id, causing data leakage between users.

**Solution**: Added `checkAuth()` helper function and user_id filtering to all operations.

### 2. **Inconsistent Error Handling**
**Problem**: Error handling was inconsistent and didn't provide enough debugging information.

**Solution**: Added comprehensive error logging and consistent error handling patterns.

### 3. **Missing User Association**
**Problem**: History, notes, quizzes, and other data were not associated with specific users.

**Solution**: Added `user_id` field to all insert operations and user filtering to all queries.

### 4. **Database Schema Issues**
**Problem**: Online functions assumed certain table structures that might not exist.

**Solution**: Created complete database schema with proper relationships and constraints.

## Setup Instructions

### Step 1: Set up Supabase Database

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase-schema.sql`
4. Run the SQL script to create all required tables and policies

### Step 2: Verify Environment Variables

Ensure these environment variables are set in your `.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_KEY=your_supabase_anon_key
```

### Step 3: Test Authentication

1. Use the new AuthModal to sign in/sign up
2. Check the console logs for authentication status
3. Verify that `getUserId()` returns a valid user ID

## Common Issues and Solutions

### Issue 1: "Not authenticated" Error

**Symptoms**: 
- Console shows "Not authenticated" error
- Online credit functions fail

**Causes**:
- User not signed in
- Supabase configuration issues
- Network connectivity problems

**Solutions**:
1. Check if user is signed in using AuthModal
2. Verify Supabase environment variables
3. Check network connectivity
4. Look for authentication errors in console

### Issue 2: Database Permission Errors

**Symptoms**:
- "permission denied" errors
- "relation does not exist" errors

**Causes**:
- Tables not created in Supabase
- Row Level Security (RLS) policies not set up
- Missing user permissions

**Solutions**:
1. Run the `supabase-schema.sql` script
2. Verify all tables exist in Supabase dashboard
3. Check RLS policies are enabled
4. Ensure user is authenticated

### Issue 3: Credits Not Syncing

**Symptoms**:
- Local credits work but online credits don't
- Credits don't appear across devices

**Causes**:
- Online storage functions failing silently
- User not authenticated when credits are added
- Database connection issues

**Solutions**:
1. Check console logs for online storage errors
2. Ensure user is signed in before making purchases
3. Verify database connectivity
4. Test with a simple credit addition

### Issue 4: Purchase Success but No Credits

**Symptoms**:
- Purchase completes successfully
- No credits added to account
- Error message about credit addition failure

**Causes**:
- Online credit addition failing
- Database constraints violated
- Network timeout

**Solutions**:
1. Check console logs for credit addition errors
2. Verify user authentication status
3. Check database constraints
4. Retry the purchase

## Debugging Steps

### 1. Enable Detailed Logging

The updated code includes comprehensive logging. Check the console for:

```
Online credits - Permanent: X, Expiring: Y, Total: Z
Added expiring credits: X expiring at Y
Successfully spent X credits online
```

### 2. Test Authentication

```javascript
// Test in browser console or app
const { data } = await supabase.auth.getUser();
console.log('User ID:', data.user?.id);
```

### 3. Test Credit Functions

```javascript
// Test getting credits
try {
  const credits = await getCreditsOnline();
  console.log('Online credits:', credits);
} catch (error) {
  console.error('Error getting credits:', error);
}
```

### 4. Check Database Tables

In Supabase dashboard, verify these tables exist:
- `credits`
- `expiring_credits`
- `history`
- `notes`
- `scan_notes`
- `quiz_maker`
- `flash_card_sets`

## Testing the Fix

### 1. Sign In Test
1. Open the app
2. Go to Profile page
3. Tap "Sign In" button
4. Complete authentication
5. Verify user email appears in profile

### 2. Credit Purchase Test
1. Go to Paywall/Get Credits page
2. Make a test purchase
3. Check console logs for credit addition
4. Verify credits appear in profile

### 3. Credit Spending Test
1. Try to use AI features that require credits
2. Check if credits are deducted properly
3. Verify both local and online credits are updated

### 4. Cross-Device Test
1. Sign in on one device
2. Purchase credits
3. Sign in on another device
4. Verify credits are available

## Monitoring and Maintenance

### 1. Regular Cleanup
The system automatically cleans up expired credits, but you can also run:

```sql
SELECT cleanup_expired_credits();
```

### 2. Monitor Credit Usage
Check credit usage patterns in Supabase:

```sql
SELECT 
  user_id,
  SUM(amount) as total_expiring_credits,
  COUNT(*) as credit_entries
FROM expiring_credits 
GROUP BY user_id;
```

### 3. Check for Errors
Monitor the application logs for:
- Authentication errors
- Database connection issues
- Credit calculation errors

## Support

If you continue to experience issues:

1. Check the console logs for specific error messages
2. Verify your Supabase configuration
3. Test with a fresh user account
4. Check network connectivity
5. Verify all environment variables are set correctly

The updated code includes much better error handling and logging, so most issues should now be clearly visible in the console logs. 