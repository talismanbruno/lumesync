# Security Scanning & Supply-Chain Assurance

Automated, continuous scanning wired into GitHub Actions. This document is the
reference for what runs, where results go, and the one-time settings a maintainer
must enable. The workflows publish findings in the Security tab. The release
process requires successful CI and Security checks and a passing container scan.

## Workflows

| File | Purpose | Trigger | Result |
|------|---------|---------|--------|
| `.github/dependabot.yml` | Dependency + action + base-image update PRs | weekly | PRs |
| `.github/workflows/codeql.yml` | CodeQL SAST (`javascript-typescript`, build-mode none) | PR + push main + weekly | Security tab |
| `.github/workflows/security.yml` | gitleaks (secrets, full history), OSV-Scanner (deps), Trivy config (IaC), Trivy license | PR + push main + weekly | Security tab |
| `.github/workflows/scorecard.yml` | OpenSSF Scorecard (repo posture) | push main + weekly + on branch-protection change | Security tab + public badge |
| `.github/workflows/docker-publish.yml` | Image scan (Trivy) + SBOM + provenance for the published container | tag push / manual | image scan gate + SBOM + provenance |

> **gitleaks findings** surface in the workflow's job log and PR summary — the
> `gitleaks` job does not upload SARIF, so secret hits do **not** appear under
> Security → Code scanning (unlike the OSV / Trivy / CodeQL / Scorecard jobs).

## Dependency and container gates

OSV scans the full workspace lockfile and uploads the full current report. When
the lockfile changes and the scan finds issues, it also scans the previous push
or pull request base. A new
combination of package, version and advisory fails Security. Existing findings
remain visible in the current report. Missing reports and inconsistent scanner
results fail the check. Scheduled runs report current findings without a baseline.

Trivy blocks container publication on fixable HIGH or CRITICAL findings in the
amd64 image. The config and license jobs enforce their own gates.

Code-level gates (OSV, Trivy, gitleaks) block via workflow exit codes. CodeQL
merge-blocking, Dependabot alerts, and native secret-scanning are GitHub *settings*
— see the checklist below.

## Supply-chain hardening

- Every action is pinned to a full commit SHA (`# vX.Y.Z` comment) — resists
  tag-move attacks and satisfies Scorecard's Pinned-Dependencies check.
- `step-security/harden-runner` (egress-policy `audit`) on Linux jobs.
- Least-privilege `permissions:` per workflow/job.
- SBOM + SLSA provenance are attached to the published container image at push
  (`.github/workflows/docker-publish.yml`). The amd64 image is scanned by Trivy
  before publication of the multi-architecture image.

## Maintainer checklist (one-time GitHub settings — NOT code)

- [ ] Repository must be **public** (required for the Scorecard badge/publish and
      the CodeQL free tier).
- [ ] Settings → Code security: enable **Dependabot alerts** and **Dependabot
      security updates**.
- [ ] Settings → Code security: enable **Secret scanning** + **Push protection**.
- [ ] Settings → Code security: enable **CodeQL / code-scanning merge protection**
      so high-severity alerts block PRs (the code-level gates do the rest).
- [ ] Branch protection on `main`: require the CI + security status checks to pass.
- [ ] **Manual image bumps:** Dependabot does not track `docker-compose.yml`
      `image:` pins — update `caddy` and `livekit/livekit-server` by hand when new
      releases ship. (Renovate, which parses compose, is an optional future
      alternative.)
