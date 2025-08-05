import axios from "axios";
import * as FileSystem from "expo-file-system";

// Supabase Edge Function configuration

const SUPABASE_BASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL_FUNCTIONS;
const SUPABASE_BEARER_TOKEN = process.env.EXPO_PUBLIC_SUPABASE_BEARER_TOKEN;
// console.log('GEMINI_SERVICE: Supabase base URL:', SUPABASE_BASE_URL);
// console.log('GEMINI_SERVICE: Supabase bearer token:', SUPABASE_BEARER_TOKEN);

//const SUPABASE_BASE_URL = "https://mnjhkeygyczkziowlrab.supabase.co/functions/v1";
//const SUPABASE_BEARER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uamhrZXlneWN6a3ppb3dscmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4ODQ4NzcsImV4cCI6MjA2NzQ2MDg3N30.9unaHI1ZXmSLMDf1szwmsR6oGXpDrn7-MTH-YXH5hng";
// Prompt templates for each feature/tool
const PROMPT_TEMPLATES: Record<string, (text: string) => string> = {
  "ai-scan": (text) => `\nYou are an expert AI homework assistant. Analyze the following image text and provide a clear, step-by-step solution or explanation.\n\nImage Content:\n"${text}"\n`,
  "calculator": (text) => `\nYou are a math expert. Solve the following math problem and show all steps:\n\nProblem:\n"${text}"\n`,
  "quiz-maker": (text) => `\nYou are a quiz generator. Create a multiple-choice quiz based on the following content:\n\nContent:\n"${text}"\n`,
  "study-notes": (text) => `\nYou are a study notes summarizer. Summarize the following content into concise, easy-to-read notes:\n\nContent:\n"${text}"\n`,
  "flash-cards": (text) => `\nYou are a flashcard generator. Create flashcards for the following content:\n\nContent:\n"${text}"\n`,
  "homework": (text) => `\nYou are a homework helper. Provide a detailed answer and explanation for the following question:\n\nQuestion:\n"${text}"\n`,
  "magic-eraser": (text) => `\nYou are an AI that helps remove irrelevant information. Extract only the important points from the following:\n\nContent:\n"${text}"\n`,
  "voice-notes": (text) => `\nYou are a transcription and summary expert. Summarize the following transcribed voice note:\n\nTranscription:\n"${text}"\n`,
  "pdf-scanner": (text) => `\nYou are a PDF content extractor. Summarize and highlight key points from the following PDF text:\n\nPDF Content:\n"${text}"\n`,
  "mind-maps": (text) => `\nYou are a mind map generator. Create a mind map outline for the following topic:\n\nTopic:\n"${text}"\n`,
  "timer": (text) => `\nYou are a productivity coach. Give tips for managing time based on the following user's input:\n\nInput:\n"${text}"\n`,
  "translator": (text) => `\nYou are a language translator. Translate the following text to English and explain any difficult words:\n\nText:\n"${text}"\n`,
  // Add more as needed...
  "default": (text) => `\nYou are an educational AI assistant. Analyze and respond to the following:\n\nContent:\n"${text}"\n`,
};

