import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  books: defineTable({
    title: v.string(),
    author: v.string(),
    category: v.string(),
    description: v.string(),
    year: v.number(),
    pages: v.number(),
    popularity: v.number(),
    coverGradient: v.optional(v.string()),
    coverUrl: v.optional(v.string()),
    pdfUrl: v.optional(v.string()),
    externalUrl: v.optional(v.string()), // For Gutendex/API links
    isAI: v.boolean(),
    storageId: v.optional(v.string()),    // For Cloudflare R2 reference (via storageId in Convex)
  }).index("by_category", ["category"]),

  users: defineTable({
    clerkId: v.string(),
    displayName: v.string(),
    email: v.string(),
    role: v.string(), // "admin" or "user"
  }).index("by_clerk_id", ["clerkId"]),

  borrows: defineTable({
    userId: v.id("users"),
    bookId: v.id("books"),
    borrowedAt: v.number(),
    expiresAt: v.optional(v.number()),
  }).index("by_user", ["userId"])
    .index("by_book", ["bookId"]),
});
