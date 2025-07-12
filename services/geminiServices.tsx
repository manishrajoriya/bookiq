import axios from "axios";
import * as FileSystem from "expo-file-system";


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

    const requestBody = {
      requests: [
        {
          image: { content: base64Image },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        },
      ],
    };

    console.log("GEMINI_SERVICE: Sending request to Google Cloud Vision API...");
    
    const response = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.EXPO_PUBLIC_GOOGLE_CLOUD_VISION_API_KEY}`,
      requestBody,
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("GEMINI_SERVICE: Received response from Google Cloud Vision API");

    if (!response.data.responses?.[0]?.fullTextAnnotation?.text) {
      console.warn("GEMINI_SERVICE: No text detected in the image response");
      throw new Error("No text detected in the image");
    }

    const extractedText = response.data.responses[0].fullTextAnnotation.text;
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

export const getAnswerFromGemini = async (
  extractedText: string,
  feature: string
): Promise<string> => {
  // Choose prompt template
  const promptTemplate = PROMPT_TEMPLATES[feature] || PROMPT_TEMPLATES["default"];
  const prompt = promptTemplate(extractedText);

  // Send to Gemini
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-preview-02-05:generateContent?key=${process.env.EXPO_PUBLIC_GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      { headers: { "Content-Type": "application/json" } }
    );

    if (!response.data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("No response received from Gemini");
    }

    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error getting Gemini response:", error);
    throw new Error("Failed to get AI response. Please try again later.");
  }
};

export const generateQuizFromNotes = async (
  notesContent: string,
  quizType: 'multiple-choice' | 'true-false' | 'fill-blank' = 'multiple-choice'
): Promise<string> => {
  const prompt = `You are an expert quiz generator. Create a comprehensive quiz based on the following content.

Content:
"${notesContent}"

Requirements:
- Generate many ${quizType} questions 
- Make questions challenging but fair
- Include a mix of difficulty levels
- For multiple choice: provide 4 options (A, B, C, D) with only one correct answer
- For true/false: provide clear statements that are definitely true or false
- For fill in the blank: provide sentences with key terms missing
- Format the output clearly with question numbers
- Include the correct answers at the end

Please format your response exactly as follows:
1. [Question 1]
   A) [Option A]
   B) [Option B]
   C) [Option C]
   D) [Option D]

2. [Question 2]
   A) [Option A]
   B) [Option B]
   C) [Option C]
   D) [Option D]

[Continue with more questions...]

ANSWERS:
1. [Correct answer letter] - [Brief explanation]
2. [Correct answer letter] - [Brief explanation]
[Continue with all answers...]`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-preview-02-05:generateContent?key=${process.env.EXPO_PUBLIC_GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      { headers: { "Content-Type": "application/json" } }
    );

    if (!response.data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("No response received from Gemini");
    }

    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error generating quiz from notes:", error);
    throw new Error("Failed to generate quiz. Please try again later.");
  }
};

export const generateFlashCardsFromNotes = async (
  notesContent: string,
  cardType: 'term-definition' | 'question-answer' = 'term-definition'
): Promise<string> => {
  const prompt = `You are an expert flashcard generator. Create a set of flashcards based on the following study notes content.

Study Notes Content:
"${notesContent}"

Requirements:
- The flashcard type is ${cardType}.
- For 'term-definition', provide a key term and its definition.
- For 'question-answer', provide a question and a concise answer.
- Format the output clearly, separating the front and back of each card.
- Ensure the content is accurate and directly related to the provided notes.

Please format your response as follows, using '---' to separate cards:
FRONT: [Term/Question 1]
BACK: [Definition/Answer 1]
---
FRONT: [Term/Question 2]
BACK: [Definition/Answer 2]
---
...`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-preview-02-05:generateContent?key=${process.env.EXPO_PUBLIC_GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      { headers: { "Content-Type": "application/json" } }
    );

    if (!response.data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("No response received from Gemini");
    }

    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error generating flashcards from notes:", error);
    throw new Error("Failed to generate flashcards. Please try again later.");
  }
};

export const generateEnhancedNotes = async (
  notesContent: string
): Promise<string> => {
  const supabaseEdgeUrl = `https://mnjhkeygyczkziowlrab.supabase.co/functions/v1/enhancenotes`;
  const supabaseBearerToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uamhrZXlneWN6a3ppb3dscmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4ODQ4NzcsImV4cCI6MjA2NzQ2MDg3N30.9unaHI1ZXmSLMDf1szwmsR6oGXpDrn7-MTH-YXH5hng';

  try {
    const response = await axios.post(
      supabaseEdgeUrl,
      { notesContent }, // <-- correct key
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseBearerToken}`,
        },
      }
    );

    if (!response.data?.enhancedNotes) {
      throw new Error('No valid response received from  Function');
    }

    return response.data.enhancedNotes;
  } catch (error) {
    console.error('Error enhancing notes:', error);
    throw new Error('Failed to enhance notes. Please try again later.');
  }
};


