import { useTranslation } from 'react-i18next';
import {
  STATIONS_LIST_SUBSCRIPTION,
  connectorStatusCounts,
  type ConnectorStatus,
  type StationsListResult,
} from '../api/stations.js';
import { useGraphqlSubscription } from '../lib/use-graphql-subscription.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.js';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/table.js';
import { StatusBadge, type StatusTone } from '../components/ui/status-badge.js';

const CONNECTOR_TONE: Record<ConnectorStatus, StatusTone> = {
  Available: 'success',
  Occupied: 'info',
  Reserved: 'warning',
  Unavailable: 'neutral',
  Faulted: 'danger',
  Preparing: 'info',
  Charging: 'info',
  SuspendedEVSE: 'info',
  SuspendedEV: 'info',
  Finishing: 'info',
};

export function StationsPage() {
  const { t } = useTranslation('stations');
  const { t: tc } = useTranslation('common');
  const { data, error, status } = useGraphqlSubscription<StationsListResult>(STATIONS_LIST_SUBSCRIPTION);
  const stations = data?.ChargingStations ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('lede')}</CardDescription>
        </div>
        <StatusBadge tone={status === 'connected' ? 'success' : status === 'connecting' ? 'neutral' : 'danger'}>
          {t(`connection.${status}`)}
        </StatusBadge>
      </CardHeader>
      <CardContent>
        {status !== 'disconnected' && !data && <p className="text-sm text-text-muted">{tc('loading')}</p>}
        {error !== null && status === 'disconnected' && (
          <p className="text-sm text-danger">{tc('error.generic')}</p>
        )}
        {data && stations.length === 0 && <p className="text-sm text-text-muted">{t('empty')}</p>}
        {stations.length > 0 && (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('table.station')}</TableHeaderCell>
                <TableHeaderCell>{t('table.location')}</TableHeaderCell>
                <TableHeaderCell>{t('table.status')}</TableHeaderCell>
                <TableHeaderCell>{t('table.connectors')}</TableHeaderCell>
                <TableHeaderCell>{t('table.vendorModel')}</TableHeaderCell>
                <TableHeaderCell>{t('table.firmware')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stations.map((station) => {
                const counts = connectorStatusCounts(station);
                return (
                  <TableRow key={station.id}>
                    <TableCell className="font-mono text-xs">{station.ocppConnectionName}</TableCell>
                    <TableCell>{station.Location?.name ?? t('noLocation')}</TableCell>
                    <TableCell>
                      <StatusBadge tone={station.isOnline ? 'success' : 'neutral'}>
                        {station.isOnline ? t('status.online') : t('status.offline')}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {[...counts.entries()].map(([connectorStatus, count]) => (
                          <StatusBadge key={connectorStatus} tone={CONNECTOR_TONE[connectorStatus]}>
                            {count}× {t(`connectorStatus.${connectorStatus}`)}
                          </StatusBadge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {[station.chargePointVendor, station.chargePointModel].filter(Boolean).join(' · ') || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{station.firmwareVersion ?? '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
