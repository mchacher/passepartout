// One-click update (spec 025), Sowel-style and OPT-IN. Requires the Docker socket to be
// mounted into this container (a deliberate operator choice, since it grants effective host
// root). When present, we spawn a detached `docker:cli` helper that runs
// `docker compose pull && up -d` for our compose project, so the update survives this
// container being recreated. Without the socket, apply is disabled and the caller shows the
// manual command instead.

import { existsSync } from "node:fs";
import { hostname } from "node:os";

export const MANUAL_COMMAND = "docker compose pull && docker compose up -d";

const HELPER_IMAGE = "docker:27-cli";
const HELPER_NAME = "passepartout-updater";
const LABEL_PROJECT = "com.docker.compose.project";
const LABEL_WORKING_DIR = "com.docker.compose.project.working_dir";

let updating = false;

// The socket path is overridable (DOCKER_SOCKET_PATH) so tests can point it at a missing file
// to exercise the "unavailable" path deterministically, regardless of the host's real socket.
function socketPath(): string {
  return process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock";
}

export function isDockerAvailable(): boolean {
  return existsSync(socketPath());
}

export function isUpdating(): boolean {
  return updating;
}

/** The shell the helper runs: pause so we can reply first, then pull + recreate the stack. */
export function buildUpdateCommand(): string {
  return "sleep 3; docker compose pull && docker compose up -d";
}

/**
 * Start a detached helper that updates the stack. Returns immediately; the helper recreates
 * this container, so the client must poll /version to see the new one. Never throws.
 */
export async function startUpdate(): Promise<{ started: boolean; error?: string }> {
  if (!isDockerAvailable()) return { started: false, error: "Docker socket not available" };
  if (updating) return { started: false, error: "update already in progress" };
  updating = true;
  try {
    const { default: Docker } = await import("dockerode");
    const docker = new Docker({ socketPath: socketPath() });

    // Read our own compose labels to find the project and its working directory on the host.
    const info = await docker.getContainer(hostname()).inspect();
    const labels = info.Config?.Labels ?? {};
    const workingDir = labels[LABEL_WORKING_DIR];
    const project = labels[LABEL_PROJECT];
    if (!workingDir || !project) {
      updating = false;
      return { started: false, error: "not managed by docker compose" };
    }

    // Clear any leftover helper, then run a fresh one bound to the socket + the compose dir.
    try {
      await docker.getContainer(HELPER_NAME).remove({ force: true });
    } catch {
      /* none to remove */
    }
    const helper = await docker.createContainer({
      Image: HELPER_IMAGE,
      name: HELPER_NAME,
      Cmd: ["sh", "-c", buildUpdateCommand()],
      WorkingDir: workingDir,
      Env: [`COMPOSE_PROJECT_NAME=${project}`],
      HostConfig: {
        AutoRemove: true,
        Binds: [`${socketPath()}:${socketPath()}`, `${workingDir}:${workingDir}`],
      },
    });
    await helper.start();
    // Leave `updating` true: this container is about to be recreated by the helper.
    return { started: true };
  } catch (e) {
    updating = false;
    return { started: false, error: e instanceof Error ? e.message : "update failed" };
  }
}
