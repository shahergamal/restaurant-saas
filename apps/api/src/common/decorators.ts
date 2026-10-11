import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@sufra/shared';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const PERMS = 'permissions';
export const RequirePermissions = (...perms: Permission[]) => SetMetadata(PERMS, perms);

export const SKIP_MFA_ENROLLMENT = 'skipMfaEnrollment';
export const AllowWithoutMfa = () => SetMetadata(SKIP_MFA_ENROLLMENT, true);
