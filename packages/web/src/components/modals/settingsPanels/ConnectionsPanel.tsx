import { t as uiText } from '../../../i18n';
import { ConnectedInstances } from '../ConnectedInstances';

export function ConnectionsPanel() {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-txt-primary mb-6">{uiText("Connections")}</h2>
      <ConnectedInstances />
    </div>
  );
}
