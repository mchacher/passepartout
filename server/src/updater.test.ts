import { describe, it, expect, beforeAll } from "vitest";
import { buildUpdateCommand, isDockerAvailable, MANUAL_COMMAND } from "./updater";

// Point the socket at a missing path so the "unavailable" path is exercised deterministically,
// regardless of whether the host (Docker Desktop / CI runner) actually has a socket.
beforeAll(() => {
  process.env.DOCKER_SOCKET_PATH = "/tmp/passepartout-no-such.sock";
});

describe("updater", () => {
  it("builds the helper command (pull + recreate after a short pause)", () => {
    const cmd = buildUpdateCommand();
    expect(cmd).toContain("docker compose pull");
    expect(cmd).toContain("docker compose up -d");
    expect(cmd.startsWith("sleep")).toBe(true);
  });

  it("reports docker unavailable when the socket path does not exist", () => {
    expect(isDockerAvailable()).toBe(false);
  });

  it("exposes the manual command", () => {
    expect(MANUAL_COMMAND).toBe("docker compose pull && docker compose up -d");
  });
});
