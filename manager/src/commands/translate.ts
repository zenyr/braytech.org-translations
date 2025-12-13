import type { Command, TranslationData } from "../types";
import { KO_PATH, ROOT, UNTRANSLATED_MARKER, convertPuaMarkers, puaToMarkers } from "../types";

const EN_PATH = `${ROOT}en/translation.json`;

// PUA character range: U+E000–U+F8FF
const PUA_REGEX = /[\uE000-\uF8FF]/g;
// Placeholder pattern: {{...}}
const PLACEHOLDER_REGEX = /\{\{([^}]+)\}\}/g;

export class TranslateCommand implements Command {
  name = "translate";
  description = "번역 적용 (key translation [--dry-run] [--force])";

  async execute(): Promise<void> {
    const args = Bun.argv.slice(3);

    // Parse flags
    const dryRun = args.includes("--dry-run");
    const force = args.includes("--force");

    // Remove flags from args
    const positionalArgs = args.filter((a) => !a.startsWith("--"));

    if (positionalArgs.length < 2) {
      this.printHelp();
      return;
    }

    const [key, rawTranslation] = positionalArgs;
    
    // Convert [PUA-XXXX] markers to actual PUA characters
    const translation = convertPuaMarkers(rawTranslation);

    await this.translate(key, translation, { dryRun, force });
  }

  private async translate(
    key: string,
    translation: string,
    opts: { dryRun: boolean; force: boolean }
  ): Promise<void> {
    // Load both files
    const enFile = Bun.file(EN_PATH);
    const koFile = Bun.file(KO_PATH);

    if (!(await enFile.exists())) {
      console.error(`오류: en/translation.json을 찾을 수 없습니다.`);
      process.exit(1);
    }
    if (!(await koFile.exists())) {
      console.error(`오류: ko/translation.json을 찾을 수 없습니다.`);
      process.exit(1);
    }

    const enData: TranslationData = await enFile.json();
    const koText = await koFile.text();
    const koData: TranslationData = JSON.parse(koText);

    // Get values at key path
    const enValue = this.getByPath(enData, key);
    const koValue = this.getByPath(koData, key);

    // Validate key exists in both
    if (enValue === undefined) {
      console.error(`오류: 키 "${key}"가 en/translation.json에 없습니다.`);
      process.exit(1);
    }
    if (typeof enValue !== "string") {
      console.error(`오류: 키 "${key}"가 문자열이 아닙니다 (객체일 수 있음).`);
      process.exit(1);
    }
    if (koValue === undefined) {
      console.error(`오류: 키 "${key}"가 ko/translation.json에 없습니다.`);
      process.exit(1);
    }
    if (typeof koValue !== "string") {
      console.error(`오류: 키 "${key}"가 문자열이 아닙니다 (객체일 수 있음).`);
      process.exit(1);
    }

    // Check if already translated (no 🦘 prefix)
    const isUntranslated = koValue.startsWith(UNTRANSLATED_MARKER);
    if (!isUntranslated && !opts.force) {
      console.error(`오류: "${key}"는 이미 번역되어 있습니다.`);
      console.error(`영문 원문: "${puaToMarkers(enValue)}"`);
      console.error(`현재 번역: "${puaToMarkers(koValue)}"`);
      console.error(`덮어쓰려면 --force 플래그를 사용하세요.`);
      process.exit(1);
    }

    // Extract from English source
    const sourcePua = this.extractPuaChars(enValue);
    const sourcePlaceholders = this.extractPlaceholders(enValue);

    // Validate placeholders
    const translationPlaceholders = this.extractPlaceholders(translation);
    const missingPlaceholders = sourcePlaceholders.filter(
      (p) => !translationPlaceholders.includes(p)
    );

    if (missingPlaceholders.length > 0) {
      console.error(`오류: 번역에 누락된 플레이스홀더가 있습니다:`);
      for (const p of missingPlaceholders) {
        console.error(`  - {{${p}}}`);
      }
      console.error(`\n영문 원문: "${puaToMarkers(enValue)}"`);
      process.exit(1);
    }

    // Apply PUA characters from source
    const { result: finalTranslation, warnings } = this.applyPuaChars(
      translation,
      sourcePua
    );

    // Reject translation if PUA characters are missing
    if (warnings.length > 0) {
      console.error(`\n오류: 번역에 PUA 문자가 누락되었습니다.`);
      for (const warning of warnings) {
        console.error(`  ${warning}`);
      }
      console.error(`\n영문 원문: "${puaToMarkers(enValue)}"`);
      console.error(`제출한 번역: "${puaToMarkers(translation)}"`);
      console.error(`\nPUA 문자를 [PUA-XXXX] 형태로 번역에 포함해주세요.`);
      console.error(`예시: **[PUA-E038]{{placeholder}}**`);
      process.exit(1);
    }

    if (opts.dryRun) {
      console.log(`\n[DRY RUN] ${key}`);
      console.log(`  → "${puaToMarkers(finalTranslation)}"`);
      return;
    }

    // Update ko/translation.json using text replacement for JSON stability
    const updatedText = this.updateJsonValue(koText, key, koValue, finalTranslation);

    await Bun.write(KO_PATH, updatedText);
    console.log(`✓ ${key}`);
  }

