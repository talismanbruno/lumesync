/* eslint-disable */
// @ts-nocheck
import { FileRoute, RootRoute } from '@tanstack/react-router'

const rootRoute = new RootRoute()

const indexRoute = new FileRoute('/').createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
} as any)

const authRoute = new FileRoute('/auth').createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth',
} as any)

const onboardingRoute = new FileRoute('/onboarding').createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
} as any)

const authenticatedRoute = new FileRoute('/_authenticated').createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
} as any)

const authenticatedIndexRoute = new FileRoute('/_authenticated/').createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/',
} as any)

export const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  onboardingRoute,
  authenticatedRoute.addChildren([authenticatedIndexRoute]),
])
