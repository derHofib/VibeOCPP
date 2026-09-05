import { act, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { renderWithQueryClient } from '../test/render-with-providers.js';
import { OpsPage } from './ops-page.js';
import * as opsApi from '../api/ops.js';

describe('OpsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a card per service with running/unreachable status', async () => {
    vi.spyOn(opsApi, 'listOpsStatus').mockResolvedValue([
      { service: 'backend', found: true, state: 'running', status: 'Up 2 minutes' },
      { service: 'hasura', found: false },
    ]);

    renderWithQueryClient(<OpsPage />);

    await waitFor(() => expect(screen.getByText('Läuft')).toBeInTheDocument());
    expect(screen.getByText('backend')).toBeInTheDocument();
    expect(screen.getByText('hasura')).toBeInTheDocument();
    expect(screen.getAllByText('Nicht erreichbar')).toHaveLength(1);
  });

  it('calls restart for the clicked service', async () => {
    vi.spyOn(opsApi, 'listOpsStatus').mockResolvedValue([
      { service: 'backend', found: true, state: 'running', status: 'Up 2 minutes' },
    ]);
    const restartSpy = vi.spyOn(opsApi, 'restartOpsService').mockResolvedValue({ service: 'backend', restarted: true });

    renderWithQueryClient(<OpsPage />);
    await waitFor(() => expect(screen.getByText('backend')).toBeInTheDocument());

    await act(async () => {
      screen.getByText('Neu starten').click();
    });

    await waitFor(() => expect(restartSpy).toHaveBeenCalledWith('backend'));
  });

  it('loads and displays logs on demand', async () => {
    vi.spyOn(opsApi, 'listOpsStatus').mockResolvedValue([
      { service: 'backend', found: true, state: 'running', status: 'Up 2 minutes' },
    ]);
    vi.spyOn(opsApi, 'getOpsLogs').mockResolvedValue({ service: 'backend', logs: 'hello from backend\n' });

    renderWithQueryClient(<OpsPage />);
    await waitFor(() => expect(screen.getByText('backend')).toBeInTheDocument());

    await act(async () => {
      screen.getByText('Logs anzeigen').click();
    });

    await waitFor(() => expect(screen.getByText('hello from backend')).toBeInTheDocument());
  });
});
