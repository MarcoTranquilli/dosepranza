# Security Policy

## Supported Branch

| Branch | Supported |
| --- | --- |
| `main` | Yes |

## Security Baseline

- Hosting: GitHub Pages (`https://marcotranquilli.github.io/dosepranza/`)
- Auth: Firebase Authentication (Google + Anonymous enabled)
- Authorization: Firestore Rules + role logic (custom claims with fallback email mapping)
- Data protection: no secrets in client storage, no privileged operations without role checks

## Report a Vulnerability

- Contact: `marco.tranquilli@dos.design`
- Include: reproduction steps, affected URL/path, browser, timestamp, console/network evidence
- SLA target:
- `24h` acknowledgement
- `72h` first triage

## Out of Scope

- Tailwind CDN warning in console is not a security vulnerability by itself.
- Postimg temporary unavailability (`503`) is an external availability issue.
