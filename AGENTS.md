# AGENTS.md

- Approval actions must call requireApprovalCode/assertApprovalCode (src/components/auth/ApprovalCodeDialog) before changing status — keeps authenticator step-up consistent on every approve button.
- MFA backup codes and admin resets go through the mfa-tools edge function only — they need the service role to delete authenticator factors.
