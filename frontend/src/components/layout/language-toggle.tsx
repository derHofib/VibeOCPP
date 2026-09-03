import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn.js';

const LANGUAGES = ['de', 'en'] as const;

export function LanguageToggle() {
  const { t, i18n } = useTranslation('common');

  return (
    <div role="radiogroup" aria-label="Language" className="flex rounded-md border border-border p-0.5">
      {LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          role="radio"
          aria-checked={i18n.language === lng}
          onClick={() => void i18n.changeLanguage(lng)}
          className={cn(
            'rounded px-2 py-1 text-xs font-medium uppercase text-text-muted transition-colors',
            i18n.language === lng && 'bg-primary text-primary-foreground',
          )}
        >
          {lng}
          <span className="sr-only"> {t(`language.${lng}`)}</span>
        </button>
      ))}
    </div>
  );
}
