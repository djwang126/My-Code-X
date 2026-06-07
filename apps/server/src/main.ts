import { createApp } from "./create-app";
import { loadConfig } from "./config";
import { createProductionConversationViewRuntime } from "./conversation-view/create-production-conversation-view-runtime";

const config = loadConfig();
const conversationView = createProductionConversationViewRuntime();
const app = createApp({ config, conversationView });

app.listen(config.port, config.host, () => {
  console.log(`My-Code-X server listening on http://${config.host}:${config.port}`);
});
