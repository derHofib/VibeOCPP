import { useTranslation } from 'react-i18next';
import { useTheme, type ThemePreference } from '../../theme/theme-context.js';
import { cn } from '../../lib/cn.js';

const OPTIONS: ThemePreference[] = ['light', 'dark', 'system'];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const { t } = useTranslation('common');

  return (
    <div
      role="radiogroup"
      aria-label={t('theme.system')}
      className="flex rounded-md border border-border p-0.5"
    >
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={preference === option}
          onClick={() => setPreference(option)}
          className={cn(
            'rounded px-2 py-1 text-xs font-medium text-text-muted transition-colors',
            preference === option && 'bg-primary text-primary-foreground',
          )}
        >
          {t(`theme.${option}`)}
        </button>
      ))}
    </div>
  );
}
