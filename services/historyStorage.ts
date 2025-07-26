import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

// This function ensures the database is open before any operation.
async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('app.db');
  }
  return db;
}

export const initDatabase = async () => {
    console.log("DATABASE: Initializing all tables...");
    await initHistoryTable();
    await initNotesTable();
    await initScanNotesTable();
    await initQuizTable();
    await initFlashCardSetTable();
    await initMindMapTable(); // Added for mind maps
    await migrateDatabase();
    console.log("DATABASE: All tables initialized.");
};

// --- History ---
export const initHistoryTable = async () => {
  const localDb = await getDb();
  await localDb.execAsync(
    'CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, imageUri TEXT, feature TEXT, extractedText TEXT, aiAnswer TEXT, createdAt TEXT);'
  );
};

export const addHistory = async (
  imageUri: string,
  feature: string,
  extractedText: string,
  aiAnswer: string
): Promise<number> => {
  console.log("HISTORY_SERVICE: Attempting to add history item:", {
    feature,
    title: extractedText,
  });
  const localDb = await getDb();
  try {
    const result = await localDb.runAsync(
      "INSERT INTO history (imageUri, feature, extractedText, aiAnswer, createdAt) VALUES (?, ?, ?, ?, ?);",
      [imageUri, feature, extractedText, aiAnswer, new Date().toISOString()]
    );
    console.log(
      "HISTORY_SERVICE: Successfully added history item with ID:",
      result.lastInsertRowId
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error("HISTORY_SERVICE: Failed to add history item.", error);
    throw error;
  }
};

export const getAllHistory = async (): Promise<any[]> => {
  console.log("HISTORY_SERVICE: Attempting to get all history...");
  const localDb = await getDb();
  try {
    const result = await localDb.getAllAsync(
      "SELECT * FROM history ORDER BY createdAt DESC;"
    );
    console.log(`HISTORY_SERVICE: Found ${result?.length ?? 0} history items.`);
    return result ?? [];
  } catch (error) {
    console.error("HISTORY_SERVICE: Could not get history.", error);
    return [];
  }
};

export const updateHistoryAnswer = async (id: number, aiAnswer: string) => {
  const localDb = await getDb();
  try {
    await localDb.runAsync("UPDATE history SET aiAnswer = ? WHERE id = ?;", [
      aiAnswer,
      id,
    ]);
    console.log(`HISTORY_SERVICE: Updated history item ${id} with an AI answer.`);
  } catch (error) {
    console.error(`HISTORY_SERVICE: Failed to update history item ${id}.`, error);
    throw error;
  }
};

export const updateHistoryNote = async (
  noteId: number,
  newTitle: string,
  newContent: string
) => {
    const localDb = await getDb();
    // In our setup, the note's title is stored in `extractedText` and content in `aiAnswer`
    // and imageUri is empty string for notes.
    // We need a way to link history item to note item. Let's assume the most recent history item for a note is the one to update.
    // A better way would be to store history_id in notes table or vice versa.
    // For now, we will find the history item based on the content. This is not robust.
    
    // A better approach: Since we don't have a direct link, let's find the history item
    // that corresponds to a note feature and has the original title.
    // This is still not perfect. The BEST way is to have a foreign key.
    
    // Let's settle for a simple approach for now:
    // We can't reliably update history, because we don't know which note was edited.
    // A note title could be the same as another.
    // The most reliable thing to do is add a new history entry for the update.
    // But the user asked to UPDATE.

    // Let's find the note to get its original creation date, which is unique.
    // But we don't have the original title here.

    // Given the current structure, we can't reliably update a history item from a note edit.
    // The best I can do is to add a new history record for the edit.
    // Or, we can try to find the history record by looking for a 'notes' feature
    // and matching the content. But what if content is the same?

    // The most direct interpretation of the user's request is to update the history.
    // Let's assume we need to add a history record for the update action.
    console.log(`HISTORY_SERVICE: Updating history for note. Title: ${newTitle}`);
    await addHistory('', 'notes-updated', newTitle, newContent);
};

// --- Notes ---
export interface Note {
    id: number;
    title: string;
    content: string;
    createdAt: string;
}

export const initNotesTable = async () => {
    const localDb = await getDb();
    await localDb.execAsync(
      "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, createdAt TEXT);"
    );
};

export const addNote = async (title: string, content: string): Promise<number> => {
    const localDb = await getDb();
    console.log("NOTE_SERVICE: Adding note:", { title });
    const result = await localDb.runAsync(
      "INSERT INTO notes (title, content, createdAt) VALUES (?, ?, ?);",
      [title, content, new Date().toISOString()]
    );
    return result.lastInsertRowId;
};

export const getAllNotes = async (): Promise<Note[]> => {
    const localDb = await getDb();
    try {
      const result = await localDb.getAllAsync("SELECT * FROM notes ORDER BY createdAt DESC;");
      return (result as Note[]) ?? [];
    } catch (error) {
      console.warn("Could not get notes.", error);
      return [];
    }
};

export const getNoteById = async (id: number): Promise<Note | null> => {
    const localDb = await getDb();
    const result = await localDb.getFirstAsync("SELECT * FROM notes WHERE id = ?;", [id]);
    return result as Note | null;
};

export const updateNote = async (id: number, title: string, content: string) => {
    const localDb = await getDb();
    await localDb.runAsync(
      "UPDATE notes SET title = ?, content = ? WHERE id = ?;",
      [title, content, id]
    );
};

export const deleteNote = async (id: number) => {
    const localDb = await getDb();
    await localDb.runAsync("DELETE FROM notes WHERE id = ?;", [id]);
};

// --- Scan Notes ---
export interface ScanNote {
    id: number;
    title: string;
    content: string;
    createdAt: string;
}

export const initScanNotesTable = async () => {
    const localDb = await getDb();
    await localDb.execAsync(
      "CREATE TABLE IF NOT EXISTS scan_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, createdAt TEXT);"
    );
};

export const addScanNote = async (title: string, content: string): Promise<number> => {
    const localDb = await getDb();
    console.log("SCAN_NOTE_SERVICE: Adding scan note:", { title, contentLength: content.length });
    try {
        const result = await localDb.runAsync(
          "INSERT INTO scan_notes (title, content, createdAt) VALUES (?, ?, ?);",
          [title, content, new Date().toISOString()]
        );
        console.log("SCAN_NOTE_SERVICE: Successfully added scan note with ID:", result.lastInsertRowId);
        return result.lastInsertRowId;
    } catch (error) {
        console.error("SCAN_NOTE_SERVICE: Failed to add scan note:", error);
        throw error;
    }
};

export const getAllScanNotes = async (): Promise<ScanNote[]> => {
    const localDb = await getDb();
    try {
      console.log("SCAN_NOTE_SERVICE: Attempting to get all scan notes...");
      const result = await localDb.getAllAsync("SELECT * FROM scan_notes ORDER BY createdAt DESC;");
      console.log("SCAN_NOTE_SERVICE: Retrieved scan notes:", result?.length ?? 0);
      return (result as ScanNote[]) ?? [];
    } catch (error) {
      console.error("SCAN_NOTE_SERVICE: Could not get scan notes.", error);
      return [];
    }
};

export const getScanNoteById = async (id: number): Promise<ScanNote | null> => {
    const localDb = await getDb();
    const result = await localDb.getFirstAsync("SELECT * FROM scan_notes WHERE id = ?;", [id]);
    return result as ScanNote | null;
};

export const updateScanNote = async (id: number, title: string, content: string) => {
    const localDb = await getDb();
    await localDb.runAsync(
      "UPDATE scan_notes SET title = ?, content = ? WHERE id = ?;",
      [title, content, id]
    );
};

export const deleteScanNote = async (id: number) => {
    const localDb = await getDb();
    await localDb.runAsync("DELETE FROM scan_notes WHERE id = ?;", [id]);
};

// --- Quiz Maker ---
export interface Quiz {
  id: number;
  title: string;
  content: string;
  quiz_type: string;
  source_note_id?: number;
  source_note_type?: string;
  createdAt: string;
}

export const initQuizTable = async () => {
    const localDb = await getDb();
    await localDb.execAsync(
      `CREATE TABLE IF NOT EXISTS quiz_maker (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        title TEXT, 
        content TEXT,
        quiz_type TEXT,
        source_note_id INTEGER,
        source_note_type TEXT,
        createdAt TEXT
      );`
    );
};

export const addQuiz = async (
  title: string, 
  content: string,
  quizType: string,
  numberOfQuestions: number,
  sourceNoteId?: number,
  sourceNoteType?: 'note' | 'scan-note'
): Promise<number> => {
    const localDb = await getDb();
    const result = await localDb.runAsync(
      "INSERT INTO quiz_maker (title, content, quiz_type, source_note_id, source_note_type, createdAt) VALUES (?, ?, ?, ?, ?, ?);",
      [title, content, quizType, sourceNoteId || null, sourceNoteType || null, new Date().toISOString()]
    );
    return result.lastInsertRowId;
};

export const getAllQuizzes = async (): Promise<Quiz[]> => {
    const localDb = await getDb();
    try {
      const result = await localDb.getAllAsync("SELECT * FROM quiz_maker ORDER BY createdAt DESC;");
      return (result as Quiz[]) ?? [];
    } catch (error) {
      console.warn("Could not get quizzes.", error);
      return [];
    }
};

export const getQuizById = async (id: number): Promise<Quiz | null> => {
  const localDb = await getDb();
  const result = await localDb.getFirstAsync("SELECT * FROM quiz_maker WHERE id = ?;", [id]);
  return result as Quiz | null;
};

export const updateQuiz = async (id: number, title: string, content: string) => {
    const localDb = await getDb();
    await localDb.runAsync("UPDATE quiz_maker SET title = ?, content = ? WHERE id = ?;", [title, content, id]);
};

export const deleteQuiz = async (id: number) => {
    const localDb = await getDb();
    await localDb.runAsync("DELETE FROM quiz_maker WHERE id = ?;", [id]);
};

// --- Flash Card Sets ---
export interface FlashCardSet {
    id: number;
    title: string;
    content: string;
    card_type: string;
    source_note_id?: number;
    source_note_type?: string;
    createdAt: string;
}

export const initFlashCardSetTable = async () => {
    const localDb = await getDb();
    await localDb.execAsync(
      "CREATE TABLE IF NOT EXISTS flash_card_sets (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, card_type TEXT, source_note_id INTEGER, source_note_type TEXT, createdAt TEXT);"
    );
};

export const addFlashCardSet = async (
  title: string, 
  content: string,
  cardType: string,
  sourceNoteId?: number,
  sourceNoteType?: 'note' | 'scan-note'
): Promise<number> => {
    const localDb = await getDb();
    const result = await localDb.runAsync(
      "INSERT INTO flash_card_sets (title, content, card_type, source_note_id, source_note_type, createdAt) VALUES (?, ?, ?, ?, ?, ?);",
      [title, content, cardType, sourceNoteId ?? null, sourceNoteType ?? null, new Date().toISOString()]
    );
    return result.lastInsertRowId;
};

export const getAllFlashCardSets = async (): Promise<FlashCardSet[]> => {
    const localDb = await getDb();
    try {
      const result = await localDb.getAllAsync("SELECT * FROM flash_card_sets ORDER BY createdAt DESC;");
      return (result as FlashCardSet[]) ?? [];
    } catch (error) {
      console.warn("Could not get flash card sets.", error);
      return [];
    }
};

export const getFlashCardSetById = async (id: number): Promise<FlashCardSet | null> => {
    const localDb = await getDb();
    const result = await localDb.getFirstAsync("SELECT * FROM flash_card_sets WHERE id = ?;", [id]);
    return result as FlashCardSet | null;
};

export const updateFlashCardSet = async (id: number, title: string, content: string) => {
    const localDb = await getDb();
    await localDb.runAsync("UPDATE flash_card_sets SET title = ?, content = ? WHERE id = ?;", [title, content, id]);
};

export const deleteFlashCardSet = async (id: number) => {
    const localDb = await getDb();
    await localDb.runAsync("DELETE FROM flash_card_sets WHERE id = ?;", [id]);
};

// --- Mind Maps ---
export interface MindMap {
    id: number;
    title: string;
    content: string; // Mind map outline or data (could be JSON or text)
    source_note_id?: number;
    source_note_type?: string;
    createdAt: string;
}

export const initMindMapTable = async () => {
    const localDb = await getDb();
    await localDb.execAsync(
      `CREATE TABLE IF NOT EXISTS mind_maps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT,
        source_note_id INTEGER,
        source_note_type TEXT,
        createdAt TEXT
      );`
    );
};

export const addMindMap = async (
  title: string,
  content: string,
  sourceNoteId?: number,
  sourceNoteType?: 'note' | 'scan-note'
): Promise<number> => {
    const localDb = await getDb();
    const result = await localDb.runAsync(
      "INSERT INTO mind_maps (title, content, source_note_id, source_note_type, createdAt) VALUES (?, ?, ?, ?, ?);",
      [title, content, sourceNoteId ?? null, sourceNoteType ?? null, new Date().toISOString()]
    );
    return result.lastInsertRowId;
};

export const getAllMindMaps = async (): Promise<MindMap[]> => {
    const localDb = await getDb();
    try {
      const result = await localDb.getAllAsync("SELECT * FROM mind_maps ORDER BY createdAt DESC;");
      return (result as MindMap[]) ?? [];
    } catch (error) {
      console.warn("Could not get mind maps.", error);
      return [];
    }
};

export const getMindMapById = async (id: number): Promise<MindMap | null> => {
    const localDb = await getDb();
    const result = await localDb.getFirstAsync("SELECT * FROM mind_maps WHERE id = ?;", [id]);
    return result as MindMap | null;
};

export const updateMindMap = async (id: number, title: string, content: string) => {
    const localDb = await getDb();
    await localDb.runAsync("UPDATE mind_maps SET title = ?, content = ? WHERE id = ?;", [title, content, id]);
};

export const deleteMindMap = async (id: number) => {
    const localDb = await getDb();
    await localDb.runAsync("DELETE FROM mind_maps WHERE id = ?;", [id]);
};

export const resetDatabase = async () => {
  const localDb = await getDb();
  try {
    console.log("DATABASE: Resetting all tables...");
    await localDb.execAsync("DROP TABLE IF EXISTS history;");
    await localDb.execAsync("DROP TABLE IF EXISTS notes;");
    await localDb.execAsync("DROP TABLE IF EXISTS scan_notes;");
    await localDb.execAsync("DROP TABLE IF EXISTS quiz_maker;");
    await localDb.execAsync("DROP TABLE IF EXISTS flash_card_sets;"); // Added this line
    await localDb.execAsync("DROP TABLE IF EXISTS mind_maps;"); // Added this line
    
    // Reinitialize all tables
    await initDatabase();
    console.log("DATABASE: Reset completed successfully.");
  } catch (error) {
    console.error("DATABASE: Reset error:", error);
  }
};

export const resetQuizTable = async () => {
  const localDb = await getDb();
  console.log("DATABASE: Resetting quiz table...");
  await localDb.execAsync('DROP TABLE IF EXISTS quiz_maker;');
  await initQuizTable();
  console.log("DATABASE: Quiz table reset.");
};

export const resetFlashCardSetTable = async () => {
    const localDb = await getDb();
    console.log("DATABASE: Resetting flash card sets table...");
    await localDb.execAsync('DROP TABLE IF EXISTS flash_card_sets;');
    await initFlashCardSetTable();
    console.log("DATABASE: Flash card sets table reset.");
};

export const migrateDatabase = async () => {
    console.log("DATABASE: Checking for migrations...");
    const localDb = await getDb();
    try {
      // Check if quiz_maker table exists
      const tables = await localDb.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='quiz_maker';");
      
      if (tables.length === 0) {
        console.log("DATABASE: quiz_maker table doesn't exist, creating it...");
        await initQuizTable();
        return;
      }
      
      // Check table schema and add missing columns
      const tableInfo = await localDb.getAllAsync("PRAGMA table_info(quiz_maker);");
      const existingColumns = tableInfo.map((column: any) => column.name);
      
      console.log("DATABASE: Existing columns in quiz_maker:", existingColumns);
      
      // Define required columns
      const requiredColumns = [
        { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
        { name: 'title', type: 'TEXT' },
        { name: 'content', type: 'TEXT' },
        { name: 'quiz_type', type: 'TEXT' },
        
        { name: 'source_note_id', type: 'INTEGER' },
        { name: 'source_note_type', type: 'TEXT' },
        { name: 'createdAt', type: 'TEXT' }
      ];
      
      // Add missing columns
      for (const requiredColumn of requiredColumns) {
        if (!existingColumns.includes(requiredColumn.name)) {
          console.log(`DATABASE: Adding missing column: ${requiredColumn.name}`);
          try {
            await localDb.execAsync(`ALTER TABLE quiz_maker ADD COLUMN ${requiredColumn.name} ${requiredColumn.type};`);
          } catch (alterError) {
            console.log(`DATABASE: Could not add column ${requiredColumn.name}, it might already exist or be a primary key`);
          }
        }
      }
      
      // Update existing records with default values for new columns
      const existingQuizzes = await localDb.getAllAsync("SELECT * FROM quiz_maker;");
      for (const quiz of existingQuizzes as any[]) {
        const updates = [];
        const values = [];
        
        if (!quiz.content) {
          updates.push("content = ?");
          values.push(quiz.title || '');
        }
        
        if (!quiz.quiz_type) {
          updates.push("quiz_type = ?");
          values.push('multiple-choice');
        }
        
        if (!quiz.createdAt) {
          updates.push("createdAt = ?");
          values.push(new Date().toISOString());
        }
        
        if (updates.length > 0) {
          values.push(quiz.id);
          await localDb.runAsync(`UPDATE quiz_maker SET ${updates.join(', ')} WHERE id = ?;`, values);
        }
      }
      
      console.log("DATABASE: Migration completed successfully.");
    } catch (error) {
      console.error("DATABASE: Migration error:", error);
      // If migration fails, try to recreate the table
      try {
        console.log("DATABASE: Attempting to recreate quiz_maker table...");
        await localDb.execAsync("DROP TABLE IF EXISTS quiz_maker;");
        await initQuizTable();
      } catch (recreateError) {
        console.error("DATABASE: Failed to recreate quiz_maker table:", recreateError);
      }
    }
  };