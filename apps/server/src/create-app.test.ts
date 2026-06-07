import request from "supertest";
import { createServer, get } from "node:http";
import { describe, expect, it } from "vitest";
import { createApp } from "./create-app";

const app = createApp({
  config: {
    host: "127.0.0.1",
    port: 0
  }
});

describe("server walking skeleton", () => {
  it("reports health using the API contract response shape", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok"
    });
  });

  it("publishes a deterministic walking skeleton SSE event", async () => {
    const server = createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected server to listen on a TCP address");
    }

    await new Promise<void>((resolve, reject) => {
      const clientRequest = get(
        `http://127.0.0.1:${address.port}/api/walking-skeleton/events`,
        (response) => {
          let body = "";
          let serverEndedStream = false;

          expect(response.statusCode).toBe(200);
          expect(response.headers["content-type"]).toContain("text/event-stream");

          response.on("data", (chunk: Buffer) => {
            body += chunk.toString("utf8");

            if (body !== 'event: walking-skeleton.ready\nid: 1\ndata: {"status":"ready"}\n\n') {
              return;
            }

            setImmediate(() => {
              try {
                expect(serverEndedStream).toBe(false);
                clientRequest.destroy();
                server.close((error) => {
                  if (error) {
                    reject(error);
                    return;
                  }

                  resolve();
                });
              } catch (error) {
                reject(error);
              }
            });
          });

          response.on("end", () => {
            serverEndedStream = true;
          });
        }
      );

      clientRequest.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "ECONNRESET") {
          return;
        }

        reject(error);
      });
    });
  });

  it("reports malformed JSON using the API contract error shape", async () => {
    const response = await request(app)
      .post("/api/health")
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "malformed-request",
        message: "Malformed request"
      }
    });
  });
});
