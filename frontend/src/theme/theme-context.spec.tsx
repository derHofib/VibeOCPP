import { act, render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from './theme-context.js';

function Probe() {
  const { preference, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="pref">{preference}</span>
      <button onClick={() => setPreference('dark')}>dark</button>
      <button onClick={() => setPreference('light')}>light</button>
      <button onClick={() => setPreference('system')}>system</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to system with no data-theme attribute set', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('pref')).toHaveTextContent('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('sets data-theme and persists the choice when switching to dark', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    act(() => screen.getByText('dark').click());

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('vibeocpp.theme')).toBe('dark');
  });

  it('removes data-theme when switching back to system', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    act(() => screen.getByText('light').click());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    act(() => screen.getByText('system').click());
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('reads a previously stored preference on mount', () => {
    localStorage.setItem('vibeocpp.theme', 'dark');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('pref')).toHaveTextContent('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
