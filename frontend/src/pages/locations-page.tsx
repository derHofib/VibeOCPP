import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignUnknownCharger,
  createConnector,
  createLocation,
  createStation,
  deleteLocation,
  dismissUnknownCharger,
  listLocations,
  listUnknownChargers,
  type LocationRow,
  type StationRow,
} from '../api/locations.js';
import { ApiError } from '../lib/api-client.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.js';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/table.js';
import { StatusBadge } from '../components/ui/status-badge.js';
import { Button } from '../components/ui/button.js';
import { Dialog } from '../components/ui/dialog.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Select } from '../components/ui/select.js';

const CONNECTOR_TYPES = ['sType2', 'cType2', 'cCCS1', 'cCCS2', 'cChaoJi', 'cTesla', 'sTesla', 'sType3', 'wInductive'];

function CreateLocationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('locations');
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createLocation({
        name,
        address: address || undefined,
        city: city || undefined,
        postalCode: postalCode || undefined,
        country: country || undefined,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setName('');
      setAddress('');
      setCity('');
      setPostalCode('');
      setCountry('');
      setLatitude('');
      setLongitude('');
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title={t('location.form.title')}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div>
          <Label htmlFor="loc-name">{t('location.form.name')}</Label>
          <Input id="loc-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="loc-address">{t('location.form.address')}</Label>
          <Input id="loc-address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="loc-city">{t('location.form.city')}</Label>
            <Input id="loc-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="loc-postal">{t('location.form.postalCode')}</Label>
            <Input id="loc-postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="loc-country">{t('location.form.country')}</Label>
          <Input id="loc-country" value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="loc-lat">{t('location.form.latitude')}</Label>
            <Input
              id="loc-lat"
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="loc-lng">{t('location.form.longitude')}</Label>
            <Input
              id="loc-lng"
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
            />
          </div>
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('location.form.submitting') : t('location.form.submit')}
        </Button>
      </form>
    </Dialog>
  );
}

function CreateStationDialog({
  open,
  onClose,
  locationId,
}: {
  open: boolean;
  onClose: () => void;
  locationId: string;
}) {
  const { t } = useTranslation('locations');
  const queryClient = useQueryClient();
  const [chargeboxId, setChargeboxId] = useState('');
  const [label, setLabel] = useState('');
  const [vendor, setVendor] = useState('');
  const [model, setModel] = useState('');
  const [ocppVersion, setOcppVersion] = useState('2.0.1');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createStation(locationId, {
        chargeboxId,
        label,
        vendor: vendor || undefined,
        model: model || undefined,
        ocppVersion,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setChargeboxId('');
      setLabel('');
      setVendor('');
      setModel('');
      setError(null);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError && err.status === 409 ? t('errors.conflict') : t('errors.generic'));
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title={t('station.form.title')}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div>
          <Label htmlFor="st-chargebox">{t('station.form.chargeboxId')}</Label>
          <Input
            id="st-chargebox"
            required
            className="font-mono text-xs"
            value={chargeboxId}
            onChange={(e) => setChargeboxId(e.target.value)}
          />
          <p className="mt-1 text-xs text-text-muted">{t('station.form.chargeboxIdHint')}</p>
        </div>
        <div>
          <Label htmlFor="st-label">{t('station.form.label')}</Label>
          <Input id="st-label" required value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="st-vendor">{t('station.form.vendor')}</Label>
            <Input id="st-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="st-model">{t('station.form.model')}</Label>
            <Input id="st-model" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="st-ocpp">{t('station.form.ocppVersion')}</Label>
          <Select id="st-ocpp" value={ocppVersion} onChange={(e) => setOcppVersion(e.target.value)}>
            <option value="1.6">1.6</option>
            <option value="2.0.1">2.0.1</option>
            <option value="2.1">2.1</option>
          </Select>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('station.form.submitting') : t('station.form.submit')}
        </Button>
      </form>
    </Dialog>
  );
}

