import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StationRow } from '../../api/locations.js';
import { buildStationParameters, copyToClipboard, resolveOcppBaseUrl } from '../../lib/station-parameters.js';
import { Button } from '../ui/button.js';

const COPIED_FEEDBACK_MS = 1500;

function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation('locations');
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    if (!(await copyToClipboard(value))) return;
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={copy}
      aria-label={`${t('parameters.copy')}: ${label}`}
      className="min-w-24 shrink-0"
    >
      <span aria-live="polite">{copied ? t('parameters.copied') : t('parameters.copy')}</span>
    </Button>
  );
}

function ParameterRow({
  label,
  hint,
  value,
  copyValue,
}: {
  label: string;
  hint?: string;
  value: string;
  copyValue?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <div className="min-w-0">
        <dt className="text-xs text-text-muted">{label}</dt>
        <dd className="select-all break-all font-mono text-sm">{value}</dd>
        {hint && <p className="text-xs text-text-muted">{hint}</p>}
      </div>
      {copyValue !== undefined && <CopyButton value={copyValue} label={label} />}
    </div>
  );
}

export function StationParametersPanel({ station, id }: { station: StationRow; id: string }) {
  const { t } = useTranslation('locations');
  const baseUrl = useMemo(() => resolveOcppBaseUrl(), []);
  const params = buildStationParameters(station, station.connectors, baseUrl);

  return (
    <section id={id} aria-label={t('parameters.title')} className="mt-3 rounded-md bg-surface-raised p-3">
      <h4 className="mb-1 text-sm font-semibold">{t('parameters.title')}</h4>
      <dl>
        <ParameterRow
          label={t('parameters.serverUrl')}
          hint={t('parameters.serverUrlHint')}
          value={params.serverUrl}
          copyValue={params.serverUrl}
        />
        <ParameterRow
          label={t('parameters.chargePointId')}
          hint={t('parameters.chargePointIdHint')}
          value={params.chargePointId}
          copyValue={params.chargePointId}
        />
        <ParameterRow
          label={t('parameters.fullUrl')}
          hint={t('parameters.fullUrlHint')}
          value={params.fullUrl}
          copyValue={params.fullUrl}
        />
        <ParameterRow
          label={t('parameters.ocppVersion')}
          hint={params.subprotocol ? t('parameters.subprotocolHint') : undefined}
          value={
            params.ocppVersion && params.subprotocol
              ? `${params.ocppVersion} (${params.subprotocol})`
              : t('parameters.ocppVersionAny')
          }
          copyValue={params.subprotocol ?? undefined}
        />
        <ParameterRow
          label={t('parameters.securityProfile')}
          hint={t('parameters.securityProfileHint')}
          value={t('parameters.securityProfile0')}
        />
      </dl>

      <h4 className="mb-1 mt-3 text-sm font-semibold">{t('parameters.connectors')}</h4>
      {params.connectors.length === 0 ? (
        <p className="text-xs text-text-muted">{t('noConnectors')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {params.connectors.map((c) => (
            <li key={c.id} className="font-mono text-xs">
              EVSE {c.evseId} / {t('parameters.connector')} {c.connectorId} · {c.label} · {c.type} ·{' '}
              {c.format === 'Cable' ? t('connector.form.formatCable') : t('connector.form.formatSocket')}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
