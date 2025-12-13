export const VERSION = "1.0.0";
export const ROOT = new URL("../..", import.meta.url).pathname;
export const KO_PATH = `${ROOT}ko/translation.json`;
export const GLOSSARY_PATH = `${ROOT}manager/data/glossary.json`;
export const UNTRANSLATED_MARKER = "🦘";
export const PRIVATE_FILES = ["manager/", "package.json", "AGENTS.md"];

// PUA character range: U+E000–U+F8FF
const PUA_REGEX = /[\uE000-\uF8FF]/g;
// User-friendly PUA marker pattern: [PUA-E038]
const PUA_MARKER_REGEX = /\[PUA-([0-9A-Fa-f]{4})\]/g;

/**
 * Convert [PUA-XXXX] markers to actual PUA characters
 */
export function convertPuaMarkers(text: string): string {
  return text.replace(PUA_MARKER_REGEX, (match, hexCode) => {
    const codePoint = Number.parseInt(hexCode, 16);
    if (codePoint >= 0xe000 && codePoint <= 0xf8ff) {
      return String.fromCharCode(codePoint);
    }
    return match; // Invalid range, keep as-is
  });
}

/**
 * Convert PUA characters to [PUA-XXXX] markers for display
 */
export function puaToMarkers(text: string): string {
  return text.replace(PUA_REGEX, (char) => {
    const code = char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0");
    return `[PUA-${code}]`;
  });
}

export type GlossaryData = Record<string, Record<string, string>>;

export type TranslationData = Record<string, Record<string, string>>;

export interface Command {
  name: string;
  description: string;
  execute(): Promise<void>;
}
