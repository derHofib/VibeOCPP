import Docker from 'dockerode';
import { isAllowedService, type AllowedService } from './whitelist.js';

export class UnknownServiceError extends Error {
  constructor(name: string) {
    super(`Unknown service: ${name}`);
    this.name = 'UnknownServiceError';
  }
}

export class ContainerNotFoundError extends Error {
  constructor(service: AllowedService) {
    super(`No running container found for service: ${service}`);
    this.name = 'ContainerNotFoundError';
  }
}

export interface ServiceStatus {
  service: AllowedService;
  found: boolean;
  containerId?: string;
  state?: string;
  status?: string;
}

/**
 * Every lookup goes through docker-compose's own
 * `com.docker.compose.service` label rather than a name we construct
 * ourselves — this works regardless of the Compose project name/prefix and,
 * combined with the whitelist check, means dockerode never sees anything
 * but a label filter built from a name we've already validated.
 */
export class DockerClient {
  constructor(private readonly docker: Docker = new Docker()) {}

  private async findContainer(service: string) {
    if (!isAllowedService(service)) {
      throw new UnknownServiceError(service);
    }
    const containers = await this.docker.listContainers({
      all: true,
      filters: { label: [`com.docker.compose.service=${service}`] },
    });
    return containers[0];
  }

  async getStatus(service: string): Promise<ServiceStatus> {
    if (!isAllowedService(service)) {
      throw new UnknownServiceError(service);
    }
    const container = await this.findContainer(service);
    if (!container) {
      return { service, found: false };
    }
    return {
      service,
      found: true,
      containerId: container.Id,
      state: container.State,
      status: container.Status,
    };
  }

  async getStatusAll(): Promise<ServiceStatus[]> {
    const { ALLOWED_SERVICES } = await import('./whitelist.js');
    return Promise.all(ALLOWED_SERVICES.map((service) => this.getStatus(service)));
  }

  async getLogs(service: string, tail = 200): Promise<string> {
    if (!isAllowedService(service)) {
      throw new UnknownServiceError(service);
    }
    const containerInfo = await this.findContainer(service);
    if (!containerInfo) {
      throw new ContainerNotFoundError(service);
    }
    const container = this.docker.getContainer(containerInfo.Id);
    const buffer = (await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    })) as unknown as Buffer;
    return demuxDockerLogBuffer(buffer);
  }

  async restart(service: string): Promise<void> {
    if (!isAllowedService(service)) {
      throw new UnknownServiceError(service);
    }
    const containerInfo = await this.findContainer(service);
    if (!containerInfo) {
      throw new ContainerNotFoundError(service);
    }
    const container = this.docker.getContainer(containerInfo.Id);
    await container.restart();
  }
}

/**
 * Docker's raw log stream (when the container wasn't started with a TTY,
 * which none of ours are) multiplexes stdout/stderr behind an 8-byte
 * header per frame: [stream type, 0, 0, 0, size1..size4 (big-endian)]. We
 * only need readable text out of it, so this strips the framing and
 * concatenates the payloads in order rather than pulling in a stream
 * demuxer dependency for one small piece of parsing.
 */
export function demuxDockerLogBuffer(buffer: Buffer): string {
  const chunks: string[] = [];
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset + 4);
    const start = offset + 8;
    const end = start + size;
    if (end > buffer.length) break;
    chunks.push(buffer.toString('utf8', start, end));
    offset = end;
  }
  return chunks.join('');
}