export const processImage = async (imageUri: string): Promise<string> => {
  try {
    console.log("GEMINI_SERVICE: Starting image processing for URI:", imageUri);
    
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    console.log("GEMINI_SERVICE: Successfully converted image to base64, length:", base64Image.length);

    const supabaseEdgeUrl = `${SUPABASE_BASE_URL}/process-image`;
    console.log('GEMINI_SERVICE: Supabase base URL:', SUPABASE_BASE_URL);
    console.log("GEMINI_SERVICE: Sending request to Supabase Edge Function...");
    
    const response = await axios.post(
      supabaseEdgeUrl,
      { imageBase64: base64Image },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_BEARER_TOKEN}`,
        },
      }
    );

    console.log("GEMINI_SERVICE: Received response from Supabase Edge Function");

    if (!response.data?.text) {
      console.warn("GEMINI_SERVICE: No text detected in the image response");
      throw new Error("No text detected in the image");
    }

    const extractedText = response.data.text;
    console.log("GEMINI_SERVICE: Successfully extracted text, length:", extractedText.length);
    console.log("GEMINI_SERVICE: Extracted text preview:", extractedText.substring(0, 100) + "...");

    return extractedText;
  } catch (error) {
    console.error("GEMINI_SERVICE: Error processing image:", error);
    if (axios.isAxiosError(error)) {
      console.error("GEMINI_SERVICE: Axios error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    }
    throw new Error("Failed to process image. Please try again with a clearer image.");
  }
};

export const getAnswerFromImage = async (
  imageUri: string,
  feature: string = 'ai-scan'
): Promise<{text: string, answer: string}> => {
  try {
    console.log("GEMINI_SERVICE: Starting direct image processing with Gemini for URI:", imageUri);
    
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const supabaseEdgeUrl = `${SUPABASE_BASE_URL}/get-image-answer`;
    console.log('GEMINI_SERVICE: Sending request to Supabase Edge Function for direct Gemini processing...');
    
    const response = await axios.post(
      supabaseEdgeUrl,
      { 
        imageBase64: base64Image,
        feature
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_BEARER_TOKEN}`,
        },
      }
    );

    console.log("GEMINI_SERVICE: Received response from Gemini image processing");

    if (!response.data?.text || !response.data?.answer) {
      console.warn("GEMINI_SERVICE: Invalid response from Gemini image processing");
      throw new Error("Failed to process image with Gemini");
    }

    return {
      text: response.data.text,
      answer: response.data.answer
    };
  } catch (error) {
    console.error("GEMINI_SERVICE: Error processing image with Gemini:", error);
    if (axios.isAxiosError(error)) {
      console.error("GEMINI_SERVICE: Axios error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    }
    throw new Error("Failed to process image with Gemini. Please try again with a clearer image.");
  }
};

export const getAnswerFromGemini = async (
  extractedText: string,
  feature: string
): Promise<string> => {
  const supabaseEdgeUrl = `${SUPABASE_BASE_URL}/getAnswerFromGemini`;
  
  console.log('GEMINI_SERVICE: Attempting to get answer from Gemini');
  console.log('GEMINI_SERVICE: URL:', supabaseEdgeUrl);
  console.log('GEMINI_SERVICE: Feature:', feature);
  console.log('GEMINI_SERVICE: Text length:', extractedText.length);
  
  try {
    const response = await axios.post(
      supabaseEdgeUrl,
      { 
        extractedText,
        feature 
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_BEARER_TOKEN}`,
        },
        timeout: 30000, // 30 second timeout
      }
    );

    console.log('GEMINI_SERVICE: Response received:', response.status);

    if (!response.data?.answer) {
      console.error('GEMINI_SERVICE: No answer in response data:', response.data);
      throw new Error('No valid response received from Edge Function');
    }

    return response.data.answer;
  } catch (error) {
    console.error('Error getting Gemini response:', error);
    
    if (axios.isAxiosError(error)) {
      console.error('GEMINI_SERVICE: Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        code: error.code
      });
      
      if (error.code === 'NETWORK_ERROR') {
        throw new Error('Network error: Please check your internet connection and try again.');
      }
      
      if (error.response?.status === 401) {
        throw new Error('Authentication error: Please check your API credentials.');
      }
      
      if (error.response?.status === 404) {
        throw new Error('Service not found: Edge function may not be deployed.');
      }
    }
    
    throw new Error('Failed to get AI response. Please try again later.');
  }
};

export const generateQuizFromNotes = async (
  notesContent: string,
  quizType: 'multiple-choice' | 'true-false' | 'fill-blank' = 'multiple-choice'
): Promise<string> => {
  const supabaseEdgeUrl = `${SUPABASE_BASE_URL}/genrateQuizFromNotes`;
  
  try {
    const response = await axios.post(
      supabaseEdgeUrl,
      { 
        notesContent,
        quizType 
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_BEARER_TOKEN}`,
        },
      }
    );

    if (!response.data?.quiz) {
      throw new Error('No valid response received from Edge Function');
    }

    return response.data.quiz;
  } catch (error) {
    console.error('Error generating quiz from notes:', error);
    throw new Error('Failed to generate quiz. Please try again later.');
  }
};

