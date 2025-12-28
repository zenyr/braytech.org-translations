import type { Command } from "../types";
import { convertPuaMarkers, puaToMarkers, ROOT } from "../types";

// Manifest path relative to translations root (via symlink)
const MANIFEST_ROOT = `${ROOT}../braytech.org-manifest/`;
const DEFAULT_LANG = "ko";

// PUA character range: U+E000–U+F8FF
const PUA_REGEX = /[\uE000-\uF8FF]/g;

// Generic manifest entry - can be any structure
type ManifestEntry = Record<string, unknown>;
type ManifestData = Record<string, ManifestEntry>;

// Known translatable field patterns per definition type
const FIELD_PATTERNS: Record<string, string[]> = {
  // Standard displayProperties
  default: [
    "displayProperties.name",
    "displayProperties.description",
    "displayProperties.itemTypeDisplayName",
  ],
  // DestinyHistoricalStatsDefinition - flat fields
  DestinyHistoricalStatsDefinition: [
    "statName",
    "statNameAbbr",
    "statDescription",
    "statNameAlt",
  ],
  // DestinyObjectiveDefinition - mixed
  DestinyObjectiveDefinition: [
    "displayProperties.description",
    "progressDescription",
  ],
  // DestinySourceDefinition - flat
  DestinySourceDefinition: ["sourceString"],
  // DestinyLoadoutNameDefinition - flat name/description
  DestinyLoadoutNameDefinition: ["name", "description"],
  // DestinyDamageTypeDefinition - flat itemTypeDisplayName
  DestinyDamageTypeDefinition: ["itemTypeDisplayName"],
  // DestinyDestinationDefinition - nested bubbles array
  DestinyDestinationDefinition: [
    "displayProperties.name",
    "displayProperties.description",
    "bubbles.*.displayProperties.name",
  ],
  // DestinyChecklistDefinition - mixed with entry
  DestinyChecklistDefinition: [
    "displayProperties.name",
    "displayProperties.description",
    "entry.prefix",
    "entry.name",
    "entry.completed",
    "progressDescription",
  ],
};

// Backward compatible shorthand mappings
const SHORTHAND_MAP: Record<string, string> = {
  name: "displayProperties.name",
  description: "displayProperties.description",
  itemTypeDisplayName: "displayProperties.itemTypeDisplayName",
};

const SUBCOMMANDS = ["ls", "get", "search", "set", "diff"] as const;
type Subcommand = (typeof SUBCOMMANDS)[number];

export class ManifestCommand implements Command {
  name = "manifest";
  description = "manifest 관리 (ls|get|search|set|diff)";

  async execute(): Promise<void> {
    const args = Bun.argv.slice(3);
    const subcommand = args[0] as Subcommand | undefined;

    if (!subcommand || !SUBCOMMANDS.includes(subcommand)) {
      this.printHelp();
      return;
    }

    const subArgs = args.slice(1);

    switch (subcommand) {
      case "ls":
        await this.ls();
        break;
      case "get":
        await this.get(subArgs);
        break;
      case "search":
        await this.search(subArgs);
        break;
      case "set":
        await this.set(subArgs);
        break;
      case "diff":
        await this.diff(subArgs);
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Path utilities
  // ─────────────────────────────────────────────────────────────

  /**
   * Get value at path from object (supports dot notation and array indices)
   * e.g., "displayProperties.name", "bubbles.0.displayProperties.name"
   */
  private getPath(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== "object") return undefined;

      // Handle array index
      if (/^\d+$/.test(part)) {
        current = (current as unknown[])[parseInt(part, 10)];
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }

    return current;
  }

  /**
   * Set value at path in object (supports dot notation and array indices)
   * Creates intermediate objects/arrays as needed
   */
  private setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split(".");
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const nextPart = parts[i + 1];
      const isNextArray = /^\d+$/.test(nextPart);

      if (current[part] === undefined) {
        current[part] = isNextArray ? [] : {};
      }

      current = current[part] as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
  }

  /**
   * Expand field shorthand (name → displayProperties.name)
   */
  private expandFieldPath(field: string): string {
    return SHORTHAND_MAP[field] ?? field;
  }

  /**
   * Get field patterns for a definition type
   */
  private getFieldPatterns(fileName: string): string[] {
    const baseName = fileName.replace(".json", "").replace(/-dynamic$/, "");
    return FIELD_PATTERNS[baseName] ?? FIELD_PATTERNS.default;
  }

