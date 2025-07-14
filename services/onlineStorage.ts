import { supabase } from '../utils/supabase';

// Helper to get current user ID and email
const getUserId = async () => {
  const { data } = await supabase.auth.getUser();
  console.log('data user id', data.user?.id);
  return data?.user?.id;
};

const getUserEmail = async () => {
  const { data } = await supabase.auth.getUser();
  return data?.user?.email;
};

// Helper to check if user is authenticated
const checkAuth = async () => {
  const userId = await getUserId();
  if (!userId) {
    throw new Error('Not authenticated');
  }
  return userId;
};

// --- Online History (Supabase) ---
export const initHistoryTableOnline = async () => {
  // No-op: Create the 'history' table in Supabase manually or via migration.
};

export const addHistoryOnline = async (
  imageUri: string,
  feature: string,
  extractedText: string,
  aiAnswer: string
): Promise<any> => {
  const userId = await checkAuth();
  
  const { data, error } = await supabase
    .from('history')
    .insert([
      {
        user_id: userId,
        imageUri,
        feature,
        extractedText,
        aiAnswer,
        createdAt: new Date().toISOString(),
      },
    ])
    .select();
  if (error) throw error;
  return data?.[0];
};

export const getAllHistoryOnline = async (): Promise<any[]> => {
  const userId = await checkAuth();
  
  const { data, error } = await supabase
    .from('history')
    .select('*')
    .eq('user_id', userId)
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const updateHistoryAnswerOnline = async (id: number, aiAnswer: string) => {
  const userId = await checkAuth();
  
  const { error } = await supabase
    .from('history')
    .update({ aiAnswer })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
};

// --- Online Notes (Supabase) ---
/**
 * Add a note to Supabase
 */
export const addNoteOnline = async (title: string, content: string): Promise<any> => {
  const userId = await checkAuth();
  
  const { data, error } = await supabase
    .from('notes')
    .insert([
      {
        user_id: userId,
        title,
        content,
        createdAt: new Date().toISOString(),
      },
    ])
    .select();
  if (error) throw error;
  return data?.[0];
};

/**
 * Get all notes from Supabase
 */
export const getAllNotesOnline = async (): Promise<any[]> => {
  const userId = await checkAuth();
  
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

/**
 * Update a note in Supabase
 */
export const updateNoteOnline = async (id: number, title: string, content: string) => {
  const userId = await checkAuth();
  
  const { error } = await supabase
    .from('notes')
    .update({ title, content })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
};

/**
 * Delete a note in Supabase
 */
export const deleteNoteOnline = async (id: number) => {
  const userId = await checkAuth();
  
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
};

// --- Online Scan Notes (Supabase) ---
export const addScanNoteOnline = async (title: string, content: string): Promise<any> => {
  const userId = await checkAuth();
  
  const { data, error } = await supabase
    .from('scan_notes')
    .insert([
      {
        user_id: userId,
        title,
        content,
        createdAt: new Date().toISOString(),
      },
    ])
    .select();
  if (error) throw error;
  return data?.[0];
};

export const getAllScanNotesOnline = async (): Promise<any[]> => {
  const userId = await checkAuth();
  
  const { data, error } = await supabase
    .from('scan_notes')
    .select('*')
    .eq('user_id', userId)
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const updateScanNoteOnline = async (id: number, title: string, content: string) => {
  const userId = await checkAuth();
  
  const { error } = await supabase
    .from('scan_notes')
    .update({ title, content })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
};

export const deleteScanNoteOnline = async (id: number) => {
  const userId = await checkAuth();
  
  const { error } = await supabase
    .from('scan_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
};

// --- Online Quizzes (Supabase) ---
export const addQuizOnline = async (
  title: string,
  content: string,
  quizType: string,
  sourceNoteId?: number,
  sourceNoteType?: 'note' | 'scan-note'
): Promise<any> => {
  const userId = await checkAuth();
  
  const { data, error } = await supabase
    .from('quiz_maker')
    .insert([
      {
        user_id: userId,
        title,
        content,
        quiz_type: quizType,
        source_note_id: sourceNoteId ?? null,
        source_note_type: sourceNoteType ?? null,
        createdAt: new Date().toISOString(),
      },
    ])
    .select();
  if (error) throw error;
  return data?.[0];
};

export const getAllQuizzesOnline = async (): Promise<any[]> => {
  const userId = await checkAuth();
  
  const { data, error } = await supabase
    .from('quiz_maker')
    .select('*')
    .eq('user_id', userId)
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const updateQuizOnline = async (id: number, title: string, content: string) => {
  const userId = await checkAuth();
  
  const { error } = await supabase
    .from('quiz_maker')
    .update({ title, content })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
};

export const deleteQuizOnline = async (id: number) => {
  const userId = await checkAuth();
  
  const { error } = await supabase
    .from('quiz_maker')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
};

// --- Online Flash Card Sets (Supabase) ---
export const addFlashCardSetOnline = async (
  title: string,
  content: string,
  cardType: string,
  sourceNoteId?: number,
  sourceNoteType?: 'note' | 'scan-note'
): Promise<any> => {
  const userId = await checkAuth();
  
  const { data, error } = await supabase
    .from('flash_card_sets')
    .insert([
      {
        user_id: userId,
        title,
        content,
        card_type: cardType,
        source_note_id: sourceNoteId ?? null,
        source_note_type: sourceNoteType ?? null,
        createdAt: new Date().toISOString(),
      },
    ])
    .select();
  if (error) throw error;
  return data?.[0];
};

export const getAllFlashCardSetsOnline = async (): Promise<any[]> => {
  const userId = await checkAuth();
  
  const { data, error } = await supabase
    .from('flash_card_sets')
    .select('*')
    .eq('user_id', userId)
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const updateFlashCardSetOnline = async (id: number, title: string, content: string) => {
  const userId = await checkAuth();
  
  const { error } = await supabase
    .from('flash_card_sets')
    .update({ title, content })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
};

export const deleteFlashCardSetOnline = async (id: number) => {
  const userId = await checkAuth();
  
  const { error } = await supabase
    .from('flash_card_sets')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
};

// --- Online Credits System (Supabase) ---
/**
 * Get total credits (permanent + expiring, minus expired) for the current user
 */
export const getCreditsOnline = async (): Promise<number> => {
  const userId = await checkAuth();

  try {
    // Clean up expired credits
    await cleanupExpiredCreditsOnline();

    // Permanent credits
    const { data: creditsData, error: creditsError } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', userId)
      .single();
    
    if (creditsError && creditsError.code !== 'PGRST116') {
      console.error('Error getting permanent credits:', creditsError);
      throw creditsError;
    }
    const permanentCredits = creditsData?.balance ?? 0;

    // Expiring credits
    const { data: expiringData, error: expiringError } = await supabase
      .from('expiring_credits')
      .select('amount')
      .eq('user_id', userId);
    
    if (expiringError) {
      console.error('Error getting expiring credits:', expiringError);
      throw expiringError;
    }
    
    const expiringCredits = expiringData?.reduce((sum, row) => sum + (row.amount ?? 0), 0) ?? 0;

    const total = permanentCredits + expiringCredits;
    console.log(`Online credits - Permanent: ${permanentCredits}, Expiring: ${expiringCredits}, Total: ${total}`);
    
    return total;
  } catch (error) {
    console.error('Error in getCreditsOnline:', error);
    throw error;
  }
};

/**
 * Add permanent credits for the current user (upsert row)
 */
export const addCreditsOnline = async (amount: number) => {
  const userId = await checkAuth();
  const userEmail = await getUserEmail();

  try {
    // Try to update, if not exists, insert
    const { data, error } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking existing credits:', error);
      throw error;
    }

    if (data) {
      // Update existing
      const { error: updateErr } = await supabase
        .from('credits')
        .update({ balance: data.balance + amount })
        .eq('user_id', userId);
      
      if (updateErr) {
        console.error('Error updating credits:', updateErr);
        throw updateErr;
      }
      
      console.log(`Updated permanent credits: ${data.balance} + ${amount} = ${data.balance + amount}`);
    } else {
      // Insert new
      const { error: insertErr } = await supabase
        .from('credits')
        .insert([{ user_id: userId, user_email: userEmail, balance: amount }]);
      
      if (insertErr) {
        console.error('Error inserting credits:', insertErr);
        throw insertErr;
      }
      
      console.log(`Inserted new permanent credits: ${amount}`);
    }
  } catch (error) {
    console.error('Error in addCreditsOnline:', error);
    throw error;
  }
};

/**
 * Add expiring credits for the current user
 */
export const addExpiringCreditsOnline = async (amount: number, expires_at: string) => {
  const userId = await checkAuth();
  const userEmail = await getUserEmail();

  try {
    const { error } = await supabase
      .from('expiring_credits')
      .insert([{ user_id: userId, user_email: userEmail, amount, expires_at }]);
    
    if (error) {
      console.error('Error adding expiring credits:', error);
      throw error;
    }
    
    console.log(`Added expiring credits: ${amount} expiring at ${expires_at}`);
  } catch (error) {
    console.error('Error in addExpiringCreditsOnline:', error);
    throw error;
  }
};

/**
 * Remove expired credits for the current user
 */
export const cleanupExpiredCreditsOnline = async () => {
  const userId = await checkAuth();

  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('expiring_credits')
      .delete()
      .lt('expires_at', now)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error cleaning up expired credits:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in cleanupExpiredCreditsOnline:', error);
    throw error;
  }
};

/**
 * Spend credits (expiring first, then permanent) for the current user
 * Returns true if successful, false if insufficient credits
 */
export const spendCreditsOnline = async (amount: number): Promise<boolean> => {
  const userId = await checkAuth();

  try {
    await cleanupExpiredCreditsOnline();

    // Get all expiring credits, sorted by soonest expiry
    const { data: expiring, error: expErr } = await supabase
      .from('expiring_credits')
      .select('id, amount')
      .eq('user_id', userId)
      .order('expires_at', { ascending: true });
    
    if (expErr) {
      console.error('Error getting expiring credits for spending:', expErr);
      throw expErr;
    }

    let amountToDeduct = amount;
    for (const credit of expiring ?? []) {
      if (amountToDeduct === 0) break;
      const deduct = Math.min(amountToDeduct, credit.amount);
      const newAmount = credit.amount - deduct;
      amountToDeduct -= deduct;

      if (newAmount === 0) {
        const { error: deleteErr } = await supabase
          .from('expiring_credits')
          .delete()
          .eq('id', credit.id);
        
        if (deleteErr) {
          console.error('Error deleting expired credit:', deleteErr);
          throw deleteErr;
        }
      } else {
        const { error: updateErr } = await supabase
          .from('expiring_credits')
          .update({ amount: newAmount })
          .eq('id', credit.id);
        
        if (updateErr) {
          console.error('Error updating expiring credit:', updateErr);
          throw updateErr;
        }
      }
    }

    if (amountToDeduct > 0) {
      // Deduct from permanent credits
      const { data, error } = await supabase
        .from('credits')
        .select('balance')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('Error getting permanent credits for spending:', error);
        throw error;
      }
      
      if ((data?.balance ?? 0) < amountToDeduct) {
        console.log(`Insufficient credits: need ${amountToDeduct}, have ${data?.balance ?? 0}`);
        return false;
      }

      const { error: updateErr } = await supabase
        .from('credits')
        .update({ balance: data.balance - amountToDeduct })
        .eq('user_id', userId);
      
      if (updateErr) {
        console.error('Error updating permanent credits:', updateErr);
        throw updateErr;
      }
    }

    console.log(`Successfully spent ${amount} credits online`);
    return true;
  } catch (error) {
    console.error('Error in spendCreditsOnline:', error);
    throw error;
  }
};

// --- Online Purchase Tracking (Supabase) ---
/**
 * Track a purchase in the database
 */
export const trackPurchaseOnline = async (
  productId: string,
  purchaseDate: string,
  transactionId: string,
  amount: number,
  currency: string = 'INR',
  status: 'pending' | 'completed' | 'failed' = 'completed'
): Promise<any> => {
  const userId = await checkAuth();
  const userEmail = await getUserEmail();

  try {
    const { data, error } = await supabase
      .from('purchases')
      .insert([
        {
          user_id: userId,
          user_email: userEmail,
          product_id: productId,
          purchase_date: purchaseDate,
          transaction_id: transactionId,
          amount,
          currency,
          status,
          created_at: new Date().toISOString(),
        },
      ])
      .select();
    
    if (error) {
      console.error('Error tracking purchase:', error);
      throw error;
    }
    
    console.log(`Purchase tracked: ${productId} - ${transactionId}`);
    return data?.[0];
  } catch (error) {
    console.error('Error in trackPurchaseOnline:', error);
    throw error;
  }
};

/**
 * Get all purchases for the current user
 */
export const getAllPurchasesOnline = async (): Promise<any[]> => {
  const userId = await checkAuth();
  
  try {
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error getting purchases:', error);
      throw error;
    }
    
    return data ?? [];
  } catch (error) {
    console.error('Error in getAllPurchasesOnline:', error);
    throw error;
  }
};

/**
 * Check if a purchase has already been processed for credits
 */
export const isPurchaseProcessedOnline = async (transactionId: string): Promise<boolean> => {
  const userId = await checkAuth();
  
  try {
    const { data, error } = await supabase
      .from('purchases')
      .select('id, status')
      .eq('user_id', userId)
      .eq('transaction_id', transactionId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking purchase status:', error);
      throw error;
    }
    
    return data?.status === 'completed';
  } catch (error) {
    console.error('Error in isPurchaseProcessedOnline:', error);
    return false;
  }
};

/**
 * Mark a purchase as processed for credits
 */
export const markPurchaseAsProcessedOnline = async (transactionId: string): Promise<void> => {
  const userId = await checkAuth();
  
  try {
    const { error } = await supabase
      .from('purchases')
      .update({ 
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('transaction_id', transactionId);
    
    if (error) {
      console.error('Error marking purchase as processed:', error);
      throw error;
    }
    
    console.log(`Purchase marked as processed: ${transactionId}`);
  } catch (error) {
    console.error('Error in markPurchaseAsProcessedOnline:', error);
    throw error;
  }
};

// --- Online Credit Restoration Tracking (Supabase) ---
/**
 * Track a credit restoration attempt
 */
export const trackCreditRestorationOnline = async (
  productId: string,
  transactionId: string,
  expectedCredits: number,
  actualCreditsAdded: number,
  restorationReason: 'initial_purchase' | 'verification' | 'manual_restore' = 'verification',
  status: 'success' | 'partial' | 'failed' = 'success'
): Promise<any> => {
  const userId = await checkAuth();
  const userEmail = await getUserEmail();

  try {
    const { data, error } = await supabase
      .from('credit_restorations')
      .insert([
        {
          user_id: userId,
          user_email: userEmail,
          product_id: productId,
          transaction_id: transactionId,
          expected_credits: expectedCredits,
          actual_credits_added: actualCreditsAdded,
          restoration_reason: restorationReason,
          status,
          created_at: new Date().toISOString(),
        },
      ])
      .select();
    
    if (error) {
      console.error('Error tracking credit restoration:', error);
      throw error;
    }
    
    console.log(`Credit restoration tracked: ${productId} - ${actualCreditsAdded} credits`);
    return data?.[0];
  } catch (error) {
    console.error('Error in trackCreditRestorationOnline:', error);
    throw error;
  }
};

/**
 * Get all credit restoration attempts for the current user
 */
export const getAllCreditRestorationsOnline = async (): Promise<any[]> => {
  const userId = await checkAuth();
  
  try {
    const { data, error } = await supabase
      .from('credit_restorations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error getting credit restorations:', error);
      throw error;
    }
    
    return data ?? [];
  } catch (error) {
    console.error('Error in getAllCreditRestorationsOnline:', error);
    throw error;
  }
};

/**
 * Check if a transaction has already been restored
 */
export const isTransactionRestoredOnline = async (transactionId: string): Promise<boolean> => {
  const userId = await checkAuth();
  
  try {
    const { data, error } = await supabase
      .from('credit_restorations')
      .select('id')
      .eq('user_id', userId)
      .eq('transaction_id', transactionId)
      .eq('status', 'success')
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking restoration status:', error);
      throw error;
    }
    
    return !!data;
  } catch (error) {
    console.error('Error in isTransactionRestoredOnline:', error);
    return false;
  }
};

/**
 * Get restoration statistics for the current user
 */
export const getRestorationStatsOnline = async (): Promise<{
  totalRestorations: number;
  successfulRestorations: number;
  totalCreditsRestored: number;
  lastRestorationDate?: string;
}> => {
  const userId = await checkAuth();
  
  try {
    const { data, error } = await supabase
      .from('credit_restorations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error getting restoration stats:', error);
      throw error;
    }
    
    const restorations = data ?? [];
    const successfulRestorations = restorations.filter(r => r.status === 'success');
    const totalCreditsRestored = successfulRestorations.reduce((sum, r) => sum + (r.actual_credits_added || 0), 0);
    
    return {
      totalRestorations: restorations.length,
      successfulRestorations: successfulRestorations.length,
      totalCreditsRestored,
      lastRestorationDate: restorations[0]?.created_at
    };
  } catch (error) {
    console.error('Error in getRestorationStatsOnline:', error);
    throw error;
  }
}; 