export const generateFlashCardsFromNotes = async (
  notesContent: string,
  cardType: 'term-definition' | 'question-answer' = 'term-definition'
): Promise<string> => {
  const supabaseEdgeUrl = `${SUPABASE_BASE_URL}/genrateFlashCardFromNotes`;
  
  try {
    const response = await axios.post(
      supabaseEdgeUrl,
      { 
        notesContent,
        cardType 
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_BEARER_TOKEN}`,
        },
      }
    );

    if (!response.data?.flashcards) {
      throw new Error('No valid response received from Edge Function');
    }

    return response.data.flashcards;
  } catch (error) {
    console.error('Error generating flashcards from notes:', error);
    throw new Error('Failed to generate flashcards. Please try again later.');
  }
};

export const generateEnhancedNotes = async (
  notesContent: string
): Promise<string> => {
  const supabaseEdgeUrl = `${SUPABASE_BASE_URL}/enhancenotes`;
  
  try {
    const response = await axios.post(
      supabaseEdgeUrl,
      { notesContent },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_BEARER_TOKEN}`,
        },
      }
    );

    if (!response.data?.enhancedNotes) {
      throw new Error('No valid response received from Edge Function');
    }

    return response.data.enhancedNotes;
  } catch (error) {
    console.error('Error enhancing notes:', error);
    console.log(' Error enhancing notes:', error);
    throw new Error('Failed to enhance notes. Please try again later.');
  }
};





export const generateMindMapFromNotes = async (
  notesContent: string,
  mode: 'topic' | 'notes' = 'topic'
): Promise<{ root: string; nodes: any[] }> => {
  if (!notesContent) {
    throw new Error('Notes content is required');
  }

  const supabaseEdgeUrl = `${SUPABASE_BASE_URL}/generateMindMapFromNotes`;

  function parseTextToMindMap(text: string): { root: string; nodes: any[] } {
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    const root = lines[0] || 'Mind Map';
    const nodes = lines.slice(1).map(line => {
      const match = line.match(/^[-*•\d+\.\)]\s*(.+)$/);
      return { label: match ? match[1] : line };
    });

    return { root, nodes };
  }

  try {
    const response = await axios.post(
      supabaseEdgeUrl,
      { notesContent, mode },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_BEARER_TOKEN}`,
        },
        timeout: 15000,
      }
    );

    let mindmapRaw = response.data?.mindmap;
    if (!mindmapRaw) {
      throw new Error('No mind map received from Edge Function');
    }

    // Clean markdown or code blocks if present
    if (typeof mindmapRaw === 'string') {
      mindmapRaw = mindmapRaw.trim().replace(/^```[a-zA-Z]*\n?|```$/g, '');
      const firstBrace = mindmapRaw.indexOf('{');
      const lastBrace = mindmapRaw.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        mindmapRaw = mindmapRaw.substring(firstBrace, lastBrace + 1);
      }
    }

    try {
      const parsed = typeof mindmapRaw === 'string' ? JSON.parse(mindmapRaw) : mindmapRaw;

      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.root === 'string' &&
        Array.isArray(parsed.nodes)
      ) {
        return parsed;
      }

      // Fallback: If it's an object but not structured
      if (parsed && typeof parsed === 'object') {
        return {
          root: notesContent.slice(0, 30) || 'Mind Map',
          nodes: Object.keys(parsed).map(k => ({ label: k })),
        };
      }

      throw new Error('Invalid mind map structure');
    } catch (err) {
      console.warn('Parsing as plain text or outline fallback');
      return parseTextToMindMap(typeof mindmapRaw === 'string' ? mindmapRaw : String(mindmapRaw));
    }
  } catch (err: any) {
    console.error('Mind map generation failed:', err?.message || err);
    throw new Error('Failed to generate mind map. Please try again later.');
  }
};




