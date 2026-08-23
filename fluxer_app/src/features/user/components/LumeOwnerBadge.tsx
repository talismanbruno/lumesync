// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/user/components/LumeOwnerBadge.module.css';
import type {User} from '@app/features/user/models/User';
import {SealCheckIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';

interface LumeOwnerBadgeProps {
	user: User;
	size?: 'sm' | 'md' | 'lg';
	className?: string;
}

export function LumeOwnerBadge({user, size = 'sm', className}: LumeOwnerBadgeProps) {
	if (!user.isStaff()) return null;

	return (
		<span
			className={clsx(styles.badge, styles[size], className)}
			title="Lume Owner"
			aria-label="Lume Owner verificado"
			role="img"
			data-flx="user.lume-owner-badge"
		>
			<SealCheckIcon weight="fill" aria-hidden="true" />
		</span>
	);
}
