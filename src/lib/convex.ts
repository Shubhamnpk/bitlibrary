import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.VITE_CONVEX_URL || "https://sample-convex-url.convex.cloud";

export const convex = new ConvexReactClient(convexUrl);
