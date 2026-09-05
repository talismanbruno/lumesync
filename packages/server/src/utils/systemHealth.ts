import type { AdminSystemHealth } from '@backspace/shared';

export interface SystemHealthAlertInput {
  databaseStatus: 'ok' | 'error';
  databaseMessage: string;
  heapUsagePercent: number;
  voiceDrops: number;
  voiceReconnects: number;
  voiceRecoveries: number;
  voiceParticipants?: number;
  maxConcurrentVoiceParticipants?: number;
  orphanedFiles: number;
  staleUploads: number;
  diskUsagePercent?: number | null;
  diskFreeBytes?: number | null;
  minFreeDiskBytes?: number | null;
  storageError?: string | null;
}

export function buildSystemHealthAlerts(input: SystemHealthAlertInput): AdminSystemHealth['alerts'] {
  const alerts: AdminSystemHealth['alerts'] = [];

  if (input.databaseStatus === 'error') {
    alerts.push({ level: 'critical', code: 'database_integrity', message: `Banco com problema: ${input.databaseMessage}` });
  }
  if (input.storageError) {
    alerts.push({ level: 'warning', code: 'storage_unavailable', message: `Não foi possível medir o armazenamento: ${input.storageError}` });
  }
  if (input.diskUsagePercent !== null && input.diskUsagePercent !== undefined) {
    if (input.diskUsagePercent >= 90) {
      alerts.push({ level: 'critical', code: 'disk_pressure', message: `Disco em ${input.diskUsagePercent}% de uso.` });
    } else if (input.diskUsagePercent >= 80) {
      alerts.push({ level: 'warning', code: 'disk_pressure', message: `Uso do disco elevado: ${input.diskUsagePercent}%.` });
    }
  }
  if (input.diskFreeBytes !== null && input.diskFreeBytes !== undefined
      && input.minFreeDiskBytes !== null && input.minFreeDiskBytes !== undefined
      && input.diskFreeBytes < input.minFreeDiskBytes) {
    alerts.push({ level: 'critical', code: 'disk_reserve', message: 'A margem mínima de espaço livre foi atingida; novos uploads estão bloqueados.' });
  }
  if (input.heapUsagePercent >= 90) {
    alerts.push({ level: 'critical', code: 'heap_pressure', message: `Memória interna em ${input.heapUsagePercent}%.` });
  } else if (input.heapUsagePercent >= 75) {
    alerts.push({ level: 'warning', code: 'heap_pressure', message: `Memória interna elevada: ${input.heapUsagePercent}%.` });
  }
  if (input.voiceDrops >= 10) {
    alerts.push({ level: 'warning', code: 'voice_drops', message: `${input.voiceDrops} quedas de call nas últimas 24 horas.` });
  }
  if (input.voiceReconnects >= 25 && input.voiceRecoveries < input.voiceReconnects * 0.7) {
    alerts.push({ level: 'warning', code: 'voice_recovery', message: 'Taxa de recuperação das calls está abaixo de 70%.' });
  }
  if (input.voiceParticipants !== undefined && input.maxConcurrentVoiceParticipants
      && input.voiceParticipants >= Math.ceil(input.maxConcurrentVoiceParticipants * 0.85)) {
    alerts.push({
      level: 'warning',
      code: 'voice_capacity',
      message: `Calls usando ${input.voiceParticipants} de ${input.maxConcurrentVoiceParticipants} vagas simultâneas.`,
    });
  }
  if (input.orphanedFiles >= 100) {
    alerts.push({ level: 'warning', code: 'orphaned_files', message: `${input.orphanedFiles} arquivos órfãos aguardando limpeza.` });
  }
  if (input.staleUploads >= 20) {
    alerts.push({ level: 'warning', code: 'stale_uploads', message: `${input.staleUploads} uploads abandonados aguardando limpeza.` });
  }

  return alerts;
}
