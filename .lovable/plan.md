# Implementation Plan - LUME Platform

Initialize the LUME communication platform with a premium minimal dark aesthetic, Lovable Cloud backend integration, and robust authentication/onboarding flow.

## User Review Required

> [!IMPORTANT]
> - I will enable Lovable Cloud to handle authentication, database tables, and the profile creation trigger.
> - The application will use a "Dark & Glow" theme as specified (#050505 background).
> - Initial focus is on the secure login -> onboarding (username selection) -> dashboard skeleton flow.

## Proposed Changes

### Backend & Database (Lovable Cloud)
- Enable Lovable Cloud.
- Create `profiles` table with RLS and a trigger to automatically create profiles on auth signup.
- Create `servers` and `members` tables with appropriate foreign keys and RLS.
- Configure Google and Email authentication.

### Visual Identity (Global Styles)
- Update `src/styles.css` with the LUME color palette:
  - Background: `#050505`
  - Cards/Surface: `#121212`
  - Accent (Glow): `#00D1FF` (Cyan)
- Set Geist or Inter as the primary sans-serif font.
- Define custom utility classes for "glow" effects.

### Authentication & Onboarding
- **Login Page (`/auth`):** Premium dark interface with LUME branding, Email/Google login, and loading states.
- **Onboarding Page (`/onboarding`):** Forced redirect for users without a `username`. Allows setting `username` and `display_name`.
- **Auth Middleware:** Protect routes and ensure profile completion before dashboard access.

### Dashboard Skeleton
- **Main Layout (`_authenticated`):** 3-column architecture.
  - Sidebar (Servers list)
  - Navigation (Channels/Categories)
  - Main Content (Placeholder for future chat)
- Responsive design for mobile/desktop.

## Technical Details
- **Tech Stack:** TanStack Start v1, React 19, Tailwind CSS v4, Lovable Cloud.
- **Security:** RLS policies to ensure users can only see their profiles and servers they belong to.
- **Trigger:** PostgreSQL function `handle_new_user()` to sync `auth.users` to `public.profiles`.
- **Navigation:** TanStack Router with `beforeLoad` guards for profile validation.
