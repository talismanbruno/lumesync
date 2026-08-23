// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/app/components/skeleton/AppSkeleton.module.css';
import KeybindManager from '@app/features/app/keybindings/KeybindManager';
import {flxElementClassName} from '@app/lib/react';
import LumeLogoAsset from '@app/media/images/lume-logo.png';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useLayoutEffect} from 'react';

interface AppSkeletonProps {
	readonly isExiting?: boolean;
	readonly onTransitionEnd?: React.TransitionEventHandler<HTMLElement>;
	readonly effectivePathname?: string;
}

/**
 * Branded boot state shown while the authenticated session and gateway are
 * restored. Keep this route-agnostic: rendering the previous screen's shell
 * made a normal startup look like a connection failure.
 */
export const AppSkeleton = observer(({isExiting = false, onTransitionEnd}: AppSkeletonProps) => {
	useLayoutEffect(() => {
		if (isExiting) return;
		KeybindManager.suspend();
		return () => KeybindManager.resume();
	}, [isExiting]);

	return (
		<flx-app-skeleton
			className={flxElementClassName(styles.container, isExiting && styles.containerExiting)}
			aria-busy={isExiting ? undefined : 'true'}
			aria-hidden={isExiting || undefined}
			onTransitionEnd={onTransitionEnd}
			data-flx="app.skeleton.app-skeleton.lume-sync"
		>
			<div className={styles.ambientGlow} aria-hidden="true" />
			<div className={styles.syncCard} role="status" aria-live="polite">
				<div className={styles.orbit} aria-hidden="true">
					<span className={styles.orbitRingOuter} />
					<span className={styles.orbitRingInner} />
					<span className={styles.orbitLight} />
					<div className={styles.logoShell}>
						<img className={styles.logo} src={LumeLogoAsset} alt="" />
					</div>
				</div>
				<div className={styles.copy}>
					<p className={styles.title}>Sincronizando o Lume</p>
					<p className={styles.subtitle}>Conectando suas conversas em tempo real</p>
				</div>
				<div className={styles.progress} aria-hidden="true">
					<span />
				</div>
			</div>
		</flx-app-skeleton>
	);
});
