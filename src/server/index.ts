import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import path from "path";
import { createHttpServer } from "./httpServer";

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("server", {
      alias: "s",
      type: "string",
      description: "NATS server URL to pre-connect on launch",
    })
    .option("port", {
      alias: "p",
      type: "number",
      description: "HTTP port (default: auto)",
    })
    .option("no-open", {
      type: "boolean",
      description: "Do not auto-open browser",
    })
    .help()
    .parse();

  const port: number = argv.port ?? (await import("get-port").then((m) => m.default()));
  const staticDir = path.resolve(__dirname, "../../dist-client");

  const server = createHttpServer(staticDir, argv.server);

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`NATS Client running at ${url}`);
    if (!argv["no-open"]) {
      import("open").then((m) => m.default(url)).catch(() => {});
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
