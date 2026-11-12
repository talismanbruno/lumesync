import { useEffect, useState } from 'react';

type DesktopUpdateState = Pick<RecoveryState, 'updateState' | 'updateVersion' | 'lastCheckResult' | 'lastUpdateError' | 'updateProgress'>;

const initial: DesktopUpdateState = { updateState: 'idle', updateVersion: null, lastCheckResult: null, lastUpdateError: null, updateProgress: null };

/** The recovery bridge is available in installed builds that predate the normal-window events. */
export function useDesktopUpdateState(poll = false) {
  const [state, setState] = useState<DesktopUpdateState>(initial);

  useEffect(() => {
    const bridge = window.backspace;
    if (!bridge) return;

    let disposed = false;
    let eventRevision = 0;
    const receive = (value: DesktopUpdateState) => {
      eventRevision++;
      setState(value);
    };
    const refresh = () => {
      const revision = eventRevision;
      void bridge.getRecoveryState?.().then(snapshot => {
        if (!disposed && revision === eventRevision) setState(snapshot);
      }).catch(() => {});
    };

    const cleanups = [
      bridge.onRecoveryStateChanged?.(receive),
      bridge.onUpdateAvailable?.(({ version }) => receive({ ...initial, updateState: 'downloading', updateVersion: version, lastCheckResult: null })),
      bridge.onUpdateDownloaded?.(({ version }) => receive({ ...initial, updateState: 'downloaded', updateVersion: version, lastCheckResult: null })),
      bridge.onUpdateProgress?.(progress => {
        eventRevision++;
        setState(previous => ({ ...previous, updateProgress: progress }));
      }),
      bridge.onUpdateError?.(error => {
        eventRevision++;
        setState(previous => ({ ...previous, updateState: 'error', lastCheckResult: 'failed', lastUpdateError: { message: error.message, code: null, at: Date.now() } }));
      }),
    ];
    refresh();
    const timer = poll ? window.setInterval(refresh, 750) : undefined;
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearInterval(timer);
      cleanups.forEach(cleanup => cleanup?.());
    };
  }, [poll]);

  const checkForUpdates = () => {
    setState({ ...initial, updateState: 'checking' });
    window.backspace?.checkForUpdates();
  };

  return { ...state, checkForUpdates };
}
