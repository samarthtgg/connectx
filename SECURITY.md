# Security policy

## Reporting a vulnerability

Please do not publish exploitable vulnerability details in a public issue.

Use GitHub's private vulnerability reporting feature for this repository if it is enabled. If it is unavailable, contact the repository owner through the [GitHub profile](https://github.com/samarthtgg) and request a private channel for the report.

Include:

- A concise description of the affected feature or component.
- The security impact and realistic attack scenario.
- Reproduction steps or a minimal proof of concept.
- Any suggested mitigation, if known.

Do not include real users' personal data, passwords, session tokens, API keys, or production secrets in a report.

## Security expectations

ConnectX uses Supabase. Deployers should:

- Keep service-role keys and other secrets server-side.
- Enable and test Row Level Security on user data.
- Restrict Storage access with policies.
- Validate authorization in database policies and server-side functions.
- Configure authentication redirect URLs deliberately.
- Review Edge Function authentication and input validation.
