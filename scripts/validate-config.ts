import { loadCatalog } from "../src/lib/config/load-catalog";

async function main() {
  const args = process.argv.slice(2);

  if (args.length > 1) {
    throw new Error("Uso: npm run validate:config -- [directory-config]");
  }
  const snapshot = await loadCatalog(args[0]);

  console.log("Configurazione valida.");
  console.log(JSON.stringify({
    defaultEventId: snapshot.config.app.defaultEventId,
    events: snapshot.config.events.length,
    profiles: snapshot.profiles.length,
    categories: snapshot.categories.length,
    pavilions: snapshot.pavilions.length,
    stands: snapshot.stands.length,
    interests: snapshot.interests.length,
    plannedProducts: snapshot.plannedProducts.length,
    questionnaires: snapshot.questionnaires.length,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Impossibile caricare la configurazione.");
  process.exitCode = 1;
});
