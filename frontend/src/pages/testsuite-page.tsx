import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getRun,
  listRuns,
  startRun,
  type TestSuiteRunStatus,
  type TestSuiteStepStatus,
} from '../api/testsuite.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.js';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/table.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { StatusBadge, type StatusTone } from '../components/ui/status-badge.js';

const RUN_TONE: Record<TestSuiteRunStatus, StatusTone> = {
  running: 'info',
  completed: 'success',
  aborted: 'danger',
};

const STEP_TONE: Record<TestSuiteStepStatus, StatusTone> = {
  pending: 'neutral',
  running: 'info',
  pass: 'success',
  fail: 'danger',
  timeout: 'warning',
  skipped: 'neutral',
};

function StartRunForm({ onStarted }: { onStarted: (runId: string) => void }) {
  const { t } = useTranslation('testsuite');
  const queryClient = useQueryClient();
  const [ocppConnectionName, setOcppConnectionName] = useState('');
  const [ocppVersion, setOcppVersion] = useState('2');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [firmwareVersion, setFirmwareVersion] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      startRun({
        ocppConnectionName,
        ocppVersion,
        manufacturer: manufacturer || undefined,
        model: model || undefined,
        firmwareVersion: firmwareVersion || undefined,
      }),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ['testsuite', 'runs'] });
      onStarted(run.id);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('start.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div>
            <Label htmlFor="run-station">{t('start.station')}</Label>
            <Input
              id="run-station"
              required
              value={ocppConnectionName}
              onChange={(e) => setOcppConnectionName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="run-version">{t('start.ocppVersion')}</Label>
            <Input id="run-version" required value={ocppVersion} onChange={(e) => setOcppVersion(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="run-manufacturer">{t('start.manufacturer')}</Label>
            <Input id="run-manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="run-model">{t('start.model')}</Label>
            <Input id="run-model" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="run-firmware">{t('start.firmwareVersion')}</Label>
            <Input id="run-firmware" value={firmwareVersion} onChange={(e) => setFirmwareVersion(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? t('start.submitting') : t('start.submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RunDetail({ runId, onBack }: { runId: string; onBack: () => void }) {
  const { t, i18n } = useTranslation('testsuite');
  const { data } = useQuery({
    queryKey: ['testsuite', 'run', runId],
    queryFn: () => getRun(runId),
    // Runs execute in the background on the server — poll while it's still
    // running so the step list updates live without a manual refresh.
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 2000 : false),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="font-mono text-base">{data?.ocppConnectionName}</CardTitle>
          <CardDescription>
            {data && new Date(data.startedAt).toLocaleString(i18n.language)}
            {data?.manufacturer && ` · ${data.manufacturer} ${data.model ?? ''}`}
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          {data && <StatusBadge tone={RUN_TONE[data.status]}>{t(`status.${data.status}`)}</StatusBadge>}
          <Button size="sm" variant="outline" onClick={onBack}>
            {t('detail.back')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>#</TableHeaderCell>
              <TableHeaderCell>Action</TableHeaderCell>
              <TableHeaderCell>{t('table.status')}</TableHeaderCell>
              <TableHeaderCell>{t('detail.rawRequest')}</TableHeaderCell>
              <TableHeaderCell>{t('detail.rawResponse')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.steps.map((step) => (
              <TableRow key={step.id}>
                <TableCell className="font-mono text-xs">{step.sequenceIndex + 1}</TableCell>
                <TableCell className="font-mono text-xs">{step.action}</TableCell>
                <TableCell>
                  <StatusBadge tone={STEP_TONE[step.status]}>{t(`stepStatus.${step.status}`)}</StatusBadge>
                  {step.errorMessage && <p className="mt-1 text-xs text-danger">{step.errorMessage}</p>}
                </TableCell>
                <TableCell className="max-w-xs truncate font-mono text-xs" title={JSON.stringify(step.requestPayload)}>
                  {step.requestPayload ? JSON.stringify(step.requestPayload) : t('detail.noError')}
                </TableCell>
                <TableCell className="max-w-xs truncate font-mono text-xs" title={JSON.stringify(step.responsePayload)}>
                  {step.responsePayload ? JSON.stringify(step.responsePayload) : t('detail.noError')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function TestSuitePage() {
  const { t, i18n } = useTranslation('testsuite');
  const { t: tc } = useTranslation('common');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['testsuite', 'runs'],
    queryFn: listRuns,
    refetchInterval: 5000,
  });

  if (selectedRunId) {
    return <RunDetail runId={selectedRunId} onBack={() => setSelectedRunId(null)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <StartRunForm onStarted={setSelectedRunId} />
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('lede')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-text-muted">{tc('loading')}</p>}
          {isError && <p className="text-sm text-danger">{tc('error.generic')}</p>}
          {data && data.length === 0 && <p className="text-sm text-text-muted">{t('empty')}</p>}
          {data && data.length > 0 && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t('table.station')}</TableHeaderCell>
                  <TableHeaderCell>{t('table.started')}</TableHeaderCell>
                  <TableHeaderCell>{t('table.status')}</TableHeaderCell>
                  <TableHeaderCell></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-mono text-xs">{run.ocppConnectionName}</TableCell>
                    <TableCell>{new Date(run.startedAt).toLocaleString(i18n.language)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={RUN_TONE[run.status]}>{t(`status.${run.status}`)}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelectedRunId(run.id)}>
                        →
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
