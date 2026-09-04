import { describe, expect, it } from 'vitest';
import { buildSystemHealthAlerts, type SystemHealthAlertInput } from './systemHealth.js';

const healthyInput: SystemHealthAlertInput = {
  databaseStatus: 'ok',
  databaseMessage: 'Banco íntegro',
  heapUsagePercent: 40,
  voiceDrops: 0,
  voiceReconnects: 0,
  voiceRecoveries: 0,
  orphanedFiles: 0,
  staleUploads: 0,
};

describe('buildSystemHealthAlerts', () => {
  it('keeps a healthy instance free of alerts', () => {
    expect(buildSystemHealthAlerts(healthyInput)).toEqual([]);
  });

  it('marks database integrity and extreme memory pressure as critical', () => {
    const alerts = buildSystemHealthAlerts({
      ...healthyInput,
      databaseStatus: 'error',
      databaseMessage: 'corrupt',
      heapUsagePercent: 94,
    });

    expect(alerts.filter((alert) => alert.level === 'critical').map((alert) => alert.code)).toEqual([
      'database_integrity',
      'heap_pressure',
    ]);
  });

  it('warns about low voice recovery only after a meaningful reconnect sample', () => {
    expect(buildSystemHealthAlerts({ ...healthyInput, voiceReconnects: 24, voiceRecoveries: 0 })).toEqual([]);
    expect(buildSystemHealthAlerts({ ...healthyInput, voiceReconnects: 25, voiceRecoveries: 17 }))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'voice_recovery' })]));
    expect(buildSystemHealthAlerts({ ...healthyInput, voiceReconnects: 25, voiceRecoveries: 18 }))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ code: 'voice_recovery' })]));
  });

  it('reports storage measurement and cleanup backlogs without hiding other metrics', () => {
    const alerts = buildSystemHealthAlerts({
      ...healthyInput,
      storageError: 'permission denied',
      orphanedFiles: 100,
      staleUploads: 20,
    });

    expect(alerts.map((alert) => alert.code)).toEqual([
      'storage_unavailable',
      'orphaned_files',
      'stale_uploads',
    ]);
  });
});
