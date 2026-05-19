export type Theme = "system" | "light" | "dark";
export type ThemeColor = "default" | "red" | "rose" | "orange" | "green" | "blue" | "yellow" | "violet";
export type ErrorReason =
  | "CONFIG_INVALID"
  | "CONFIG_ERROR"
  | "API_ERROR"
  | "TOO_MANY_REQUESTS"
  | "TIMEOUT"
  | "PROMPT_FLAGGED"
  | "INPUT_IMAGE_FLAGGED"
  | "UNKNOWN";
