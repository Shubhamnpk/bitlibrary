import axios from 'axios';
import { Book } from "@/types/index";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "minimax/minimax-m2.5:free";
let hasLoggedOpenRouter404 = false;

const getApiKey = (): string => {
  return (import.meta as any).env?.VITE_OPENROUTER_API_KEY || "";
};
const hasUsableApiKey = (): boolean => {
  const apiKey = getApiKey();
  return !!apiKey && !apiKey.includes("PLACEHOLDER");
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
const buildLocalChapterExtract = (book: Book, chapter: number): string => {
  const title = toText(book.title, "Untitled Volume");
  const author = toText(book.author, "Unknown Author");
  const category = toText(book.category, "General");
  const description = toText(book.description, "No description is available for this title.");
  const subjects = (book.subjects || []).slice(0, 5);
  const subjectLine = subjects.length > 0 ? subjects.join(", ") : "Core themes unavailable";
  const year = book.year ?? "Unknown";
  const pages = book.pages ?? "Unknown";

  return `# Chapter ${chapter}: ${title}

_Source: Local chapter extractor (offline-safe fallback)_

## Overview
**Title:** ${title}  
**Author:** ${author}  
**Category:** ${category}  
**Publication Year:** ${year}  
**Pages:** ${pages}

## Core Context
${description}

## Themes To Focus On
- ${subjectLine}
- Historical and literary context inferred from catalog metadata
- Reader-guided interpretation and note-taking

## Guided Reading Notes
This extracted chapter mode keeps reading functional even when AI streaming is unavailable.  
Use this section as a structured briefing before opening the full source text.

## Suggested Next Steps
1. Open the source volume for full text.
2. Compare this summary against the original chapter.
3. Save the book if the topic matches your research or study goals.
`;
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
  if (!hasUsableApiKey()) {
    const fallback = buildLocalChapterExtract(book, chapter);
    if (onChunk) onChunk(fallback);
    return fallback;
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

    if (!fullText.trim()) {
      const fallback = buildLocalChapterExtract(book, chapter);
      if (onChunk) onChunk(fallback);
      return fallback;
    }
    return fullText;
  } catch (err) {
    console.error("OpenRouter stream failed:", err);
    const fallback = buildLocalChapterExtract(book, chapter);
    if (onChunk) onChunk(fallback);
    return fallback;
  }
};
