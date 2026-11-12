import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("Backend Health & Core Infrastructure", () => {
  it("GET /health should return status: ok with timestamp and environment", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("environment");
    expect(res.body).toHaveProperty("uptime");
  });

  it("GET /api should return service information", async () => {
    const res = await request(app).get("/api");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("name", "Enterprise Accounting & Inventory ERP API");
    expect(res.body.data).toHaveProperty("version", "1.0.0");
    expect(res.body.data).toHaveProperty("status", "operational");
  });

  it("GET /non-existent-endpoint should return standardized 404 error", async () => {
    const res = await request(app).get("/non-existent-endpoint");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "NOT_FOUND");
    expect(res.body.error.message).toContain("Cannot GET /non-existent-endpoint");
  });
});