  private extractPuaChars(text: string): string[] {
    return text.match(PUA_REGEX) ?? [];
  }

  private extractPlaceholders(text: string): string[] {
    const placeholders: string[] = [];
    const regex = new RegExp(PLACEHOLDER_REGEX.source, "g");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      placeholders.push(match[1]);
    }
    return placeholders;
  }

  /**
   * Validate and apply PUA characters from source to translation.
   * Returns { result, warnings } where warnings indicate any issues.
   */
  private applyPuaChars(
    translation: string,
    sourcePua: string[]
  ): { result: string; warnings: string[] } {
    const warnings: string[] = [];

    if (sourcePua.length === 0) {
      return { result: translation, warnings };
    }

    const translationPua = this.extractPuaChars(translation);

    // Case 1: Translation already has all PUA chars - trust user input
    if (translationPua.length >= sourcePua.length) {
      return { result: translation, warnings };
    }

    // Case 2: Translation has some PUA but not all
    if (translationPua.length > 0 && translationPua.length < sourcePua.length) {
      warnings.push(
        `번역에 PUA 문자가 ${translationPua.length}개 있지만 원문에는 ${sourcePua.length}개 있습니다.`
      );
      return { result: translation, warnings };
    }

    // Case 3: Translation has no PUA - try to auto-insert
    // Strategy: Replace **** patterns with source's ** + PUA + ** patterns
    let result = translation;
    let puaIndex = 0;

    // First, try replacing **** (empty bold) with PUA
    result = result.replace(/\*\*\*\*/g, () => {
      if (puaIndex < sourcePua.length) {
        return `**${sourcePua[puaIndex++]}**`;
      }
      return "****";
    });

    // Check if we've placed all PUA chars
    const resultPua = this.extractPuaChars(result);
    if (resultPua.length < sourcePua.length) {
      const remaining = sourcePua.slice(resultPua.length);
      warnings.push(
        `원문의 PUA 문자를 자동 삽입할 수 없습니다: ${remaining.map((c) => `U+${c.charCodeAt(0).toString(16).toUpperCase()}`).join(", ")}`
      );
      warnings.push(`원문에서 PUA 문자 위치를 확인하고 번역에 직접 포함해주세요.`);
    }

    return { result, warnings };
  }

  /**
   * Update a specific key's value in JSON text while preserving formatting.
   * Uses string manipulation to avoid reordering keys.
   */
  private updateJsonValue(
    jsonText: string,
    keyPath: string,
    oldValue: string,
    newValue: string
  ): string {
    // Build the expected JSON string representation of the old value
    const oldJsonValue = JSON.stringify(oldValue);
    const newJsonValue = JSON.stringify(newValue);

    // Find the key in the JSON
    const keys = keyPath.split(".");
    const lastKey = keys[keys.length - 1];

    // Create a pattern to find the exact key-value pair
    // We need to find: "lastKey": "oldValue"
    // But we need context to ensure we're at the right nesting level

    // Strategy: Find all occurrences of the key-value pair and verify context
    const keyPattern = `"${lastKey}": ${oldJsonValue}`;
    const keyPatternAlt = `"${lastKey}":${oldJsonValue}`; // No space variant

    let index = jsonText.indexOf(keyPattern);
    let patternUsed = keyPattern;

    if (index === -1) {
      index = jsonText.indexOf(keyPatternAlt);
      patternUsed = keyPatternAlt;
    }

    if (index === -1) {
      // Try to find just by key and reconstruct
      console.error(`경고: 정확한 키-값 패턴을 찾을 수 없습니다. 구조적 업데이트를 시도합니다.`);
      return this.updateJsonStructurally(jsonText, keyPath, newValue);
    }

    // Verify we found the right key by checking the path context
    // Count nesting level by looking at text before the match
    const textBefore = jsonText.substring(0, index);

    // Verify the path matches by checking parent keys
    if (keys.length > 1 && !this.verifyKeyPath(textBefore, keys.slice(0, -1))) {
      // Multiple matches possible, fall back to structural update
      return this.updateJsonStructurally(jsonText, keyPath, newValue);
    }

    // Replace the value
    const newKeyPattern = `"${lastKey}": ${newJsonValue}`;
    return (
      jsonText.substring(0, index) +
      newKeyPattern +
      jsonText.substring(index + patternUsed.length)
    );
  }

  /**
   * Verify that the parent keys appear in order before the current position
   */
  private verifyKeyPath(textBefore: string, parentKeys: string[]): boolean {
    let searchPos = 0;
    for (const key of parentKeys) {
      const keyPattern = `"${key}"`;
      const found = textBefore.indexOf(keyPattern, searchPos);
      if (found === -1) return false;
      searchPos = found + keyPattern.length;
    }
    return true;
  }

  /**
   * Fallback: Update JSON structurally while trying to preserve order
   */
  private updateJsonStructurally(
    jsonText: string,
    keyPath: string,
    newValue: string
  ): string {
    const data: TranslationData = JSON.parse(jsonText);
    this.setByPath(data, keyPath, newValue);

    // Re-serialize with same formatting (2-space indent)
    // Preserve trailing newline if original had one
    const hasTrailingNewline = jsonText.endsWith("\n");
    const result = JSON.stringify(data, null, 2);
    return hasTrailingNewline ? result + "\n" : result;
  }

  private getByPath(data: TranslationData, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = data;

    for (const key of keys) {
      if (current === null || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  private setByPath(data: TranslationData, path: string, value: string): void {
    const keys = path.split(".");
    let current: Record<string, unknown> = data;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (typeof current[key] !== "object" || current[key] === null) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
  }

  private printHelp(): void {
    console.log(`
사용법: bun run manager translate <key> <translation> [옵션]

인수:
  key          점 표기 경로 (예: GettingStarted.Tips.Views.Description)
  translation  한국어 번역 텍스트

옵션:
  --dry-run    변경사항 미리보기 (저장 안 함)
  --force      이미 번역된 항목 덮어쓰기 (🦘 없는 항목)

기능:
  - 영문 원본에서 PUA 문자 (아이콘) 자동 보존
  - 마크다운 (**...**. _..._) 구조 유지
  - 플레이스홀더 ({{...}}) 검증
  - 🦘 접두사 자동 제거

예시:
  bun run manager translate Action.Browse "탐색"
  bun run manager translate GettingStarted.Tips.Views.Description "앱 상단의 ****를 선택하세요!" --dry-run
  bun run manager translate Common.Text "새번역" --force
`);
  }
}