  /**
   * Extract all translatable field paths from an entry
   * Handles wildcards like "bubbles.*.displayProperties.name"
   */
  private extractTranslatableFields(
    entry: ManifestEntry,
    patterns: string[]
  ): Array<{ path: string; value: string }> {
    const results: Array<{ path: string; value: string }> = [];

    for (const pattern of patterns) {
      if (pattern.includes(".*")) {
        // Wildcard pattern for arrays
        const [arrayPath, ...rest] = pattern.split(".*.");
        const arrayValue = this.getPath(entry, arrayPath);

        if (Array.isArray(arrayValue)) {
          arrayValue.forEach((item, index) => {
            const subPath = rest.join(".");
            const value = this.getPath(item, subPath);
            if (typeof value === "string" && value.trim()) {
              results.push({ path: `${arrayPath}.${index}.${subPath}`, value });
            }
          });
        }
      } else {
        const value = this.getPath(entry, pattern);
        if (typeof value === "string" && value.trim()) {
          results.push({ path: pattern, value });
        }
      }
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────
  // ls: 파일 목록
  // ─────────────────────────────────────────────────────────────
  private async ls(): Promise<void> {
    const glob = new Bun.Glob("*.json");
    const koPath = `${MANIFEST_ROOT}${DEFAULT_LANG}/`;

    const files: string[] = [];
    for await (const file of glob.scan({ cwd: koPath })) {
      files.push(file.replace(".json", ""));
    }

    files.sort();
    console.log(`\n=== manifest/${DEFAULT_LANG}/ (${files.length}개) ===\n`);
    for (const file of files) {
      console.log(`  ${file}`);
    }
    console.log();
  }

  // ─────────────────────────────────────────────────────────────
  // get: 항목 조회
  // ─────────────────────────────────────────────────────────────
  private async get(args: string[]): Promise<void> {
    if (args.length < 2) {
      console.log(`사용법: manifest get <file> <hashId>`);
      return;
    }

    const [filePath, hashId] = args;
    const { fullPath, enPath } = this.resolvePaths(filePath);
    const fileName = this.normalizeFileName(filePath);

    const targetFile = Bun.file(fullPath);
    const enFile = Bun.file(enPath);

    const targetData: ManifestData = (await targetFile.exists()) ? await targetFile.json() : {};
    const enData: ManifestData = (await enFile.exists()) ? await enFile.json() : {};

    const entry = targetData[hashId];
    const enEntry = enData[hashId];

    if (!entry && !enEntry) {
      console.error(`오류: hashId "${hashId}"를 en/ko 모두에서 찾을 수 없습니다.`);
      process.exit(1);
    }

    console.log(`\n=== ${hashId} ===\n`);

    const patterns = this.getFieldPatterns(fileName);

    // Collect all fields from both entries
    const allPaths = new Set<string>();

    if (enEntry) {
      for (const { path } of this.extractTranslatableFields(enEntry, patterns)) {
        allPaths.add(path);
      }
    }
    if (entry) {
      for (const { path } of this.extractTranslatableFields(entry, patterns)) {
        allPaths.add(path);
      }
    }

    // Display each field
    for (const path of Array.from(allPaths).sort()) {
      const koValue = entry ? this.getPath(entry, path) : undefined;
      const enValue = enEntry ? this.getPath(enEntry, path) : undefined;

      if (typeof koValue === "string" || typeof enValue === "string") {
        console.log(`  ${path}:`);
        if (typeof enValue === "string") console.log(`    en: "${puaToMarkers(enValue)}"`);
        if (typeof koValue === "string") console.log(`    ko: "${puaToMarkers(koValue)}"`);
        console.log();
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // search: 검색
  // ─────────────────────────────────────────────────────────────
  private async search(args: string[]): Promise<void> {
    if (args.length < 1) {
      console.log(`사용법: manifest search <pattern> [file]`);
      return;
    }

    const [pattern, filePath] = args;
    const regex = new RegExp(pattern, "i");
    const results: Array<{ file: string; hashId: string; path: string; value: string }> = [];

    const glob = new Bun.Glob("*.json");
    const koPath = `${MANIFEST_ROOT}${DEFAULT_LANG}/`;

    const files = filePath
      ? [this.normalizeFileName(filePath)]
      : await Array.fromAsync(glob.scan({ cwd: koPath }));

    for (const file of files) {
      const fullPath = `${koPath}${file.endsWith(".json") ? file : `${file}.json`}`;
      const targetFile = Bun.file(fullPath);
      if (!(await targetFile.exists())) continue;

      const data: ManifestData = await targetFile.json();
      const fileName = file.replace(".json", "");
      const patterns = this.getFieldPatterns(file);

      for (const [hashId, entry] of Object.entries(data)) {
        for (const { path, value } of this.extractTranslatableFields(entry, patterns)) {
          if (regex.test(value)) {
            results.push({ file: fileName, hashId, path, value });
          }
        }
      }
    }

    console.log(`\n=== 검색: "${pattern}" (${results.length}건) ===\n`);
    for (const r of results.slice(0, 50)) {
      console.log(`  ${r.file} ${r.hashId}.${r.path}`);
      console.log(`    "${puaToMarkers(r.value)}"`);
      console.log();
    }
    if (results.length > 50) {
      console.log(`  ... 외 ${results.length - 50}건`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // set: 번역 설정
  // ─────────────────────────────────────────────────────────────
  private async set(args: string[]): Promise<void> {
    const dryRun = args.includes("--dry-run");
    const force = args.includes("--force");
    const positionalArgs = args.filter((a) => !a.startsWith("--"));

    if (positionalArgs.length < 3) {
      console.log(`사용법: manifest set <file> <hashId.field> <translation> [--dry-run] [--force]`);
      return;
    }

    const [filePath, hashField, ...translationParts] = positionalArgs;
    const rawTranslation = translationParts.join(" ");

    // Parse hashId.field (support deep paths like hashId.bubbles.0.displayProperties.name)
    const dotIndex = hashField.indexOf(".");
    if (dotIndex === -1) {
      console.error(`오류: hashId.field 형식으로 입력하세요 (예: 1808687944.description)`);
      process.exit(1);
    }

    const hashId = hashField.substring(0, dotIndex);
    let fieldPath = hashField.substring(dotIndex + 1);

    // Expand shorthand (name → displayProperties.name)
    fieldPath = this.expandFieldPath(fieldPath);

    const translation = convertPuaMarkers(rawTranslation);
    await this.translate(filePath, hashId, fieldPath, translation, { dryRun, force });
  }

  // ─────────────────────────────────────────────────────────────
  // diff: en/ko 비교 (미번역 항목)
  // ─────────────────────────────────────────────────────────────
  private async diff(args: string[]): Promise<void> {
    if (args.length < 1) {
      console.log(`사용법: manifest diff <file>`);
      return;
    }

    const [filePath] = args;
    const { fullPath, enPath } = this.resolvePaths(filePath);
    const fileName = this.normalizeFileName(filePath);

    const enFile = Bun.file(enPath);
    const koFile = Bun.file(fullPath);

    if (!(await enFile.exists())) {
      console.error(`오류: en 파일을 찾을 수 없습니다: ${enPath}`);
      process.exit(1);
    }

    const enData: ManifestData = await enFile.json();
    const koData: ManifestData = (await koFile.exists()) ? await koFile.json() : {};

    const missing: Array<{ hashId: string; path: string; enValue: string }> = [];
    const identical: Array<{ hashId: string; path: string; value: string }> = [];

    const patterns = this.getFieldPatterns(fileName);

    for (const [hashId, enEntry] of Object.entries(enData)) {
      const koEntry = koData[hashId];

      for (const { path, value: enValue } of this.extractTranslatableFields(enEntry, patterns)) {
        const koValue = koEntry ? this.getPath(koEntry, path) : undefined;

        if (typeof koValue !== "string" || !koValue.trim()) {
          missing.push({ hashId, path, enValue });
        } else if (enValue === koValue) {
          identical.push({ hashId, path, value: enValue });
        }
      }
    }

    const displayName = fileName.replace(".json", "");
    console.log(`\n=== ${displayName} diff ===\n`);

    if (missing.length > 0) {
      console.log(`누락 (${missing.length}건):`);
      for (const m of missing.slice(0, 20)) {
        console.log(`  ${m.hashId}.${m.path}`);
        console.log(`    en: "${puaToMarkers(m.enValue)}"`);
      }
      if (missing.length > 20) console.log(`  ... 외 ${missing.length - 20}건`);
      console.log();
    }

    if (identical.length > 0) {
      console.log(`동일 (미번역 추정, ${identical.length}건):`);
      for (const i of identical.slice(0, 20)) {
        console.log(`  ${i.hashId}.${i.path}`);
        console.log(`    "${puaToMarkers(i.value)}"`);
      }
      if (identical.length > 20) console.log(`  ... 외 ${identical.length - 20}건`);
      console.log();
    }

    if (missing.length === 0 && identical.length === 0) {
      console.log(`모든 항목 번역 완료!`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────
  private resolvePaths(filePath: string): { fullPath: string; enPath: string } {
    const withExt = filePath.endsWith(".json") ? filePath : `${filePath}.json`;
    const hasLangPrefix = /^[a-z]{2}(-[A-Z]{2,3})?\//.test(withExt);
    const normalizedPath = hasLangPrefix ? withExt : `${DEFAULT_LANG}/${withExt}`;
    const fullPath = filePath.startsWith("/") ? filePath : `${MANIFEST_ROOT}${normalizedPath}`;
    const enPath = fullPath.replace(/\/ko\//, "/en/");
    return { fullPath, enPath };
  }

  private normalizeFileName(filePath: string): string {
    const withExt = filePath.endsWith(".json") ? filePath : `${filePath}.json`;
    return withExt.replace(/^[a-z]{2}(-[A-Z]{2,3})?\//, "");
  }

  private async translate(
    filePath: string,
    hashId: string,
    fieldPath: string,
    translation: string,
    opts: { dryRun: boolean; force: boolean }
  ): Promise<void> {
    const { fullPath, enPath } = this.resolvePaths(filePath);

    const targetFile = Bun.file(fullPath);
    const enFile = Bun.file(enPath);

    if (!(await targetFile.exists())) {
      console.error(`오류: 파일을 찾을 수 없습니다: ${fullPath}`);
      process.exit(1);
    }

    const targetText = await targetFile.text();
    const targetData: ManifestData = JSON.parse(targetText);

    // Load English reference if available
    let enData: ManifestData | null = null;
    if (await enFile.exists()) {
      enData = await enFile.json();
    }

    // Get entry from ko, fallback to en for reference
    const entry = targetData[hashId];
    const enEntry = enData?.[hashId];

    if (!entry && !enEntry) {
      console.error(`오류: hashId "${hashId}"를 en/ko 모두에서 찾을 수 없습니다.`);
      process.exit(1);
    }

    // Get current value
    const currentValue = entry ? this.getPath(entry, fieldPath) : undefined;

    // Get English reference value
    const enValue = enEntry ? this.getPath(enEntry, fieldPath) : undefined;

    // Check if already has value
    if (typeof currentValue === "string" && currentValue.trim() && !opts.force) {
      console.error(`오류: "${hashId}.${fieldPath}"에 이미 값이 있습니다.`);
      console.error(`현재 값: "${puaToMarkers(currentValue)}"`);
      if (typeof enValue === "string") {
        console.error(`영문 원본: "${puaToMarkers(enValue)}"`);
      }
      console.error(`덮어쓰려면 --force 플래그를 사용하세요.`);
      process.exit(1);
    }

    // Validate PUA characters against English source
    if (typeof enValue === "string") {
      const enPua = this.extractPuaChars(enValue);
      const translationPua = this.extractPuaChars(translation);

      if (enPua.length > 0 && translationPua.length < enPua.length) {
        console.error(`\n오류: 번역에 PUA 문자가 누락되었습니다.`);
        console.error(`영문 원본: "${puaToMarkers(enValue)}"`);
        console.error(`제출한 번역: "${puaToMarkers(translation)}"`);
        console.error(`\nPUA 문자를 [PUA-XXXX] 형태로 번역에 포함해주세요.`);
        process.exit(1);
      }
    }

    if (opts.dryRun) {
      console.log(`\n[DRY RUN] ${filePath}`);
      console.log(`  ${hashId}.${fieldPath}`);
      console.log(`  → "${puaToMarkers(translation)}"`);
      if (typeof enValue === "string") {
        console.log(`  원본: "${puaToMarkers(enValue)}"`);
      }
      return;
    }

    // Update using text replacement to preserve JSON structure
    const updatedText = this.updateJsonValue(
      targetText,
      hashId,
      fieldPath,
      typeof currentValue === "string" ? currentValue : undefined,
      translation
    );

    await Bun.write(fullPath, updatedText);
    console.log(`✓ ${hashId}.${fieldPath} → "${puaToMarkers(translation)}"`);
  }

  private extractPuaChars(text: string): string[] {
    return text.match(PUA_REGEX) ?? [];
  }

  private updateJsonValue(
    jsonText: string,
    hashId: string,
    fieldPath: string,
    oldValue: string | undefined,
    newValue: string
  ): string {
    const newJsonValue = JSON.stringify(newValue);

    // Extract the field name (last part of the path)
    const pathParts = fieldPath.split(".");
    const fieldName = pathParts[pathParts.length - 1];

    if (oldValue !== undefined) {
      const oldJsonValue = JSON.stringify(oldValue);
      const pattern = `"${fieldName}": ${oldJsonValue}`;
      const patternAlt = `"${fieldName}":${oldJsonValue}`;

      let index = jsonText.indexOf(pattern);
      let patternUsed = pattern;

      if (index === -1) {
        index = jsonText.indexOf(patternAlt);
        patternUsed = patternAlt;
      }

      if (index !== -1) {
        // Verify this is under the correct hashId by checking context
        const hashPattern = `"${hashId}":`;
        const hashIndex = jsonText.lastIndexOf(hashPattern, index);
        if (hashIndex !== -1) {
          // For nested paths, verify the parent structure matches
          if (this.verifyPathContext(jsonText, hashIndex, index, pathParts.slice(0, -1))) {
            const newPattern = `"${fieldName}": ${newJsonValue}`;
            return (
              jsonText.substring(0, index) +
              newPattern +
              jsonText.substring(index + patternUsed.length)
            );
          }
        }
      }
    }

    return this.addFieldToEntry(jsonText, hashId, fieldPath, newValue);
  }

  /**
   * Verify that the path context matches (for nested fields)
   */
  private verifyPathContext(
    jsonText: string,
    hashIndex: number,
    fieldIndex: number,
    parentPath: string[]
  ): boolean {
    if (parentPath.length === 0) return true;

    const textBetween = jsonText.substring(hashIndex, fieldIndex);
    // Simple check: verify all parent keys appear in order
    for (const key of parentPath) {
      if (/^\d+$/.test(key)) continue; // Skip array indices
      if (!textBetween.includes(`"${key}"`)) return false;
    }
    return true;
  }

  private addFieldToEntry(
    jsonText: string,
    hashId: string,
    fieldPath: string,
    value: string
  ): string {
    const data: ManifestData = JSON.parse(jsonText);

    if (!data[hashId]) {
      data[hashId] = {};
    }

    this.setPath(data[hashId] as Record<string, unknown>, fieldPath, value);

    const hasTrailingNewline = jsonText.endsWith("\n");
    const result = JSON.stringify(data, null, 2);
    return hasTrailingNewline ? `${result}\n` : result;
  }

  private printHelp(): void {
    console.log(`
사용법: bun run manager manifest <command> [options]

Commands:
  ls                              파일 목록
  get <file> <hashId>             항목 조회 (모든 필드 표시)
  search <pattern> [file]         검색 (모든 필드 대상)
  set <file> <id.path> <trans>    번역 설정 [--dry-run] [--force]
  diff <file>                     en/ko 비교 (미번역 찾기)

인수:
  file         대상 파일 (ko/, .json 생략 가능)
  hashId       해시 ID (예: 1808687944)
  id.path      해시ID.필드경로 (예: 1808687944.description)
  pattern      검색 패턴 (정규식)

필드 경로 (dot notation):
  단축형 (backward compatible):
    name                          → displayProperties.name
    description                   → displayProperties.description
    itemTypeDisplayName           → displayProperties.itemTypeDisplayName

  전체 경로:
    displayProperties.name        표준 이름
    displayProperties.description 표준 설명
    statName                      DestinyHistoricalStatsDefinition
    statNameAbbr                  DestinyHistoricalStatsDefinition
    sourceString                  DestinySourceDefinition
    progressDescription           DestinyObjectiveDefinition
    entry.name                    DestinyChecklistDefinition
    entry.prefix                  DestinyChecklistDefinition
    entry.completed               DestinyChecklistDefinition
    bubbles.0.displayProperties.name  DestinyDestinationDefinition (배열 인덱스)

예시:
  bun run manager manifest ls
  bun run manager manifest get DestinyInventoryItemDefinition 1808687944
  bun run manager manifest get DestinyHistoricalStatsDefinition kills
  bun run manager manifest get DestinyDestinationDefinition 697502628
  bun run manager manifest search "수호자"
  bun run manager manifest set DestinyInventoryItemDefinition 1808687944.description "새 설명"
  bun run manager manifest set DestinyHistoricalStatsDefinition kills.statNameAbbr "처치"
  bun run manager manifest set DestinyDestinationDefinition 697502628.bubbles.0.displayProperties.name "농장"
  bun run manager manifest diff BraytechActivityDefinition
`);
  }
}
