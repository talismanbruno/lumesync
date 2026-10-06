import { t as uiText } from '../../../i18n';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../api/client';
import type { StorageStats, CleanupResult } from '@backspace/shared';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useUIStore } from '../../../stores/uiStore';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 ? value.toFixed(2) : value < 100 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

type UploadUnit = 'MB' | 'GB';

// Render a number with up to 3 decimals, trimming trailing zeros. 1.5 → "1.5", 5 → "5", 0.098 → "0.098".
function formatUnitValue(n: number): string {
  return Number(n.toFixed(3)).toString();
}

function parseDisplayMb(input: string, unit: UploadUnit): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  const mb = unit === 'GB' ? Math.round(n * 1024) : Math.round(n);
  return Number.isInteger(mb) && mb >= 1 ? mb : null;
}

export function StoragePanel() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const addToast = useUIStore((s) => s.addToast);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [previewDone, setPreviewDone] = useState(false);

  // Upload limit state
  const instanceSettings = useSettingsStore((s) => s.instanceSettings);
  const updateInstanceSettings = useSettingsStore((s) => s.updateInstanceSettings);
  const [uploadUnit, setUploadUnit] = useState<UploadUnit>('MB');
  const [uploadLimitInput, setUploadLimitInput] = useState<string>('100');
  const [uploadLimitSaving, setUploadLimitSaving] = useState(false);
  const [userQuotaGbInput, setUserQuotaGbInput] = useState('1');
  const [dailyQuotaMbInput, setDailyQuotaMbInput] = useState('500');
  const [diskReserveGbInput, setDiskReserveGbInput] = useState('5');
  const [guardrailsSaving, setGuardrailsSaving] = useState(false);

  // Media retention state
  const [mediaAgeDays, setMediaAgeDays] = useState(90);
  const [mediaCleanupResult, setMediaCleanupResult] = useState<CleanupResult | null>(null);
  const [mediaCleaning, setMediaCleaning] = useState(false);
  const [mediaPreviewDone, setMediaPreviewDone] = useState(false);

  // Stale tus session cleanup state
  const [tusMaxAgeHours, setTusMaxAgeHours] = useState(1);
  const [tusCleanupResult, setTusCleanupResult] = useState<CleanupResult | null>(null);
  const [tusCleaning, setTusCleaning] = useState(false);
  const [tusPreviewDone, setTusPreviewDone] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.admin.storageStats();
      setStats(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : uiText("Failed to load storage stats"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const mb = instanceSettings?.maxUploadSizeMb;
    if (typeof mb === 'number' && mb > 0) {
      const unit: UploadUnit = mb >= 1024 ? 'GB' : 'MB';
      setUploadUnit(unit);
      setUploadLimitInput(unit === 'GB' ? formatUnitValue(mb / 1024) : String(mb));
    }
    if (instanceSettings) {
      setUserQuotaGbInput(formatUnitValue(instanceSettings.maxUserStorageMb / 1024));
      setDailyQuotaMbInput(String(instanceSettings.maxDailyUploadMb));
      setDiskReserveGbInput(formatUnitValue(instanceSettings.minFreeDiskMb / 1024));
    }
  }, [instanceSettings]);

  const parsedUploadMb = parseDisplayMb(uploadLimitInput, uploadUnit);
  const uploadLimitDirty = parsedUploadMb !== null && parsedUploadMb !== instanceSettings?.maxUploadSizeMb;
  const parsedUserQuotaMb = parseDisplayMb(userQuotaGbInput, 'GB');
  const parsedDailyQuotaMb = parseDisplayMb(dailyQuotaMbInput, 'MB');
  const parsedDiskReserveMb = parseDisplayMb(diskReserveGbInput, 'GB');
  const guardrailsDirty = !!instanceSettings
    && parsedUserQuotaMb !== null
    && parsedDailyQuotaMb !== null
    && parsedDiskReserveMb !== null
    && (parsedUserQuotaMb !== instanceSettings.maxUserStorageMb
      || parsedDailyQuotaMb !== instanceSettings.maxDailyUploadMb
      || parsedDiskReserveMb !== instanceSettings.minFreeDiskMb);

  const handleUploadUnitChange = (next: UploadUnit) => {
    if (next === uploadUnit) return;
    const n = Number(uploadLimitInput.trim());
    if (Number.isFinite(n) && n > 0) {
      setUploadLimitInput(next === 'GB' ? formatUnitValue(n / 1024) : String(Math.round(n * 1024)));
    }
    setUploadUnit(next);
  };

  const handleUploadLimitSave = async () => {
    if (parsedUploadMb === null) return;
    const mb = parsedUploadMb;
    setUploadLimitSaving(true);
    try {
      await updateInstanceSettings({ maxUploadSizeMb: mb });
      const display = mb >= 1024 ? `${formatUnitValue(mb / 1024)} GB` : `${mb} MB`;
      addToast(uiText("Upload limit set to {0}", [display]), 'success');
    } catch {
      addToast(uiText("Failed to update upload limit"), 'warning');
    } finally {
      setUploadLimitSaving(false);
    }
  };

  const handleGuardrailsSave = async () => {
    if (parsedUserQuotaMb === null || parsedDailyQuotaMb === null || parsedDiskReserveMb === null) return;
    setGuardrailsSaving(true);
    try {
      await updateInstanceSettings({
        maxUserStorageMb: parsedUserQuotaMb,
        maxDailyUploadMb: parsedDailyQuotaMb,
        minFreeDiskMb: parsedDiskReserveMb,
      });
      addToast(uiText("Limites de capacidade atualizados"), 'success');
    } catch {
      addToast(uiText("Não foi possível atualizar os limites de capacidade"), 'warning');
    } finally {
      setGuardrailsSaving(false);
    }
  };

  const handleMediaCleanup = async (dryRun: boolean) => {
    setMediaCleaning(true);
    setMediaCleanupResult(null);
    try {
      const result = await api.admin.cleanupOldMedia(mediaAgeDays, dryRun);
      setMediaCleanupResult(result);
      if (dryRun) {
        setMediaPreviewDone(true);
      } else {
        setMediaPreviewDone(false);
        addToast(uiText("Deleted {0} file{1} ({2})", [result.deletedFiles, result.deletedFiles !== 1 ? 's' : '', formatBytes(result.freedBytes)]), 'success');
        await fetchStats();
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : uiText("Media cleanup failed"), 'warning');
    } finally {
      setMediaCleaning(false);
    }
  };

  const handleTusCleanup = async (dryRun: boolean) => {
    if (!Number.isFinite(tusMaxAgeHours) || tusMaxAgeHours <= 0) return;
    setTusCleaning(true);
    setTusCleanupResult(null);
    try {
      const result = await api.admin.cleanupTusSessions(tusMaxAgeHours, dryRun);
      setTusCleanupResult(result);
      if (dryRun) {
        setTusPreviewDone(true);
      } else {
        setTusPreviewDone(false);
        addToast(uiText("Cleaned {0} stale upload session{1} ({2})", [result.deletedFiles, result.deletedFiles !== 1 ? 's' : '', formatBytes(result.freedBytes)]), 'success');
        await fetchStats();
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : uiText("Stale upload cleanup failed"), 'warning');
    } finally {
      setTusCleaning(false);
    }
  };

  const handleCleanup = async (dryRun: boolean) => {
    setCleaning(true);
    setCleanupResult(null);
    try {
      const result = await api.admin.storageCleanup(dryRun);
      setCleanupResult(result);
      if (dryRun) {
        setPreviewDone(true);
      } else {
        setPreviewDone(false);
        addToast(uiText("Cleaned up {0} file{1} ({2})", [result.deletedFiles, result.deletedFiles !== 1 ? 's' : '', formatBytes(result.freedBytes)]), 'success');
        await fetchStats();
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : uiText("Cleanup failed"), 'warning');
    } finally {
      setCleaning(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-txt-tertiary">{uiText("Loading storage stats...")}</div>;
  }

  if (loadError && !stats) {
    return (
      <div className="space-y-3">
        <div className="p-2 bg-accent-rose/10 border border-accent-rose/30 rounded text-txt-danger text-sm">{loadError}</div>
        <button onClick={fetchStats} className="text-sm text-accent-primary hover:underline">{uiText("Retry")}</button>
      </div>
    );
  }

  if (!stats) return null;

  const hasOrphans = stats.orphanedFiles > 0 || stats.unlinkedAttachments > 0 || stats.danglingAttachments > 0;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-txt-primary">{uiText("Storage")}</h2>
      <div className="text-xs text-txt-tertiary">
        {uiText("Monitor disk usage and clean up orphaned files left behind by deleted content or replaced avatars/banners.")}</div>

      {/* Storage Overview */}
      <div>
        <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">{uiText("Storage Overview")}</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/[0.02] p-3.5">
            <div className="text-xs text-txt-tertiary mb-0.5">{uiText("Total Files")}</div>
            <div className="text-lg font-semibold text-txt-primary">{stats.totalFiles}</div>
            <div className="text-xs text-txt-tertiary">{formatBytes(stats.totalSize)}</div>
          </div>
          <div className="rounded-lg bg-white/[0.02] p-3.5">
            <div className="text-xs text-txt-tertiary mb-0.5">{uiText("Referenced")}</div>
            <div className="text-lg font-semibold text-txt-primary">{stats.referencedFiles}</div>
            <div className="text-xs text-txt-tertiary">{formatBytes(stats.referencedSize)}</div>
          </div>
          <div className="rounded-lg bg-white/[0.02] p-3.5">
            <div className="text-xs text-txt-tertiary mb-0.5">{uiText("Orphaned Files")}</div>
            <div className={`text-lg font-semibold ${stats.orphanedFiles > 0 ? 'text-accent-amber' : 'text-txt-primary'}`}>
              {stats.orphanedFiles}
            </div>
            <div className="text-xs text-txt-tertiary">{formatBytes(stats.orphanedSize)}</div>
          </div>
          <div className="rounded-lg bg-white/[0.02] p-3.5">
            <div className="text-xs text-txt-tertiary mb-0.5">{uiText("Unlinked Uploads")}</div>
            <div className={`text-lg font-semibold ${stats.unlinkedAttachments > 0 ? 'text-accent-amber' : 'text-txt-primary'}`}>
              {stats.unlinkedAttachments}
            </div>
            <div className="text-xs text-txt-tertiary">{formatBytes(stats.unlinkedSize)}</div>
          </div>
          <div className="rounded-lg bg-white/[0.02] p-3.5">
            <div className="text-xs text-txt-tertiary mb-0.5">{uiText("Dangling Records")}</div>
            <div className={`text-lg font-semibold ${stats.danglingAttachments > 0 ? 'text-accent-amber' : 'text-txt-primary'}`}>
              {stats.danglingAttachments}
            </div>
            <div className="text-xs text-txt-tertiary">{formatBytes(stats.danglingSize)}</div>
          </div>
          <div className="rounded-lg bg-white/[0.02] p-3.5">
            <div className="text-xs text-txt-tertiary mb-0.5">{uiText("Stale Uploads")}</div>
            <div className={`text-lg font-semibold ${stats.staleTusSessions > 0 ? 'text-accent-amber' : 'text-txt-primary'}`}>
              {stats.staleTusSessions}
            </div>
            <div className="text-xs text-txt-tertiary">{formatBytes(stats.staleTusSize)}</div>
          </div>
        </div>
      </div>

      {/* File Type Breakdown */}
      {stats.breakdown.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">{uiText("File Type Breakdown")}</div>
          <div className="rounded-lg bg-white/[0.02] p-3.5">
            <div className="space-y-1.5">
              {stats.breakdown.map((b) => (
                <div key={b.type} className="flex items-center justify-between text-sm">
                  <span className="text-txt-secondary capitalize">{b.type}</span>
                  <span className="text-txt-tertiary">
                    {b.count} {uiText(" file")}{b.count !== 1 ? uiText("s") : ''} — {formatBytes(b.size)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upload Limit */}
      <div>
        <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">{uiText("Upload Limit")}</div>
        <div className="rounded-lg bg-white/[0.02] p-3.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className="text-sm text-txt-secondary whitespace-nowrap">{uiText("Max file size")}</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={uploadUnit === 'GB' ? 0.001 : 1}
                step={uploadUnit === 'GB' ? 0.5 : 1}
                value={uploadLimitInput}
                onChange={(e) => setUploadLimitInput(e.target.value)}
                className="input-standard w-24 px-2 py-1 text-sm text-center"
              />
              <div className="flex items-center gap-0.5 rounded-lg bg-surface-input p-0.5">
                {(['MB', 'GB'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleUploadUnitChange(u)}
                    className={`px-2.5 py-1 rounded text-[12px] font-medium transition-colors ${
                      uploadUnit === u
                        ? 'bg-accent-primary text-white'
                        : 'text-txt-tertiary hover:text-txt-primary'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleUploadLimitSave}
              disabled={!uploadLimitDirty || uploadLimitSaving || parsedUploadMb === null}
              className="px-3 py-1 bg-accent-primary hover:bg-accent-primary/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ml-auto"
            >
              {uploadLimitSaving ? uiText("Saving...") : uiText("Save")}
            </button>
          </div>
        </div>
      </div>

      {/* Capacity Guardrails */}
      <div>
        <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">{uiText("Proteção de capacidade")}</div>
        <div className="rounded-lg bg-white/[0.02] p-3.5 space-y-3">
          <p className="text-xs text-txt-tertiary">{uiText("Impede que uma conta ou vários uploads simultâneos consumam todo o disco do servidor.")}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-xs text-txt-secondary">
              <span>{uiText("Por usuário (GB)")}</span>
              <input type="number" min="0.001" step="0.5" value={userQuotaGbInput} onChange={(event) => setUserQuotaGbInput(event.target.value)} className="input-standard w-full px-2 py-1.5 text-sm" />
            </label>
            <label className="space-y-1 text-xs text-txt-secondary">
              <span>{uiText("Por 24 horas (MB)")}</span>
              <input type="number" min="1" step="1" value={dailyQuotaMbInput} onChange={(event) => setDailyQuotaMbInput(event.target.value)} className="input-standard w-full px-2 py-1.5 text-sm" />
            </label>
            <label className="space-y-1 text-xs text-txt-secondary">
              <span>{uiText("Espaço livre mínimo (GB)")}</span>
              <input type="number" min="0.001" step="0.5" value={diskReserveGbInput} onChange={(event) => setDiskReserveGbInput(event.target.value)} className="input-standard w-full px-2 py-1.5 text-sm" />
            </label>
          </div>
          <div className="flex justify-end">
            <button onClick={handleGuardrailsSave} disabled={!guardrailsDirty || guardrailsSaving} className="px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              {guardrailsSaving ? uiText("Salvando…") : uiText("Salvar proteções")}
            </button>
          </div>
        </div>
      </div>

      {/* Cleanup Actions */}
      <div>
        <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">{uiText("Cleanup")}</div>
        <div className="rounded-lg bg-white/[0.02] p-3.5 space-y-3">
          {!hasOrphans && (
            <div className="text-sm text-txt-tertiary">{uiText("No orphaned files, stale uploads, or dangling records found.")}</div>
          )}

          {hasOrphans && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCleanup(true)}
                disabled={cleaning}
                className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-txt-secondary text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {cleaning ? uiText("Scanning...") : uiText("Preview Cleanup")}
              </button>
              <button
                onClick={() => handleCleanup(false)}
                disabled={cleaning || !previewDone}
                className="px-3 py-1.5 bg-accent-rose hover:bg-accent-rose/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {cleaning ? uiText("Cleaning...") : uiText("Clean Up Now")}
              </button>
            </div>
          )}

          {cleanupResult && (
            <div className={`p-2 rounded text-sm ${
              cleanupResult.dryRun
                ? 'bg-accent-amber/10 border border-accent-amber/30 text-accent-amber'
                : 'bg-status-online/10 border border-status-online/30 text-status-online'
            }`}>
              <div className="font-medium mb-1">
                {cleanupResult.dryRun ? uiText("Preview — no files deleted") : uiText("Cleanup complete")}
              </div>
              <div>
                {cleanupResult.deletedFiles} {uiText(" orphaned/dangling file")}{cleanupResult.deletedFiles !== 1 ? uiText("s") : ''} ({formatBytes(cleanupResult.freedBytes)})
                {cleanupResult.deletedAttachmentRecords > 0 && (
                  <>, {cleanupResult.deletedAttachmentRecords} {uiText(" stale upload record")}{cleanupResult.deletedAttachmentRecords !== 1 ? uiText("s") : ''}</>
                )}
              </div>
              {cleanupResult.errors.length > 0 && (
                <div className="mt-1 text-txt-danger">
                  {cleanupResult.errors.length} {uiText(" error")}{cleanupResult.errors.length !== 1 ? uiText("s") : ''}: {cleanupResult.errors[0]}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stale Uploads */}
      <div>
        <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">{uiText("Stale Uploads")}</div>
        <div className="rounded-lg bg-white/[0.02] p-3.5 space-y-3">
          <div className="text-xs text-txt-tertiary">
            {uiText("Abandoned tus upload sessions in ")}<code className="text-txt-secondary">{uiText(".tus/")}</code> {uiText(" (paused/crashed without DELETE). Auto-expire runs every 24 hours; this lets you sweep proactively.")}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className="text-sm text-txt-secondary whitespace-nowrap">{uiText("Max age (hours)")}</label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={tusMaxAgeHours}
              onChange={(e) => {
                const next = Number(e.target.value);
                setTusMaxAgeHours(Number.isFinite(next) && next > 0 ? next : 0);
                setTusPreviewDone(false);
                setTusCleanupResult(null);
              }}
              className="input-standard w-24 px-2 py-1 text-sm text-center"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleTusCleanup(true)}
              disabled={tusCleaning || tusMaxAgeHours <= 0}
              className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-txt-secondary text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {tusCleaning ? uiText("Scanning...") : uiText("Preview Cleanup")}
            </button>
            <button
              onClick={() => handleTusCleanup(false)}
              disabled={tusCleaning || !tusPreviewDone}
              className="px-3 py-1.5 bg-accent-rose hover:bg-accent-rose/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {tusCleaning ? uiText("Cleaning...") : uiText("Clean Up Now")}
            </button>
          </div>

          {tusCleanupResult && (
            <div className={`p-2 rounded text-sm ${
              tusCleanupResult.dryRun
                ? 'bg-accent-amber/10 border border-accent-amber/30 text-accent-amber'
                : 'bg-status-online/10 border border-status-online/30 text-status-online'
            }`}>
              <div className="font-medium mb-1">
                {tusCleanupResult.dryRun ? uiText("Preview — no files deleted") : uiText("Cleanup complete")}
              </div>
              <div>
                {tusCleanupResult.deletedFiles} {uiText(" session file")}{tusCleanupResult.deletedFiles !== 1 ? uiText("s") : ''} ({formatBytes(tusCleanupResult.freedBytes)})
              </div>
              {tusCleanupResult.errors.length > 0 && (
                <div className="mt-1 text-txt-danger">
                  {tusCleanupResult.errors.length} {uiText(" error")}{tusCleanupResult.errors.length !== 1 ? uiText("s") : ''}: {tusCleanupResult.errors[0]}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Media Retention */}
      <div>
        <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">{uiText("Media Retention")}</div>
        <div className="rounded-lg bg-white/[0.02] p-3.5 space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className="text-sm text-txt-secondary whitespace-nowrap">{uiText("Delete chat media older than")}</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                value={mediaAgeDays}
                onChange={(e) => { setMediaAgeDays(Number(e.target.value)); setMediaPreviewDone(false); setMediaCleanupResult(null); }}
                className="input-standard w-20 px-2 py-1 text-sm text-center"
              />
              <span className="text-sm text-txt-tertiary">{uiText("days")}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleMediaCleanup(true)}
              disabled={mediaCleaning || mediaAgeDays < 1}
              className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-txt-secondary text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {mediaCleaning ? uiText("Scanning...") : uiText("Preview")}
            </button>
            <button
              onClick={() => handleMediaCleanup(false)}
              disabled={mediaCleaning || !mediaPreviewDone}
              className="px-3 py-1.5 bg-accent-rose hover:bg-accent-rose/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {mediaCleaning ? uiText("Deleting...") : uiText("Delete Now")}
            </button>
          </div>

          {mediaCleanupResult && (
            <div className={`p-2 rounded text-sm ${
              mediaCleanupResult.dryRun
                ? 'bg-accent-amber/10 border border-accent-amber/30 text-accent-amber'
                : 'bg-status-online/10 border border-status-online/30 text-status-online'
            }`}>
              <div className="font-medium mb-1">
                {mediaCleanupResult.dryRun ? uiText("Preview — no files deleted") : uiText("Cleanup complete")}
              </div>
              <div>
                {mediaCleanupResult.deletedFiles} {uiText(" file")}{mediaCleanupResult.deletedFiles !== 1 ? uiText("s") : ''} ({formatBytes(mediaCleanupResult.freedBytes)})
              </div>
              {mediaCleanupResult.errors.length > 0 && (
                <div className="mt-1 text-txt-danger">
                  {mediaCleanupResult.errors.length} {uiText(" error")}{mediaCleanupResult.errors.length !== 1 ? uiText("s") : ''}: {mediaCleanupResult.errors[0]}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => { setCleanupResult(null); setPreviewDone(false); fetchStats(); }}
        className="text-sm text-accent-primary hover:underline"
      >
        {uiText("Refresh Stats")}</button>
    </div>
  );
}
