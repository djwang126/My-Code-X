import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const workspace = process.cwd();
const codexBin = process.env.CODEX_BIN ?? "codex";
const fixtureDir = path.join(
  workspace,
  "apps",
  "server",
  "src",
  "agent-cli",
  "fixtures",
  "codex"
);
const tmpDir = path.join(workspace, ".tmp");

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
const tmpLivePath = path.join(
  tmpDir,
  "codex-live-two-turn-file-command-revert.raw.jsonl"
);
const tmpProgressPath = path.join(tmpDir, "codex-fixture-capture-progress.log");
const stderrPath = path.join(tmpDir, "codex-fixture-capture.stderr.log");
const catPath = path.join(workspace, "cat.md");
const note = "Fixture note: Codex app-server touched this file.";

for (const file of [tmpLivePath, tmpProgressPath, stderrPath]) {
  fs.writeFileSync(file, "", "utf8");
}

let nextId = 1;
let childClosed = false;
let childExit = null;
let collect = false;
const pendingResponses = new Map();
const notificationWaiters = [];
const notifications = [];
const serverRequests = [];

function progress(line) {
  const text = `[${new Date().toISOString()}] ${line}\n`;
  fs.appendFileSync(tmpProgressPath, text, "utf8");
  console.log(line);
}

const child = spawn(
  codexBin,
  ["app-server", "--enable", "fast_mode", "--listen", "stdio://"],
  {
    cwd: workspace,
    stdio: ["pipe", "pipe", "pipe"]
  }
);

child.stderr.on("data", (chunk) => {
  fs.appendFileSync(stderrPath, chunk);
});

child.on("close", (code, signal) => {
  childClosed = true;
  childExit = { code, signal };
  const error = new Error(`codex app-server closed: ${JSON.stringify(childExit)}`);

  for (const waiter of pendingResponses.values()) {
    waiter.reject(error);
  }
  pendingResponses.clear();

  for (const waiter of notificationWaiters.splice(0)) {
    waiter.reject(error);
  }
});

const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
rl.on("line", (line) => {
  if (!line.trim()) {
    return;
  }

  let message;
  try {
    message = JSON.parse(line);
  } catch {
    progress(`non-json stdout: ${line}`);
    return;
  }

  handleMessage(message);
});

function send(message) {
  if (childClosed) {
    throw new Error(`cannot send after close ${JSON.stringify(childExit)}`);
  }

  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function handleMessage(message) {
  if (
    Object.prototype.hasOwnProperty.call(message, "method") &&
    Object.prototype.hasOwnProperty.call(message, "id")
  ) {
    handleServerRequest(message);
    return;
  }

  if (
    Object.prototype.hasOwnProperty.call(message, "id") &&
    !Object.prototype.hasOwnProperty.call(message, "method")
  ) {
    const waiter = pendingResponses.get(String(message.id));
    if (waiter !== undefined) {
      pendingResponses.delete(String(message.id));
      waiter.resolve(message);
    }
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(message, "method")) {
    return;
  }

  if (collect) {
    notifications.push(message);
    fs.appendFileSync(tmpLivePath, `${JSON.stringify(message)}\n`, "utf8");

    if (
      message.method === "turn/started" ||
      message.method === "turn/completed" ||
      message.method === "item/started" ||
      message.method === "item/completed"
    ) {
      const itemType = message.params?.item?.type
        ? ` ${message.params.item.type}`
        : "";
      const status = message.params?.turn?.status || message.params?.item?.status || "";
      progress(`notify ${message.method}${itemType}${status ? ` ${status}` : ""}`);
    }
  }

  for (let index = notificationWaiters.length - 1; index >= 0; index -= 1) {
    const waiter = notificationWaiters[index];
    if (waiter.predicate(message)) {
      notificationWaiters.splice(index, 1);
      waiter.resolve(message);
    }
  }
}

function handleServerRequest(message) {
  serverRequests.push(message);
  progress(`server request ${message.method}`);

  if (message.method === "item/commandExecution/requestApproval") {
    send({ id: message.id, result: { decision: "accept" } });
    return;
  }

  if (message.method === "item/fileChange/requestApproval") {
    send({ id: message.id, result: { decision: "accept" } });
    return;
  }

  if (message.method === "item/permissions/requestApproval") {
    send({
      id: message.id,
      result: {
        scope: "turn",
        permissions: message.params?.permissions ?? {}
      }
    });
    return;
  }

  if (message.method === "account/chatgptAuthTokens/refresh") {
    send({
      id: message.id,
      error: {
        code: -32601,
        message: "fixture capture does not refresh auth tokens"
      }
    });
    return;
  }

  send({
    id: message.id,
    error: {
      code: -32601,
      message: `unsupported server request ${message.method}`
    }
  });
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`timeout waiting for ${label} after ${ms}ms`)),
      ms
    );
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function request(method, params, timeoutMs = 120_000) {
  const id = nextId++;
  const response = new Promise((resolve, reject) => {
    pendingResponses.set(String(id), { resolve, reject });
  });

  send({ id, method, ...(params === undefined ? {} : { params }) });

  const message = await withTimeout(response, timeoutMs, `${method} response`);
  if (message.error) {
    throw new Error(`${method} failed: ${JSON.stringify(message.error)}`);
  }

  return message;
}

