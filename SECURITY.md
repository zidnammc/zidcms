# Security policy

## Supported versions

ZidCMS is at an early stage. Only the latest release line receives security fixes.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | yes       |
| < 0.1   | no        |

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub private vulnerability reporting: open the repository's **Security** tab and click **Report a vulnerability**.

Do not open public issues, discussions or pull requests for security problems.

Please include:

- a description of the problem and its impact;
- the affected component (for example admin auth, the RPC to Apps Script, the publish pipeline or the static site) and version or commit;
- steps to reproduce or a proof of concept;
- any suggested fix or mitigation, if you have one.

Do not include real secrets, Apps Script deployment URLs or personal e-mail addresses in your report. Placeholders are enough.

## What to expect

ZidCMS is an early-stage volunteer project, so responses are best effort. We aim to acknowledge reports within a reasonable time, keep you informed while we investigate, and credit you in the fix if you wish. There is no bug bounty.

## Scope

In scope:

- admin authentication and authorization (allowlist, sessions, CSRF and Origin checks);
- the HMAC-signed RPC between the admin dashboard and Google Apps Script;
- the publish pipeline (snapshot building, Git commit, deployment verification, rollback);
- the static public site (for example XSS through published content, leaked drafts or private data).

Out of scope:

- vulnerabilities in the Vercel, Google or GitHub platforms themselves (please report those to the vendor);
- load testing or denial-of-service against the hosted reference site;
- issues that require a leaked secret or a compromised maintainer account, unless ZidCMS makes the leak possible.

## Threat model

The security controls, threat model and accepted risks are documented in [`docs/security.md`](docs/security.md).
