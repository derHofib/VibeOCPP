import { describe, expect, it, vi } from 'vitest';
import {
  ContainerNotFoundError,
  DockerClient,
  UnknownServiceError,
  demuxDockerLogBuffer,
} from './docker-client.js';

function fakeContainerInfo(id: string) {
  return { Id: id, State: 'running', Status: 'Up 2 minutes' };
}

function makeFakeDocker(opts: {
  listContainers: ReturnType<typeof vi.fn>;
  containerActions?: { logs?: ReturnType<typeof vi.fn>; restart?: ReturnType<typeof vi.fn> };
}) {
  const getContainer = vi.fn((id: string) => ({
    id,
    logs: opts.containerActions?.logs ?? vi.fn(),
    restart: opts.containerActions?.restart ?? vi.fn(),
  }));
  return {
    listContainers: opts.listContainers,
    getContainer,
  } as unknown as import('dockerode');
}

describe('DockerClient', () => {
  it('rejects an unknown service before touching dockerode at all', async () => {
    const listContainers = vi.fn();
    const client = new DockerClient(makeFakeDocker({ listContainers }));

    await expect(client.getStatus('not-whitelisted')).rejects.toThrow(UnknownServiceError);
    await expect(client.getLogs('not-whitelisted')).rejects.toThrow(UnknownServiceError);
    await expect(client.restart('not-whitelisted')).rejects.toThrow(UnknownServiceError);
    expect(listContainers).not.toHaveBeenCalled();
  });

  it('filters listContainers by the compose service label, not a constructed name', async () => {
    const listContainers = vi.fn().mockResolvedValue([]);
    const client = new DockerClient(makeFakeDocker({ listContainers }));

    await client.getStatus('backend');

    expect(listContainers).toHaveBeenCalledWith({
      all: true,
      filters: { label: ['com.docker.compose.service=backend'] },
    });
  });

  it('reports found: false when no container matches', async () => {
    const listContainers = vi.fn().mockResolvedValue([]);
    const client = new DockerClient(makeFakeDocker({ listContainers }));

    await expect(client.getStatus('backend')).resolves.toEqual({
      service: 'backend',
      found: false,
    });
  });

  it('reports container details when a match is found', async () => {
    const listContainers = vi.fn().mockResolvedValue([fakeContainerInfo('abc123')]);
    const client = new DockerClient(makeFakeDocker({ listContainers }));

    await expect(client.getStatus('backend')).resolves.toEqual({
      service: 'backend',
      found: true,
      containerId: 'abc123',
      state: 'running',
      status: 'Up 2 minutes',
    });
  });

  it('throws ContainerNotFoundError on restart of a whitelisted but absent service', async () => {
    const listContainers = vi.fn().mockResolvedValue([]);
    const client = new DockerClient(makeFakeDocker({ listContainers }));

    await expect(client.restart('backend')).rejects.toThrow(ContainerNotFoundError);
  });

  it('restarts the exact container found via the label filter', async () => {
    const listContainers = vi.fn().mockResolvedValue([fakeContainerInfo('abc123')]);
    const restart = vi.fn().mockResolvedValue(undefined);
    const client = new DockerClient(makeFakeDocker({ listContainers, containerActions: { restart } }));

    await client.restart('backend');

    expect(restart).toHaveBeenCalledOnce();
  });

  it('demuxes docker log frames and passes the tail option through', async () => {
    // One stdout frame containing "hello\n": header [1,0,0,0, size(4 bytes BE)]
    const payload = Buffer.from('hello\n', 'utf8');
    const header = Buffer.alloc(8);
    header.writeUInt8(1, 0);
    header.writeUInt32BE(payload.length, 4);
    const frame = Buffer.concat([header, payload]);

    const logs = vi.fn().mockResolvedValue(frame);
    const listContainers = vi.fn().mockResolvedValue([fakeContainerInfo('abc123')]);
    const client = new DockerClient(makeFakeDocker({ listContainers, containerActions: { logs } }));

    await expect(client.getLogs('backend', 50)).resolves.toBe('hello\n');
    expect(logs).toHaveBeenCalledWith({ stdout: true, stderr: true, tail: 50, timestamps: true });
  });
});

describe('demuxDockerLogBuffer', () => {
  it('concatenates multiple stdout/stderr frames in order', () => {
    function frame(streamType: number, text: string): Buffer {
      const payload = Buffer.from(text, 'utf8');
      const header = Buffer.alloc(8);
      header.writeUInt8(streamType, 0);
      header.writeUInt32BE(payload.length, 4);
      return Buffer.concat([header, payload]);
    }
    const buffer = Buffer.concat([frame(1, 'out-line\n'), frame(2, 'err-line\n')]);
    expect(demuxDockerLogBuffer(buffer)).toBe('out-line\nerr-line\n');
  });

  it('returns an empty string for an empty buffer', () => {
    expect(demuxDockerLogBuffer(Buffer.alloc(0))).toBe('');
  });
});