function notify(method, params) {
  send({ method, ...(params === undefined ? {} : { params }) });
}

async function waitNotification(predicate, label, timeoutMs = 120_000) {
  for (const notification of notifications) {
    if (predicate(notification)) {
      return notification;
    }
  }

  const notification = new Promise((resolve, reject) => {
    notificationWaiters.push({ predicate, resolve, reject });
  });

  return withTimeout(notification, timeoutMs, label);
}

function turnDone(threadId, turnId) {
  return (notification) =>
    notification.method === "turn/completed" &&
    notification.params?.threadId === threadId &&
    notification.params?.turn?.id === turnId;
}

function isThreadNotification(notification, threadId) {
  const params = notification.params ?? {};
  return params.threadId === threadId || params.thread?.id === threadId;
}

function countMethods(list) {
  const counts = {};
  for (const notification of list) {
    counts[notification.method] = (counts[notification.method] || 0) + 1;
  }
  return counts;
}

async function main() {
  progress("initialize");
  await request("initialize", {
    clientInfo: {
      name: "my-code-x-fixture-capture",
      title: "My Code X Fixture Capture",
      version: "0.1.0"
    },
    capabilities: { experimentalApi: true }
  });
  notify("initialized");

  collect = true;
  progress("thread/start");
  const threadStart = await request("thread/start", {
    cwd: workspace,
    serviceTier: "fast",
    persistExtendedHistory: true,
    approvalPolicy: "never",
    sandbox: "danger-full-access"
  });
  const threadId = threadStart.result.thread.id;
  progress(`thread ${threadId}`);

  const firstPrompt = [
    "请在当前项目根目录工作。",
    "先读取 cat.md 的当前内容。",
    `然后只在 cat.md 文件末尾新增一行：${note}`,
    "再执行 harmless 命令 `pwd` 确认当前工作目录。",
    "请实际完成文件修改和命令执行，不要修改其他文件。完成后一句话说明。"
  ].join("\n");

  progress("turn/start first");
  const firstTurn = await request("turn/start", {
    threadId,
    input: [{ type: "text", text: firstPrompt }],
    serviceTier: "fast"
  });
  const firstTurnId = firstTurn.result.turn.id;
  const firstDone = await waitNotification(
    turnDone(threadId, firstTurnId),
    `first turn ${firstTurnId}`
  );
  progress(`first turn completed ${firstDone.params.turn.status}`);

  const secondPrompt = [
    "请撤回你上一轮对 cat.md 做的修改。",
    `只删除这一行：${note}`,
    "让 cat.md 回到上一轮开始前的内容，不要留下额外空行。",
    "不要修改其他文件。完成后一句话说明。"
  ].join("\n");

  progress("turn/start second");
  const secondTurn = await request("turn/start", {
    threadId,
    input: [{ type: "text", text: secondPrompt }],
    serviceTier: "fast"
  });
  const secondTurnId = secondTurn.result.turn.id;
  const secondDone = await waitNotification(
    turnDone(threadId, secondTurnId),
    `second turn ${secondTurnId}`
  );
  progress(`second turn completed ${secondDone.params.turn.status}`);

  collect = false;
  const filteredNotifications = notifications.filter((notification) =>
    isThreadNotification(notification, threadId)
  );
  fs.writeFileSync(
    liveFixturePath,
    `${filteredNotifications.map((notification) => JSON.stringify(notification)).join("\n")}\n`,
    "utf8"
  );
  progress(`wrote live fixture ${filteredNotifications.length} notifications`);

  progress("thread/resume");
  const resume = await request(
    "thread/resume",
    {
      threadId,
      persistExtendedHistory: true
    },
    30_000
  );
  fs.writeFileSync(resumeFixturePath, `${JSON.stringify(resume, null, 2)}\n`, "utf8");
  progress(`wrote resume fixture ${resume.result.thread.turns.length} turns`);

  const catContent = fs.existsSync(catPath) ? fs.readFileSync(catPath, "utf8") : null;
  console.log(
    JSON.stringify(
      {
        threadId,
        firstTurnId,
        firstTurnStatus: firstDone.params.turn.status,
        secondTurnId,
        secondTurnStatus: secondDone.params.turn.status,
        liveFixturePath,
        resumeFixturePath,
        tmpLivePath,
        stderrPath,
        methodCounts: countMethods(filteredNotifications),
        serverRequestMethods: serverRequests.map((requestMessage) => requestMessage.method),
        catContainsNote: catContent?.includes(note) ?? null,
        catContent,
        threadStartServiceTier: threadStart.result.serviceTier,
        resumeTurns: resume.result.thread.turns.length
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    progress(`ERROR ${error.stack || error.message || String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => {
    collect = false;
    try {
      child.stdin.end();
    } catch {
      // Ignore shutdown errors.
    }

    setTimeout(() => {
      if (!childClosed) {
        try {
          child.kill();
        } catch {
          // Ignore shutdown errors.
        }
      }
    }, 1000);
  });
