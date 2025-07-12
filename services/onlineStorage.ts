import { supabase } from '../utils/supabase';

// Helper to get current user ID
const getUserId = async () => {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id;
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
  const { data, error } = await supabase
    .from('history')
    .insert([
      {
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
  const { data, error } = await supabase
    .from('history')
    .select('*')
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const updateHistoryAnswerOnline = async (id: number, aiAnswer: string) => {
  const { error } = await supabase
    .from('history')
    .update({ aiAnswer })
    .eq('id', id);
  if (error) throw error;
};

// --- Online Notes (Supabase) ---
/**
 * Add a note to Supabase
 */
export const addNoteOnline = async (title: string, content: string): Promise<any> => {
  const { data, error } = await supabase
    .from('notes')
    .insert([
      {
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
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

/**
 * Update a note in Supabase
 */
export const updateNoteOnline = async (id: number, title: string, content: string) => {
  const { error } = await supabase
    .from('notes')
    .update({ title, content })
    .eq('id', id);
  if (error) throw error;
};

/**
 * Delete a note in Supabase
 */
export const deleteNoteOnline = async (id: number) => {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// --- Online Scan Notes (Supabase) ---
export const addScanNoteOnline = async (title: string, content: string): Promise<any> => {
  const { data, error } = await supabase
    .from('scan_notes')
    .insert([
      {
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
  const { data, error } = await supabase
    .from('scan_notes')
    .select('*')
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const updateScanNoteOnline = async (id: number, title: string, content: string) => {
  const { error } = await supabase
    .from('scan_notes')
    .update({ title, content })
    .eq('id', id);
  if (error) throw error;
};

export const deleteScanNoteOnline = async (id: number) => {
  const { error } = await supabase
    .from('scan_notes')
    .delete()
    .eq('id', id);
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
  const { data, error } = await supabase
    .from('quiz_maker')
    .insert([
      {
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
  const { data, error } = await supabase
    .from('quiz_maker')
    .select('*')
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const updateQuizOnline = async (id: number, title: string, content: string) => {
  const { error } = await supabase
    .from('quiz_maker')
    .update({ title, content })
    .eq('id', id);
  if (error) throw error;
};

export const deleteQuizOnline = async (id: number) => {
  const { error } = await supabase
    .from('quiz_maker')
    .delete()
    .eq('id', id);
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
  const { data, error } = await supabase
    .from('flash_card_sets')
    .insert([
      {
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
  const { data, error } = await supabase
    .from('flash_card_sets')
    .select('*')
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const updateFlashCardSetOnline = async (id: number, title: string, content: string) => {
  const { error } = await supabase
    .from('flash_card_sets')
    .update({ title, content })
    .eq('id', id);
  if (error) throw error;
};

export const deleteFlashCardSetOnline = async (id: number) => {
  const { error } = await supabase
    .from('flash_card_sets')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// --- Online Credits System (Supabase) ---
/**
 * Get total credits (permanent + expiring, minus expired) for the current user
 */
export const getCreditsOnline = async (): Promise<number> => {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  // Clean up expired credits
  await cleanupExpiredCreditsOnline();

  // Permanent credits
  const { data: creditsData, error: creditsError } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', userId)
    .single();
  if (creditsError && creditsError.code !== 'PGRST116') throw creditsError; // ignore not found
  const permanentCredits = creditsData?.balance ?? 0;

  // Expiring credits
  const { data: expiringData, error: expiringError } = await supabase
    .from('expiring_credits')
    .select('amount')
    .eq('user_id', userId);
  if (expiringError) throw expiringError;
  const expiringCredits = expiringData?.reduce((sum, row) => sum + (row.amount ?? 0), 0) ?? 0;

  return permanentCredits + expiringCredits;
};

/**
 * Add permanent credits for the current user (upsert row)
 */
export const addCreditsOnline = async (amount: number) => {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  // Try to update, if not exists, insert
  const { data, error } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;

  if (data) {
    // Update existing
    const { error: updateErr } = await supabase
      .from('credits')
      .update({ balance: data.balance + amount })
      .eq('user_id', userId);
    if (updateErr) throw updateErr;
  } else {
    // Insert new
    const { error: insertErr } = await supabase
      .from('credits')
      .insert([{ user_id: userId, balance: amount }]);
    if (insertErr) throw insertErr;
  }
};

/**
 * Add expiring credits for the current user
 */
export const addExpiringCreditsOnline = async (amount: number, expires_at: string) => {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('expiring_credits')
    .insert([{ user_id: userId, amount, expires_at }]);
  if (error) throw error;
};

/**
 * Remove expired credits for the current user
 */
export const cleanupExpiredCreditsOnline = async () => {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('expiring_credits')
    .delete()
    .lt('expires_at', now)
    .eq('user_id', userId);
  if (error) throw error;
};

/**
 * Spend credits (expiring first, then permanent) for the current user
 * Returns true if successful, false if insufficient credits
 */
export const spendCreditsOnline = async (amount: number): Promise<boolean> => {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  await cleanupExpiredCreditsOnline();

  // Get all expiring credits, sorted by soonest expiry
  const { data: expiring, error: expErr } = await supabase
    .from('expiring_credits')
    .select('id, amount')
    .eq('user_id', userId)
    .order('expires_at', { ascending: true });
  if (expErr) throw expErr;

  let amountToDeduct = amount;
  for (const credit of expiring ?? []) {
    if (amountToDeduct === 0) break;
    const deduct = Math.min(amountToDeduct, credit.amount);
    const newAmount = credit.amount - deduct;
    amountToDeduct -= deduct;

    if (newAmount === 0) {
      await supabase.from('expiring_credits').delete().eq('id', credit.id);
    } else {
      await supabase.from('expiring_credits').update({ amount: newAmount }).eq('id', credit.id);
    }
  }

  if (amountToDeduct > 0) {
    // Deduct from permanent credits
    const { data, error } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    if ((data?.balance ?? 0) < amountToDeduct) return false;

    const { error: updateErr } = await supabase
      .from('credits')
      .update({ balance: data.balance - amountToDeduct })
      .eq('user_id', userId);
    if (updateErr) throw updateErr;
  }

  return true;
}; 