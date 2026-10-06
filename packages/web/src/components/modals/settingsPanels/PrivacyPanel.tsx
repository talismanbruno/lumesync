import { t as uiText } from '../../../i18n';
import { useActivityStore } from '../../../stores/activityStore';
import { api } from '../../../api/client';
import { Toggle } from '../../ui/Toggle';

export function PrivacyPanel() {
  const showActivity = useActivityStore((s) => s.showActivity);

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-txt-primary mb-6">{uiText("Privacy")}</h2>
      {/* Activity Status */}
      <div>
        <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-1.5">
          {uiText("Activity Status")}</div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3.5">
          <div className="flex items-center justify-between py-1">
            <div className="flex-1 mr-4">
              <div className="text-sm text-txt-primary">{uiText("Share Activity Status")}</div>
              <div className="text-xs text-txt-tertiary mt-0.5">
                {uiText("Allow others to see what you're up to, like games you're playing or music you're listening to.")}</div>
            </div>
            <Toggle
              enabled={showActivity}
              onChange={async (enabled) => {
                try {
                  await api.users.update({ showActivity: enabled });
                  useActivityStore.getState().setShowActivity(enabled);
                } catch (err) {
                  console.error('Failed to update activity visibility:', err);
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
