import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { renderWithQueryClient } from '../test/render-with-providers.js';
import { UsersPage } from './users-page.js';
import * as usersApi from '../api/users.js';

vi.mock('../auth/auth-context.js', () => ({
  useAuth: () => ({ user: { id: 'u1', tenantId: 't1', email: 'admin@x.test', role: 'SuperAdmin' } }),
}));

describe('UsersPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the fetched user list', async () => {
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([
      { id: '1', email: 'a@b.c', role: 'Admin', isActive: true, createdAt: new Date().toISOString() },
      { id: '2', email: 'd@e.f', role: 'Mitarbeiter', isActive: false, createdAt: new Date().toISOString() },
    ]);

    renderWithQueryClient(<UsersPage />);

    await waitFor(() => expect(screen.getByText('a@b.c')).toBeInTheDocument());
    expect(screen.getByText('d@e.f')).toBeInTheDocument();
  });

  it('shows the empty state when there are no users', async () => {
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([]);

    renderWithQueryClient(<UsersPage />);

    await waitFor(() => expect(screen.getByText('Noch keine Benutzer angelegt.')).toBeInTheDocument());
  });

  it('creates a user through the dialog and refreshes the list', async () => {
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([]);
    const createSpy = vi.spyOn(usersApi, 'createUser').mockResolvedValue({
      id: '3',
      email: 'new@x.test',
      role: 'Admin',
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    renderWithQueryClient(<UsersPage />);
    await waitFor(() => expect(screen.getByText('Noch keine Benutzer angelegt.')).toBeInTheDocument());

    act(() => {
      screen.getByText('Neuer Benutzer').click();
    });

    fireEvent.change(screen.getByLabelText('E-Mail-Adresse'), { target: { value: 'new@x.test' } });
    fireEvent.change(screen.getByLabelText('Initialpasswort'), { target: { value: 'a-very-long-password' } });

    await act(async () => {
      screen.getByText('Anlegen').click();
    });

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith({
        email: 'new@x.test',
        password: 'a-very-long-password',
        role: 'Admin',
      }),
    );
  });
});
