export const VERSION = "1.0.0";
export const ROOT = new URL("../..", import.meta.url).pathname;
export const KO_PATH = `${ROOT}ko/translation.json`;
export const UNTRANSLATED_MARKER = "🦘";
export const PRIVATE_FILES = ["manager/", "package.json", "AGENTS.md"];

export type TranslationData = Record<string, Record<string, string>>;

export interface Command {
	name: string;
	description: string;
	execute(): Promise<void>;
}
