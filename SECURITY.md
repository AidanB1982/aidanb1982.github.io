# Security Policy

This policy covers the Blackwood Publishing website, the Sgeul online reader,
and the Sgeul Android app maintained in this repository.

## Supported Versions

Security fixes are applied to the current website and the latest Sgeul Android
release. Older versions do not receive separate security patches.

| Version                                                  | Supported |
| -------------------------------------------------------- | --------- |
| Website and online reader: current production deployment | Yes       |
| Sgeul Android: latest beta release (currently 0.2.0)     | Yes       |
| Earlier Android releases and historical website versions | No        |

Please update to the latest available build before checking whether an issue
still occurs. Reports affecting older versions are welcome if the issue may
also affect a supported version.

## Reporting a Vulnerability

Email **[aidan@blackwoodpublishing.co.uk](mailto:aidan@blackwoodpublishing.co.uk)**
with the subject **Security vulnerability report**. Please report vulnerabilities
privately rather than opening a public GitHub issue or posting sensitive details
on social media.

Include, where possible:

- The affected page, feature, or app version, and your browser or Android version.
- A description of the issue and its potential impact.
- Steps to reproduce it using accounts and data you control.
- A minimal proof of concept or screenshots with personal information and secrets
  removed.
- Contact details for follow-up questions.

Do not send passwords, API keys, session tokens, payment details, or other
people's personal information.

### What to expect

We aim to acknowledge reports promptly, review the evidence, and assess the
severity and impact. We do not currently offer a fixed response time or update
schedule. We will provide updates when we need more information, reach a finding,
or have a fix or mitigation to share. If you have not heard back after seven
working days, please follow up on the same email thread.

If a vulnerability is confirmed, we will prioritise a fix or mitigation according
to its impact and let you know the outcome. If we cannot reproduce the issue,
consider it outside scope, or decline the report, we will explain why where
possible. Please coordinate any public disclosure with us so we have time to
investigate and protect affected readers.

### Responsible testing

Use only accounts and data you control. Do not access, copy, change, or delete
other people's data, disrupt services, perform denial-of-service tests or
high-volume automated scanning, or attempt social engineering. If you encounter
private data, stop testing and report the issue without collecting further data.

Independent third-party platforms are governed by their own security policies;
issues in Blackwood Publishing's integrations or configuration can be reported
to us.

For the wider website policy, see
[Blackwood Publishing's Security Policy](https://blackwoodpublishing.co.uk/security-policy.html).
