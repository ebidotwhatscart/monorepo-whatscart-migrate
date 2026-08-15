import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts a clean, user-friendly error message from Convex/errors
 * Removes technical noise like Request IDs, function names, etc.
 */
export function getErrorMessage(error: unknown): string {
  // If error is already a string, return it as-is if it looks clean
  if (typeof error === "string") {
    // If it looks like a raw Convex error, try to extract the message
    if (error.includes("[CONVEX")) {
      const lines = error.split("\n");
      for (const line of lines) {
        // Skip the Convex header line
        if (line.includes("[CONVEX") || line.includes("Request ID")) {
          continue;
        }
        // Look for lines with actual error content
        if (line.trim() && !line.includes("[")) {
          return line.trim();
        }
      }
    }
    // For shorter strings or already clean messages
    if (error.length < 100) {
      return error;
    }
  }

  // If error is an Error object
  if (error instanceof Error) {
    const message = error.message;

    // Handle Convex errors
    if (message.includes("[CONVEX")) {
      const lines = message.split("\n");
      for (const line of lines) {
        // Skip Convex technical lines
        if (line.includes("[CONVEX") || line.includes("Request ID")) {
          continue;
        }
        // Extract the actual error message (usually after the colon)
        if (line.trim()) {
          const match = line.match(/^(\w+Error:\s*)?(.+)$/);
          if (match && match[2]) {
            return match[2].trim();
          }
        }
      }
      // Fallback: return first non-empty line
      const cleanLine = lines.find(
        (l) => l.trim() && !l.includes("[CONVEX") && !l.includes("Request ID")
      );
      if (cleanLine) {
        return cleanLine.trim();
      }
    }

    // Return the message as-is for other errors
    return message;
  }

  // Fallback for unknown error types
  return "Something went wrong. Please try again.";
}
