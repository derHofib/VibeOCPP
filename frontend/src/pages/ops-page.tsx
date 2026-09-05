import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getOpsLogs, listOpsStatus, restartOpsService } from '../api/ops.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.js';
import { StatusBadge } from '../components/ui/status-badge.js';
import { Button } from '../components/ui/button.js';

function ServiceCard({ service }: { service: string }) {
  const { t } = useTranslation('ops');
  const queryClient = useQueryClient();
  const [showLogs, setShowLogs] = useState(false);

  const status = useQuery({
    queryKey: ['ops', 'status', service],
    queryFn: () => listOpsStatus().then((all) => all.find((s) => s.service === service)),
    // Container state can change outside this UI (a restart from the CLI, a
    // crash) — a slow poll keeps the dashboard honest without hammering the
    // ops-agent for a value that rarely changes.
    refetchInterval: 15_000,
  });

  const logs = useQuery({
    queryKey: ['ops', 'logs', service],
    queryFn: () => getOpsLogs(service),
    enabled: showLogs,
  });

  const restart = useMutation({
    mutationFn: () => restartOpsService(service),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'status', service] });
    },
  });

  const found = status.data?.found ?? false;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="font-mono text-base">{service}</CardTitle>
          <CardDescription>{status.data?.status ?? '—'}</CardDescription>
        </div>
        <StatusBadge tone={found ? 'success' : 'danger'}>
          {found ? t('state.running') : t('state.notFound')}
        </StatusBadge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowLogs((v) => !v)}>
            {showLogs ? t('actions.hideLogs') : t('actions.viewLogs')}
          </Button>
          <Button size="sm" variant="danger" disabled={restart.isPending} onClick={() => restart.mutate()}>
            {restart.isPending ? t('actions.restarting') : t('actions.restart')}
          </Button>
        </div>
        {showLogs && (
          <pre className="max-h-64 overflow-auto rounded-md bg-bg p-3 font-mono text-xs text-text-muted">
            {logs.data?.logs || t('logsEmpty')}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

export function OpsPage() {
  const { t } = useTranslation('ops');
  const { t: tc } = useTranslation('common');

  const { data, isLoading, isError } = useQuery({ queryKey: ['ops', 'status'], queryFn: listOpsStatus });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text">{t('title')}</h1>
        <p className="text-sm text-text-muted">{t('lede')}</p>
      </div>
      {isLoading && <p className="text-sm text-text-muted">{tc('loading')}</p>}
      {isError && <p className="text-sm text-danger">{tc('error.generic')}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((s) => <ServiceCard key={s.service} service={s.service} />)}
      </div>
    </div>
  );
}
