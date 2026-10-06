import { t as uiText } from '../../../i18n';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useSettingsSections } from '../../../hooks/useSettingsSections';
import type { SettingsSection } from '../SettingsSectionsContext';
import { SettingsTabBar } from '../SettingsTabBar';
import { GeneralPanel } from '../instanceSettingsPanels/GeneralPanel';
import { RegistrationPanel } from '../instanceSettingsPanels/RegistrationPanel';
import { FederationPanel } from '../instanceSettingsPanels/FederationPanel';
import { StreamingPanel } from '../instanceSettingsPanels/StreamingPanel';
import { StoragePanel } from '../instanceSettingsPanels/StoragePanel';
import { UsersPanel } from '../instanceSettingsPanels/UsersPanel';
import { InsightsPanel } from '../instanceSettingsPanels/InsightsPanel';
import { SpacesPanel } from '../instanceSettingsPanels/SpacesPanel';
import { HealthPanel } from '../instanceSettingsPanels/HealthPanel';

type SubTab = 'insights' | 'health' | 'spaces' | 'general' | 'registration' | 'federation' | 'streaming' | 'storage' | 'users';

export function InstancePanel() {
  const fetchInstanceSettings = useSettingsStore((s) => s.fetchInstanceSettings);
  const fetchStreamingLimits = useSettingsStore((s) => s.fetchStreamingLimits);

  const [subTab, setSubTab] = useState<SubTab>('insights');
  const [approvalCount, setApprovalCount] = useState(0);

  const sections = useMemo<SettingsSection[]>(() => [
    { id: 'insights', label: uiText("Visão geral") },
    { id: 'health', label: uiText("Saúde do sistema") },
    { id: 'spaces', label: uiText("Servidores") },
    { id: 'general', label: uiText("General") },
    { id: 'registration', label: uiText("Registration") },
    { id: 'federation', label: uiText("Federation"), badgeCount: approvalCount },
    { id: 'streaming', label: uiText("Streaming") },
    { id: 'storage', label: uiText("Storage") },
    { id: 'users', label: uiText("Usuários e selos") },
  ], [approvalCount]);

  const handleNavigate = useCallback((id: string) => {
    setSubTab(id as SubTab);
  }, []);

  // Register sections for sidebar sub-links (tab mode — no scroll-spy)
  useSettingsSections(sections, { onNavigate: handleNavigate, activeTab: subTab });

  useEffect(() => {
    fetchInstanceSettings();
    fetchStreamingLimits();
  }, [fetchInstanceSettings, fetchStreamingLimits]);

  return (
    <div className="space-y-4">
      <SettingsTabBar />

      {subTab === 'insights' && <InsightsPanel />}
      {subTab === 'health' && <HealthPanel />}
      {subTab === 'spaces' && <SpacesPanel />}
      {subTab === 'general' && <GeneralPanel />}
      {subTab === 'registration' && <RegistrationPanel />}
      {subTab === 'federation' && <FederationPanel onApprovalCountChange={setApprovalCount} />}
      {subTab === 'streaming' && <StreamingPanel />}
      {subTab === 'storage' && <StoragePanel />}
      {subTab === 'users' && <UsersPanel />}
    </div>
  );
}
