import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { Role } from '../roles.enum.js';

function makeContext(user: { role: string } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows the request through when no @Roles metadata is present', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: Role.Mitarbeiter }))).toBe(true);
  });

  it('allows the request when the user has one of the required roles', () => {
    const reflector = { getAllAndOverride: () => [Role.SuperAdmin, Role.Admin] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: Role.Admin }))).toBe(true);
  });

  it('denies the request when the user role is not in the required list', () => {
    const reflector = { getAllAndOverride: () => [Role.SuperAdmin] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeContext({ role: Role.Mitarbeiter }))).toThrow(ForbiddenException);
  });

  it('denies the request when there is no authenticated user at all', () => {
    const reflector = { getAllAndOverride: () => [Role.SuperAdmin] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });
});
