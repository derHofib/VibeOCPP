import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fetchMessagesCsv, listMessages, type MessageOrigin } from '../api/monitor.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.js';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/table.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Select } from '../components/ui/select.js';

export function MonitorPage() {
  const { t, i18n } = useTranslation('monitor');
  const { t: tc } = useTranslation('common');
  const [station, setStation] = useState('');
  const [action, setAction] = useState('');
  const [origin, setOrigin] = useState<MessageOrigin | ''>('');
  const [filter, setFilter] = useState({ ocppConnectionName: '', action: '', origin: undefined as MessageOrigin | undefined });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['monitor', 'messages', filter],
    queryFn: () => listMessages({ ...filter, limit: 200 }),
    refetchInterval: 5000,
  });

  async function handleExport() {
    const blob = await fetchMessagesCsv({ ...filter, limit: 1000 });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ocpp-messages.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('lede')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter({ ocppConnectionName: station, action, origin: origin || undefined });
          }}
        >
          <div>
            <Label htmlFor="filter-station">{t('filters.station')}</Label>
            <Input id="filter-station" value={station} onChange={(e) => setStation(e.target.value)} className="w-48" />
          </div>
          <div>
            <Label htmlFor="filter-action">{t('filters.action')}</Label>
            <Input id="filter-action" value={action} onChange={(e) => setAction(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label htmlFor="filter-origin">{t('filters.origin')}</Label>
            <Select
              id="filter-origin"
              value={origin}
              onChange={(e) => setOrigin(e.target.value as MessageOrigin | '')}
              className="w-56"
            >
              <option value="">{t('origin.all')}</option>
              <option value="ChargingStation">{t('origin.ChargingStation')}</option>
              <option value="ChargingStationManagementSystem">{t('origin.ChargingStationManagementSystem')}</option>
            </Select>
          </div>
          <Button type="submit" variant="outline">
            {t('filters.apply')}
          </Button>
          <Button type="button" variant="ghost" onClick={handleExport}>
            {t('filters.export')}
          </Button>
        </form>

        {isLoading && <p className="text-sm text-text-muted">{tc('loading')}</p>}
        {isError && <p className="text-sm text-danger">{tc('error.generic')}</p>}
        {data && data.length === 0 && <p className="text-sm text-text-muted">{t('empty')}</p>}
        {data && data.length > 0 && (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('table.receivedAt')}</TableHeaderCell>
                <TableHeaderCell>{t('table.station')}</TableHeaderCell>
                <TableHeaderCell>{t('table.event')}</TableHeaderCell>
                <TableHeaderCell>{t('table.origin')}</TableHeaderCell>
                <TableHeaderCell>{t('table.action')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{new Date(m.receivedAt).toLocaleString(i18n.language)}</TableCell>
                  <TableCell className="font-mono text-xs">{m.ocppConnectionName}</TableCell>
                  <TableCell>{m.event}</TableCell>
                  <TableCell>{m.origin ? t(`origin.${m.origin}`) : '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{m.info?.action ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
