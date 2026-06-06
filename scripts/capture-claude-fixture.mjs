import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspace = process.cwd();
const fixtureDir = path.join(
  workspace,
  "apps",
  "server",
  "src",
  "agent-cli",
  "fixtures",
  "claude-code"
);
const tmpDir = path.join(workspace, ".tmp");
const sdkPackageDir = path.join(
  workspace,
  "apps",
  "server",
  "node_modules",
  "@anthropic-ai",
  "claude-agent-sdk"
);
const sdkPath = path.join(sdkPackageDir, "sdk.mjs");
const sdkPackagePath = path.join(sdkPackageDir, "package.json");

fs.mkdirSync(tmpDir, { recursive: true });
fs.mkdirSync(fixtureDir, { recursive: true });

const liveFixturePath = path.join(
  fixtureDir,
  "live-two-turn-file-command-revert.jsonl"
);
const resumeFixturePath = path.join(
  fixtureDir,
  "resume-two-turn-file-command-revert.json"
);
const inputsFixturePath = path.join(
  fixtureDir,
  "live-two-turn-file-command-revert.inputs.json"
);
const fixtureInputs = [];
const tmpLivePath = path.join(
  tmpDir,
  "claude-live-two-turn-file-command-revert.raw.jsonl"
);
const tmpProgressPath = path.join(tmpDir, "claude-fixture-capture-progress.log");
const catPath = path.join(workspace, "cat.md");
const note = "Fixture note: Claude Agent SDK touched this file.";

for (const file of [liveFixturePath, inputsFixturePath, tmpLivePath, tmpProgressPath]) {
  fs.writeFileSync(file, "", "utf8");
}

const sdkPackage = JSON.parse(fs.readFileSync(sdkPackagePath, "utf8"));
const { query, getSessionMessages } = await import(pathToFileURL(sdkPath).href);

function now() {
  return new Date().toISOString();
}

function writeJsonl(filePath, record) {
  fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, "utf8");
}

function writeLiveRecord(record) {
  writeJsonl(liveFixturePath, record);
}

function writeRawSdkMessage(message) {
  writeLiveRecord(message);
  writeJsonl(tmpLivePath, message);
}

function progress(line) {
  const text = `[${now()}] ${line}\n`;
  fs.appendFileSync(tmpProgressPath, text, "utf8");
  console.log(line);
}

function summarizeMessage(message) {
  if (message?.type === "assistant") {
    const content = Array.isArray(message.message?.content)
      ? message.message.content.map((block) => block?.type).join(",")
      : typeof message.message?.content;
    return `assistant ${content}`;
  }

  if (message?.type === "user") {
    const content = Array.isArray(message.message?.content)
      ? message.message.content.map((block) => block?.type).join(",")
      : typeof message.message?.content;
    return `user ${content}`;
  }

  if (message?.type === "system") {
    return `system ${message.subtype ?? ""}`.trim();
  }

  if (message?.type === "result") {
    return `result ${message.subtype ?? ""}`.trim();
  }

  return String(message?.type ?? "unknown");
}

function countMessageTypes(messages) {
  const counts = {};
  for (const message of messages) {
    counts[message.type] = (counts[message.type] || 0) + 1;
  }
  return counts;
}

async function runQueryTurn(input) {
  progress(`query/start ${input.label}`);
  let resultMessage = null;
  const inboundMessages = [];

  fixtureInputs.push({
    label: input.label,
    prompt: input.prompt,
    ...(input.resumeSessionId === undefined
      ? {}
      : { resumeSessionId: input.resumeSessionId })
  });

  const options = {
    cwd: workspace,
    allowedTools: ["Read", "Edit", "Bash"],
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    includePartialMessages: true,
    maxTurns: 10,
    ...(input.resumeSessionId === undefined ? {} : { resume: input.resumeSessionId })
  };

  for await (const message of query({ prompt: input.prompt, options })) {
    inboundMessages.push(message);
    writeRawSdkMessage(message);
    progress(`sdk ${input.label} ${summarizeMessage(message)}`);

    if (message?.type === "result") {
      resultMessage = message;
    }
  }

  if (resultMessage === null) {
    throw new Error(`Claude query ${input.label} completed without a result message`);
  }

  progress(`query/completed ${input.label} ${resultMessage.subtype}`);

  return {
    resultMessage,
    inboundMessages
  };
}

async function main() {
  const originalCatContent = fs.existsSync(catPath)
    ? fs.readFileSync(catPath, "utf8")
    : null;

  const firstPrompt = [
    "You are generating a deterministic My-Code-X fixture.",
    "Work only in the current repository.",
    "First read cat.md.",
    `Then append exactly this line to cat.md: ${note}`,
    "Then run harmless command `node --version`.",
    "Do not modify any other file.",
    "After completing the file edit and command, reply in one sentence."
  ].join("\n");

  const secondPrompt = [
    "Continue the fixture cleanup.",
    "Revert only your previous change to cat.md.",
    `Delete exactly this line: ${note}`,
    "Restore cat.md to the content it had before your previous turn.",
    "Do not modify any other file.",
    "After completing the cleanup, reply in one sentence."
  ].join("\n");

  progress(
    `capture ${sdkPackage.name}@${sdkPackage.version} claude-code ${sdkPackage.claudeCodeVersion}`
  );

  const first = await runQueryTurn({
    label: "first",
    prompt: firstPrompt
  });
  const sessionId = first.resultMessage.session_id;

  const second = await runQueryTurn({
    label: "second",
    prompt: secondPrompt,
    resumeSessionId: sessionId
  });

  progress(
    `wrote live fixture ${first.inboundMessages.length + second.inboundMessages.length} sdk messages`
  );

  progress("getSessionMessages");
  const sessionMessages = await getSessionMessages(sessionId, { dir: workspace });
  fs.writeFileSync(
    resumeFixturePath,
    `${JSON.stringify(sessionMessages, null, 2)}\n`,
    "utf8"
  );
  progress(`wrote resume fixture ${sessionMessages.length} messages`);

  fs.writeFileSync(
    inputsFixturePath,
    `${JSON.stringify(fixtureInputs, null, 2)}\n`,
    "utf8"
  );
  progress(`wrote inputs sidecar ${fixtureInputs.length} prompts`);

  const liveMessages = fs
    .readFileSync(liveFixturePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((record) => typeof record.type === "string");
  const catContent = fs.existsSync(catPath) ? fs.readFileSync(catPath, "utf8") : null;

  console.log(
    JSON.stringify(
      {
        sessionId,
        liveFixturePath,
        inputsFixturePath,
        resumeFixturePath,
        tmpLivePath,
        progressPath: tmpProgressPath,
        fixtureInputs: fixtureInputs.length,
        liveMessages: liveMessages.length,
        liveMessageTypes: countMessageTypes(liveMessages),
        firstInboundMessages: first.inboundMessages.length,
        secondInboundMessages: second.inboundMessages.length,
        resumeMessages: sessionMessages.length,
        catRestored: catContent === originalCatContent,
        catContainsNote: catContent?.includes(note) ?? null
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  progress(`ERROR ${error.stack || error.message || String(error)}`);
  process.exitCode = 1;
});
