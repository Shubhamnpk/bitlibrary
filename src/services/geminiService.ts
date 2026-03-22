import axios from 'axios';
import { Book } from "@/types/index";

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = "moonshotai/kimi-k2.5";

const getApiKey = (): string => {
  return (import.meta as any).env?.VITE_NVIDIA_API_KEY || "";
};

export const searchBooksWithGemini = async (query: string): Promise<Book[]> => {
  const apiKey = getApiKey();
  if (!apiKey || apiKey.includes("PLACEHOLDER")) {
     return [
       { id: 'sim-1', title: 'NVIDIA Neural Stream', author: 'Kimi V2', category: 'Tech', description: 'A simulation of heavy duty AI retrieval.', year: 2026, pages: 300, popularity: 99, coverGradient: 'from-green-900 to-black' }
     ];
  }

  try {
    const response = await axios.post(NVIDIA_URL, {
      model: MODEL,
      messages: [{ 
        role: "user", 
        content: `Search Results: Return ONLY a JSON array of 6 academic/literary books related to "${query}". Fields: title, author, category, description, year, pages. Use professional formatting.` 
      }],
      temperature: 1.0,
      max_tokens: 4096,
      stream: false
    }, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    const text = response.data.choices[0].message.content;
    const jsonStr = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
    const data = JSON.parse(jsonStr);

    return data.map((item: any, i: number) => ({
      ...item,
      id: `nv-${Date.now()}-${i}`,
      popularity: 80 + i,
      coverGradient: `from-emerald-${900 - (i * 100)} to-black`
    }));
  } catch (err) {
    console.error("NVIDIA Search Failed:", err);
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
    const response = await axios.post(NVIDIA_URL, {
      model: MODEL,
      messages: [{ 
        role: "user", 
        content: `Briefly analyze the topic "${query}" within the context of global knowledge archives. Markdown formatting. 2 sentences max.` 
      }],
      temperature: 0.7,
      max_tokens: 512,
      stream: false
    }, {
      headers: { 
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });
    
    return response.data.choices[0].message.content;
  } catch (err) {
    console.error("Neural Insight Failed:", err);
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
    const response = await axios.post(NVIDIA_URL, {
      model: MODEL,
      messages: [{ 
        role: "user", 
        content: `Generate a 4-5 sentence professional, high-fidelity archival summary for the book "${book.title}" by ${book.author}. Focus on context, key themes, and its historical significance. Return ONLY the text.` 
      }],
      temperature: 0.8,
      max_tokens: 1024,
      stream: false
    }, {
      headers: { 
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });
    
    return response.data.choices[0].message.content;
  } catch (err) {
    console.error("Neural Summary Extraction Failed:", err);
    return book.description || "Archival node integrity compromised.";
  }
};

/**
 * Streams the book chapter content from NVIDIA Kimi.
 * For true streaming UI, this returns a function that takes a callback.
 */
export const streamBookChapter = async (book: Book, chapter: number, onChunk?: (chunk: string) => void): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey || apiKey.includes("PLACEHOLDER")) {
     return `## NVIDIA Neural Hub ERROR\n\nAPI KEY MISSING. Please check \`.env.local\` to enable Kimi-accelerated streaming for "${book.title}".`;
  }

  try {
    const response = await fetch(NVIDIA_URL, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      },
      body: JSON.stringify({
        model: MODEL,
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
    console.error("NVIDIA Stream Failed:", err);
    return "Neural uplink severed while communicating with Kimi nodes.";
  }
};
