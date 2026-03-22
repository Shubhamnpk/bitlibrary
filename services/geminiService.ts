import { GoogleGenAI, Type } from "@google/genai";
import { Book } from "../types";

// Helper to check for API key
const getApiKey = (): string => {
  const key = process.env.API_KEY;
  if (!key) {
    console.error("API_KEY not found in environment variables.");
    return "";
  }
  return key;
};

// Initialize Gemini
const initGemini = () => {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const searchBooksWithGemini = async (query: string): Promise<Book[]> => {
  const ai = initGemini();
  if (!ai) return [];

  try {
    const model = "gemini-3-flash-preview"; // Optimized for speed/quality balance
    const prompt = `
      Generate a list of 6 distinct, real or highly plausible academic/literary books based on the search query: "${query}".
      If the query is vague, infer the best relevant topics.
      For each book, provide a title, author, category (e.g., Physics, History, Sci-Fi, Philosophy), a short description (max 20 words), a year of publication, and estimated page count.
      Return a JSON array.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              author: { type: Type.STRING },
              category: { type: Type.STRING },
              description: { type: Type.STRING },
              year: { type: Type.INTEGER },
              pages: { type: Type.INTEGER },
            },
            required: ["title", "author", "category", "description", "year", "pages"],
          },
        },
      },
    });

    const data = JSON.parse(response.text || "[]");
    
    // Map to our Book type with some generated UI fields
    return data.map((item: any, index: number) => ({
      id: `gemini-${Date.now()}-${index}`,
      title: item.title,
      author: item.author,
      category: item.category,
      description: item.description,
      year: item.year,
      pages: item.pages,
      popularity: Math.floor(Math.random() * 40) + 60,
      coverGradient: `bg-gradient-to-br from-${['red','blue','green','purple','orange','pink'][index%6]}-900 to-black`, 
    }));

  } catch (error) {
    console.error("Gemini Search Error:", error);
    return [];
  }
};

export const streamBookChapter = async (book: Book, chapterNumber: number): Promise<string> => {
  const ai = initGemini();
  if (!ai) return "Error connecting to AI service.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Write the full content for Chapter ${chapterNumber} of the book "${book.title}" by ${book.author}.
        The content should be approximately 600-800 words.
        Style: Academic, immersive, and high-quality suitable for a digital library.
        Format: Use Markdown for headers, paragraphs, and emphasis.
        Do not include preamble, just the chapter text.
      `,
    });
    return response.text || "Content generation failed.";
  } catch (error) {
    console.error("Gemini Stream Error:", error);
    return "Error streaming content. Please try again later.";
  }
};
