import { CLI } from "./cli";
import {
  BrowseCommand,
  FindUntranslatedCommand,
  GlossaryCommand,
  StatsCommand,
  SyncCommand,
  TranslateCommand,
} from "./commands";
import { GitService, TranslationService } from "./services";
import { KO_PATH, ROOT, VERSION } from "./types";

// Services
const translationService = new TranslationService(KO_PATH);
const gitService = new GitService(ROOT);

// CLI
const cli = new CLI(
  "bun run manager",
  "Translation manager for ko/ in braytech.org-translations",
  VERSION
)
  .register(new StatsCommand(translationService))
  .register(new FindUntranslatedCommand(translationService))
  .register(new SyncCommand(gitService, ROOT))
  .register(new GlossaryCommand())
  .register(new BrowseCommand(translationService))
  .register(new TranslateCommand());

await cli.run(Bun.argv.slice(2));
