import type { Command } from "./types";

export class CLI {
  private commands = new Map<string, Command>();
  private aliases = new Map<string, string>();

  constructor(
    private name: string,
    private description: string,
    private version: string,
  ) {
    this.aliases.set("-h", "--help");
    this.aliases.set("-v", "--version");
  }

  register(command: Command): this {
    this.commands.set(command.name, command);
    return this;
  }

  private resolveAlias(arg: string): string {
    return this.aliases.get(arg) ?? arg;
  }

  private printHelp(): void {
    const maxLen = Math.max(...[...this.commands.keys()].map((k) => k.length));

    console.log(`
${this.description}

Usage: ${this.name} <command> [options]

Commands:
${[...this.commands.values()]
  .map((cmd) => `  ${cmd.name.padEnd(maxLen + 2)}${cmd.description}`)
  .join("\n")}

Options:
  -h, --help       도움말 표시
  -v, --version    버전 표시

Examples:
  ${this.name} stats              번역 진행률 확인
  ${this.name} find-untranslated  미번역 항목 목록 출력
  ${this.name} sync               forked → master 동기화
  ${this.name} glossary           용어집 목록
  ${this.name} glossary search 수호자
  ${this.name} browse Settings    Settings 하위 키 탐색
  ${this.name} browse search 북마크
`);
  }

  private printVersion(): void {
    console.log(`${this.name} v${this.version}`);
  }

  async run(args: string[]): Promise<void> {
    const arg = args[0];
    const resolved = arg ? this.resolveAlias(arg) : null;

    if (!resolved || resolved === "--help") {
      this.printHelp();
      return;
    }

    if (resolved === "--version") {
      this.printVersion();
      return;
    }

    const command = this.commands.get(resolved);
    if (!command) {
      console.error(`Unknown command: ${arg}\n`);
      console.error(`Run '${this.name} --help' for usage.`);
      process.exit(1);
    }

    await command.execute();
  }
}
