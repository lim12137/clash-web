// Memory share strategy constants
export const MEMORY_SHARE_STRATEGY = {
  ALWAYS: "always",
  ASK: "ask", 
  NEVER: "never",
} as const;

// Type for memory share strategy
export type MemoryShareStrategy = (typeof MEMORY_SHARE_STRATEGY)[keyof typeof MEMORY_SHARE_STRATEGY];

// Share strategy dropdown labels
export const MEMORY_SHARE_LABELS: Record<MemoryShareStrategy, string> = {
  [MEMORY_SHARE_STRATEGY.ALWAYS]: "总是共享",
  [MEMORY_SHARE_STRATEGY.ASK]: "每次询问我",
  [MEMORY_SHARE_STRATEGY.NEVER]: "永不共享",
};
