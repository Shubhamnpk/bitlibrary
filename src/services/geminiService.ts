import axios from 'axios';
import { Book } from "@/types/index";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "minimax/minimax-m2.5:free";
let hasLoggedOpenRouter404 = false;

const getApiKey = (): string => {
  return (import.meta as any).env?.VITE_OPENROUTER_API_KEY || "";
};

const getModel = (): string => {
  return (import.meta as any).env?.VITE_OPENROUTER_MODEL || DEFAULT_MODEL;
};

const parseOpenRouterError = (err: unknown): { status?: number; message: string } => {
  if (axios.isAxiosError(err)) {
    return {
      status: err.response?.status,
      message: err.response?.data?.error?.message || err.message,
    };
  }
  return { message: String(err) };
};
const toText = (value: unknown, fallback: string): string => {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
};
const toOptionalNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getOpenRouterHeaders = (apiKey: string) => {
  const env = (import.meta as any).env || {};
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": env.VITE_OPENROUTER_SITE_URL || "http://localhost:5173",
    "X-Title": env.VITE_OPENROUTER_APP_NAME || "BitLibrary",
  };
};

export const searchBooksWithGemini = async (query: string): Promise<Book[]> => {
  const apiKey = getApiKey();
  if (!apiKey || apiKey.includes("PLACEHOLDER")) {
     return [];
  }

  try {
    const response = await axios.post(OPENROUTER_URL, {
      model: getModel(),
      messages: [{ 
        role: "user", 
        content: `Search Results: Return ONLY a JSON array of 6 academic/literary books related to "${query}". Fields: title, author, category, description, year, pages. Use professional formatting.` 
      }],
      temperature: 0.7,
      max_tokens: 2048,
      stream: false
    }, {
      headers: getOpenRouterHeaders(apiKey)
    });

    const text = response.data.choices[0].message.content;
    const jsonStr = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
    const data = JSON.parse(jsonStr);

    return data.map((item: any, i: number) => ({
      ...item,
      id: `nv-${Date.now()}-${i}`,
      title: toText(item?.title, `Neural Volume ${i + 1}`),
      author: toText(item?.author, "Unknown Author"),
      category: toText(item?.category, "General"),
      description: toText(item?.description, "No neural description available."),
      year: toOptionalNumber(item?.year),
      pages: toOptionalNumber(item?.pages),
      popularity: 80 + i,
      coverGradient: `from-emerald-${900 - (i * 100)} to-black`
    }));
  } catch (err) {
    const parsed = parseOpenRouterError(err);
    if (parsed.status === 404) {
      if (!hasLoggedOpenRouter404) {
        console.warn("OpenRouter search disabled: endpoint/model returned 404. Check VITE_OPENROUTER_MODEL and API key.");
        hasLoggedOpenRouter404 = true;
      }
      return [];
    }
    console.error("OpenRouter search failed:", parsed.message);
    return [];
  }
};

/**
 * Generates a brief AI analysis of the search query.
 */
export const generateSearchInsights = async (query: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey || apiKey.includes("PLACEHOLDER")) return "";
  
  try {
    const response = await axios.post(OPENROUTER_URL, {
      model: getModel(),
      messages: [{ 
        role: "user", 
        content: `Briefly analyze the topic "${query}" within the context of global knowledge archives. Markdown formatting. 2 sentences max.` 
      }],
      temperature: 0.7,
      max_tokens: 512,
      stream: false
    }, {
      headers: getOpenRouterHeaders(apiKey)
    });
    
    return response.data.choices[0].message.content;
  } catch (err) {
    const parsed = parseOpenRouterError(err);
    if (parsed.status === 404) {
      if (!hasLoggedOpenRouter404) {
        console.warn("OpenRouter insights disabled: endpoint/model returned 404. Check VITE_OPENROUTER_MODEL and API key.");
        hasLoggedOpenRouter404 = true;
      }
      return "";
    }
    console.error("OpenRouter insight failed:", parsed.message);
    return "";
  }
};

/**
 * Generates a brief high-fidelity summary for a book.
 */
export const generateNeuralSummary = async (book: Book): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey || apiKey.includes("PLACEHOLDER")) return "Classical volume found in neural archives.";
  
  try {
    const response = await axios.post(OPENROUTER_URL, {
      model: getModel(),
      messages: [{ 
        role: "user", 
        content: `Generate a 4-5 sentence professional, high-fidelity archival summary for the book "${book.title}" by ${book.author}. Focus on context, key themes, and its historical significance. Return ONLY the text.` 
      }],
      temperature: 0.8,
      max_tokens: 1024,
      stream: false
    }, {
      headers: getOpenRouterHeaders(apiKey)
    });
    
    return response.data.choices[0].message.content;
  } catch (err) {
    console.error("OpenRouter summary extraction failed:", err);
    return book.description || "Archival node integrity compromised.";
  }
};

/**
 * Streams the book chapter content from OpenRouter.
 * For true streaming UI, this returns a function that takes a callback.
 */
export const streamBookChapter = async (book: Book, chapter: number, onChunk?: (chunk: string) => void): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey || apiKey.includes("PLACEHOLDER")) {
     return `## OpenRouter ERROR\n\nAPI key missing. Please check \`.env.local\` to enable AI streaming for "${book.title}".`;
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        ...getOpenRouterHeaders(apiKey),
        "Accept": "text/event-stream"
      },
      body: JSON.stringify({
        model: getModel(),
        messages: [{ 
          role: "user", 
          content: `Write a high-quality, academic Chapter ${chapter} for "${book.title}" by ${book.author}. Complete content, minimum 1000 words. Markdown formatting.` 
        }],
        temperature: 1.0,
        max_tokens: 16384,
        stream: true,
        chat_template_kwargs: { thinking: true }
      })
    });

    if (!response.body) throw new Error("No response body");
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.substring(6));
            const delta = data.choices[0].delta?.content || "";
            if (delta) {
              fullText += delta;
              if (onChunk) onChunk(delta);
            }
          } catch (e) {
            // Might be incomplete JSON line
          }
        }
      }
    }

    return fullText;
  } catch (err) {
    console.error("OpenRouter stream failed:", err);
    return "Neural uplink severed while communicating with OpenRouter.";
  }
};
