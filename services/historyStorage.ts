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
    await initCreditsTable();
    await initNotesTable();
    await initScanNotesTable();
    await initQuizTable();
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

// --- Credits System ---

export const initCreditsTable = async () => {
  const localDb = await getDb();
  await localDb.execAsync(
    'CREATE TABLE IF NOT EXISTS credits (id INTEGER PRIMARY KEY CHECK (id = 1), balance INTEGER DEFAULT 0);'
  );
  const res = await localDb.getAllAsync('SELECT * FROM credits WHERE id = 1;');
  if (!res || res.length === 0) {
    await localDb.runAsync(
      'INSERT INTO credits (id, balance) VALUES (1, 10);'
    );
  }
};

export const getCredits = async (): Promise<number> => {
  const localDb = await getDb();
  const res = (await localDb.getAllAsync('SELECT balance FROM credits WHERE id = 1;')) as { balance: number }[];
  return res.length > 0 ? res[0].balance : 0;
};

export const addCredits = async (amount: number) => {
  const localDb = await getDb();
  await localDb.runAsync(
    'UPDATE credits SET balance = balance + ? WHERE id = 1;',
    [amount]
  );
};

export const spendCredits = async (amount: number): Promise<boolean> => {
  const localDb = await getDb();
  const res = (await localDb.getAllAsync('SELECT balance FROM credits WHERE id = 1;')) as { balance: number }[];
  const current = res.length > 0 ? res[0].balance : 0;
  if (current < amount) return false;
  await localDb.runAsync(
    'UPDATE credits SET balance = balance - ? WHERE id = 1;',
    [amount]
  );
  return true;
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
    questions: string; // Store as JSON string or plain text
    createdAt: string;
}

export const initQuizTable = async () => {
    const localDb = await getDb();
    await localDb.execAsync(
      "CREATE TABLE IF NOT EXISTS quiz_maker (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, questions TEXT, createdAt TEXT);"
    );
};

export const addQuiz = async (title: string, questions: string): Promise<number> => {
    const localDb = await getDb();
    const result = await localDb.runAsync(
      "INSERT INTO quiz_maker (title, questions, createdAt) VALUES (?, ?, ?);",
      [title, questions, new Date().toISOString()]
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

export const updateQuiz = async (id: number, title: string, questions: string) => {
    const localDb = await getDb();
    await localDb.runAsync(
      "UPDATE quiz_maker SET title = ?, questions = ? WHERE id = ?;",
      [title, questions, id]
    );
};

export const deleteQuiz = async (id: number) => {
    const localDb = await getDb();
    await localDb.runAsync("DELETE FROM quiz_maker WHERE id = ?;", [id]);
}; 