function CreateConnectorDialog({
  open,
  onClose,
  stationId,
}: {
  open: boolean;
  onClose: () => void;
  stationId: string;
}) {
  const { t } = useTranslation('locations');
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [evseId, setEvseId] = useState('1');
  const [connectorId, setConnectorId] = useState('1');
  const [type, setType] = useState(CONNECTOR_TYPES[0]);
  const [format, setFormat] = useState<'Socket' | 'Cable'>('Cable');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createConnector(stationId, {
        label,
        evseId: Number(evseId),
        connectorId: Number(connectorId),
        type,
        format,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setLabel('');
      setEvseId('1');
      setConnectorId('1');
      setError(null);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError && err.status === 409 ? t('errors.conflict') : t('errors.generic'));
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title={t('connector.form.title')}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div>
          <Label htmlFor="cn-label">{t('connector.form.label')}</Label>
          <Input id="cn-label" required value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cn-evse">{t('connector.form.evseId')}</Label>
            <Input
              id="cn-evse"
              type="number"
              min={1}
              required
              className="font-mono text-xs"
              value={evseId}
              onChange={(e) => setEvseId(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cn-connector">{t('connector.form.connectorId')}</Label>
            <Input
              id="cn-connector"
              type="number"
              min={1}
              className="font-mono text-xs"
              value={connectorId}
              onChange={(e) => setConnectorId(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="cn-type">{t('connector.form.type')}</Label>
          <Select id="cn-type" value={type} onChange={(e) => setType(e.target.value)}>
            {CONNECTOR_TYPES.map((ct) => (
              <option key={ct} value={ct}>
                {ct}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="cn-format">{t('connector.form.format')}</Label>
          <Select id="cn-format" value={format} onChange={(e) => setFormat(e.target.value as 'Socket' | 'Cable')}>
            <option value="Cable">{t('connector.form.formatCable')}</option>
            <option value="Socket">{t('connector.form.formatSocket')}</option>
          </Select>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('connector.form.submitting') : t('connector.form.submit')}
        </Button>
      </form>
    </Dialog>
  );
}

function StationBlock({ station, onAddConnector }: { station: StationRow; onAddConnector: () => void }) {
  const { t } = useTranslation('locations');
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-medium">{station.label}</span>{' '}
          <span className="font-mono text-xs text-text-muted">{station.chargeboxId}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={station.status === 'Linked' ? 'success' : 'neutral'}>
            {t(`status.${station.status}`)}
          </StatusBadge>
          <Button size="sm" variant="outline" onClick={onAddConnector}>
            {t('actions.newConnector')}
          </Button>
        </div>
      </div>
      {station.connectors.length === 0 ? (
        <p className="mt-2 text-xs text-text-muted">{t('noConnectors')}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {station.connectors.map((c) => (
            <li key={c.id} className="rounded border border-border px-2 py-1 text-xs">
              <span className="font-medium">{c.label}</span>{' '}
              <span className="font-mono text-text-muted">
                EVSE {c.evseId}/{c.connectorId} · {c.type} ·{' '}
                {c.format === 'Cable' ? t('connector.form.formatCable') : t('connector.form.formatSocket')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LocationCard({ location }: { location: LocationRow }) {
  const { t } = useTranslation('locations');
  const queryClient = useQueryClient();
  const [stationDialogOpen, setStationDialogOpen] = useState(false);
  const [connectorTarget, setConnectorTarget] = useState<string | null>(null);

  const removeMutation = useMutation({
    mutationFn: () => deleteLocation(location.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }),
  });

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{location.name}</h3>
          {location.address && (
            <p className="text-sm text-text-muted">
              {location.address}
              {location.city ? `, ${location.city}` : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setStationDialogOpen(true)}>
            {t('actions.newStation')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={location.stations.length > 0 || removeMutation.isPending}
            onClick={() => removeMutation.mutate()}
          >
            {t('actions.delete')}
          </Button>
        </div>
      </div>

      {location.stations.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">{t('noStations')}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {location.stations.map((station) => (
            <StationBlock key={station.id} station={station} onAddConnector={() => setConnectorTarget(station.id)} />
          ))}
        </div>
      )}

      <CreateStationDialog
        open={stationDialogOpen}
        onClose={() => setStationDialogOpen(false)}
        locationId={location.id}
      />
      <CreateConnectorDialog
        open={connectorTarget !== null}
        onClose={() => setConnectorTarget(null)}
        stationId={connectorTarget ?? ''}
      />
    </div>
  );
}

function AssignUnknownChargerDialog({
  open,
  onClose,
  unknownChargerId,
  stations,
}: {
  open: boolean;
  onClose: () => void;
  unknownChargerId: string | null;
  stations: { id: string; label: string; chargeboxId: string }[];
}) {
  const { t } = useTranslation('locations');
  const queryClient = useQueryClient();
  const [stationId, setStationId] = useState(stations[0]?.id ?? '');

  const mutation = useMutation({
    mutationFn: () => assignUnknownCharger(unknownChargerId as string, stationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['unknown-chargers'] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title={t('unknownCharger.assignDialog.title')}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div>
          <Label htmlFor="assign-station">{t('unknownCharger.assignDialog.chooseStation')}</Label>
          <Select id="assign-station" value={stationId} onChange={(e) => setStationId(e.target.value)}>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.chargeboxId})
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-text-muted">{t('unknownCharger.assignDialog.hint')}</p>
        </div>
        <Button type="submit" disabled={mutation.isPending || !stationId}>
          {t('unknownCharger.assignDialog.submit')}
        </Button>
      </form>
    </Dialog>
  );
}

function UnknownChargersTab() {
  const { t, i18n } = useTranslation('locations');
  const { t: tc } = useTranslation('common');
  const queryClient = useQueryClient();
  const [assignTarget, setAssignTarget] = useState<string | null>(null);

  const { data: unknownChargers, isLoading, isError } = useQuery({
    queryKey: ['unknown-chargers'],
    queryFn: listUnknownChargers,
  });
  const { data: locations } = useQuery({ queryKey: ['locations'], queryFn: listLocations });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => dismissUnknownCharger(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unknown-chargers'] }),
  });

  const allStations = (locations ?? []).flatMap((l) => l.stations.map((s) => ({ id: s.id, label: s.label, chargeboxId: s.chargeboxId })));

  return (
    <>
      {isLoading && <p className="text-sm text-text-muted">{tc('loading')}</p>}
      {isError && <p className="text-sm text-danger">{tc('error.generic')}</p>}
      {unknownChargers && unknownChargers.length === 0 && (
        <p className="text-sm text-text-muted">{t('unknownCharger.empty')}</p>
      )}
      {unknownChargers && unknownChargers.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t('unknownCharger.table.chargeboxId')}</TableHeaderCell>
              <TableHeaderCell>{t('unknownCharger.table.firstSeen')}</TableHeaderCell>
              <TableHeaderCell>{t('unknownCharger.table.lastSeen')}</TableHeaderCell>
              <TableHeaderCell>{t('unknownCharger.table.attempts')}</TableHeaderCell>
              <TableHeaderCell>{t('unknownCharger.table.actions')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {unknownChargers.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs">
                  <StatusBadge tone="warning">{u.chargeboxId}</StatusBadge>
                </TableCell>
                <TableCell>{new Date(u.firstSeenAt).toLocaleString(i18n.language)}</TableCell>
                <TableCell>{new Date(u.lastSeenAt).toLocaleString(i18n.language)}</TableCell>
                <TableCell>{u.attemptCount}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setAssignTarget(u.id)} disabled={allStations.length === 0}>
                      {t('actions.assign')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={dismissMutation.isPending}
                      onClick={() => dismissMutation.mutate(u.id)}
                    >
                      {t('actions.dismiss')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <AssignUnknownChargerDialog
        open={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        unknownChargerId={assignTarget}
        stations={allStations}
      />
    </>
  );
}

export function LocationsPage() {
  const { t } = useTranslation('locations');
  const { t: tc } = useTranslation('common');
  const [tab, setTab] = useState<'locations' | 'unknownChargers'>('locations');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({ queryKey: ['locations'], queryFn: listLocations });
  const { data: unknownChargers } = useQuery({ queryKey: ['unknown-chargers'], queryFn: listUnknownChargers });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('lede')}</CardDescription>
        </div>
        {tab === 'locations' && <Button onClick={() => setDialogOpen(true)}>{t('actions.newLocation')}</Button>}
      </CardHeader>
      <CardContent>
        <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-border pb-px">
          {(['locations', 'unknownChargers'] as const).map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={key === tab}
              onClick={() => setTab(key)}
              className={
                key === tab
                  ? 'rounded-t-md border border-b-0 border-border bg-surface-raised px-3 py-1.5 text-sm font-medium text-text'
                  : 'rounded-t-md px-3 py-1.5 text-sm text-text-muted hover:text-text'
              }
            >
              {t(`tabs.${key}`)}
              {key === 'unknownChargers' && unknownChargers && unknownChargers.length > 0 && (
                <span className="ml-1.5 rounded-full bg-warning-bg px-1.5 text-xs text-warning">
                  {unknownChargers.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'locations' && (
          <>
            {isLoading && <p className="text-sm text-text-muted">{tc('loading')}</p>}
            {isError && <p className="text-sm text-danger">{tc('error.generic')}</p>}
            {data && data.length === 0 && <p className="text-sm text-text-muted">{t('empty')}</p>}
            {data && data.length > 0 && (
              <div className="flex flex-col gap-4">
                {data.map((location) => (
                  <LocationCard key={location.id} location={location} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'unknownChargers' && <UnknownChargersTab />}
      </CardContent>
      <CreateLocationDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Card>
  );
}
