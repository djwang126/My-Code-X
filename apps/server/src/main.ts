import { createApp } from "./create-app";
import { loadConfig } from "./config";

const config = loadConfig();
const app = createApp({ config });

app.listen(config.port, config.host, () => {
  console.log(`My-Code-X server listening on http://${config.host}:${config.port}`);
});
