import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List Featured Books
export const listFeatured = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("books")
      .take(12); // Initially just taking first 12
  },
});

// Search Books
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    if (!args.query) return [];
    
    // Simulating full-text search across title, author, and category 
    // Optimization: Use Convex Vector Search or specific text indexes later
    const allBooks = await ctx.db.query("books").collect();
    
    const term = args.query.toLowerCase();
    return allBooks.filter(book => 
      book.title.toLowerCase().includes(term) ||
      book.author.toLowerCase().includes(term) ||
      book.category.toLowerCase().includes(term)
    );
  },
});

// Insert Initial Book (Seed)
export const seedInitialBooks = mutation({
  args: {
    title: v.string(),
    author: v.string(),
    category: v.string(),
    description: v.string(),
    year: v.number(),
    pages: v.number(),
    popularity: v.number(),
    isAI: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("books", {
      ...args,
      coverGradient: `bg-gradient-to-br from-blue-900 to-black`, // Sample
    });
  },
});
