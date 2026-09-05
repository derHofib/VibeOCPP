import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { groupByCategory, listSettings, upsertSetting, type SettingRow, type SettingType } from '../api/settings.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.js';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/table.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Select } from '../components/ui/select.js';
import { Dialog } from '../components/ui/dialog.js';

const TYPES: SettingType[] = ['string', 'number', 'boolean', 'json', 'secret'];

function EditSettingDialog({
  setting,
  onClose,
}: {
  setting: { category: string; key: string; type: SettingType; value: string } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('settings');
  const queryClient = useQueryClient();
  const [value, setValue] = useState(setting?.value ?? '');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => upsertSetting(setting!.category, setting!.key, setting!.type, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      onClose();
    },
    onError: () => setError(t('errors.generic')),
  });

  if (!setting) return null;

  return (
    <Dialog open={!!setting} onClose={onClose} title={`${setting.category} / ${setting.key}`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
      >
        <div>
          <Label htmlFor="setting-value">{t('add.value')}</Label>
          <Input
            id="setting-value"
            type={setting.type === 'secret' ? 'password' : 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('add.submitting') : t('add.submit')}
        </Button>
      </form>
    </Dialog>
  );
}

function AddSettingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('settings');
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('');
  const [key, setKey] = useState('');
  const [type, setType] = useState<SettingType>('string');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => upsertSetting(category, key, type, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setCategory('');
      setKey('');
      setValue('');
      onClose();
    },
    onError: () => setError(t('errors.generic')),
  });

  return (
    <Dialog open={open} onClose={onClose} title={t('add.title')}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
      >
        <div>
          <Label htmlFor="add-category">{t('add.category')}</Label>
          <Input id="add-category" required value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="add-key">{t('add.key')}</Label>
          <Input id="add-key" required value={key} onChange={(e) => setKey(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="add-type">{t('add.type')}</Label>
          <Select id="add-type" value={type} onChange={(e) => setType(e.target.value as SettingType)}>
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`types.${ty}`)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="add-value">{t('add.value')}</Label>
          <Input
            id="add-value"
            type={type === 'secret' ? 'password' : 'text'}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('add.submitting') : t('add.submit')}
        </Button>
      </form>
    </Dialog>
  );
}

export function SettingsPage() {
  const { t, i18n } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<SettingRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({ queryKey: ['settings'], queryFn: listSettings });

  const groups = useMemo(() => groupByCategory(data ?? []), [data]);
  const categories = useMemo(() => [...groups.keys()], [groups]);
  const currentCategory = activeCategory && groups.has(activeCategory) ? activeCategory : (categories[0] ?? null);
  const rows = currentCategory ? (groups.get(currentCategory) ?? []) : [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('lede')}</CardDescription>
        </div>
        <Button onClick={() => setAddOpen(true)}>+ {t('add.title')}</Button>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-text-muted">{tc('loading')}</p>}
        {isError && <p className="text-sm text-danger">{tc('error.generic')}</p>}
        {data && categories.length === 0 && <p className="text-sm text-text-muted">{t('noCategories')}</p>}

        {categories.length > 0 && (
          <>
            <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-border pb-px">
              {categories.map((category) => (
                <button
                  key={category}
                  role="tab"
                  aria-selected={category === currentCategory}
                  onClick={() => setActiveCategory(category)}
                  className={
                    category === currentCategory
                      ? 'rounded-t-md border border-b-0 border-border bg-surface-raised px-3 py-1.5 text-sm font-medium text-text'
                      : 'rounded-t-md px-3 py-1.5 text-sm text-text-muted hover:text-text'
                  }
                >
                  {category}
                </button>
              ))}
            </div>

            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>{t('table.key')}</TableHeaderCell>
                  <TableHeaderCell>{t('table.type')}</TableHeaderCell>
                  <TableHeaderCell>{t('table.value')}</TableHeaderCell>
                  <TableHeaderCell>{t('table.version')}</TableHeaderCell>
                  <TableHeaderCell>{t('table.updatedAt')}</TableHeaderCell>
                  <TableHeaderCell>{t('table.actions')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.key}</TableCell>
                    <TableCell className="font-mono text-xs">{t(`types.${row.type}`)}</TableCell>
                    <TableCell className="font-mono text-xs" title={row.type === 'secret' ? t('secretMasked') : undefined}>
                      {row.value || '—'}
                    </TableCell>
                    <TableCell>{row.version}</TableCell>
                    <TableCell>{new Date(row.updatedAt).toLocaleString(i18n.language)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                        {t('edit')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
      <AddSettingDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <EditSettingDialog setting={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}
