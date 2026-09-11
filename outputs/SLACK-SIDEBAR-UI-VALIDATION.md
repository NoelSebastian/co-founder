# Sidebar and Slack keyboard validation — 11 September 2026

Changes:
- Lovable is a standalone sidebar entry above Business applications, using Lovable's official favicon/logo.
- Business application chat resets to collapsed when a page opens; the existing toggle opens and closes it.
- Native Buzz channels and DMs are hidden in the local Co-founder sidebar (data and underlying functionality retained).
- Slack Channels and Direct messages have separate plus controls and collapse controls.
- Channels plus opens a create-channel menu and name/visibility dialog. Creation uses the authenticated user's Slack API through the existing durable operation journal.
- DM plus opens a searchable people picker supporting one person or up to eight; self-DM is included.
- Slack editor Enter handling reads the current callback and disabled state; Shift+Enter preserves a line break and IME composition does not submit.

Live checks performed in localhost:5174:
- Sales pipeline opens with panel aria-expanded=false; toggle opens and closes it.
- Official Lovable logo rendered above Business applications; native chat sections absent.
- Enter sent a labelled message to authorized private #cofounder-slack-qa and cleared composer immediately.
- Shift+Enter inserted a line break; Enter sent a thread reply. Both messages were independently observed in Slack itself under Noël's identity, with one thread reply.
- Created private #cofounder-sidebar-qa-0911 (C0C1723ETK4) through the new dialog. Confirmed in app and Slack sidebar.
- New DM plus, search, selection and Start conversation opened existing self-DM; Enter sent a labelled self-DM test.
- Backend restart briefly interrupted the first creation attempt; retry with the same request ID succeeded.

Static checks: TypeScript passed; Slack validation tests 5/5 passed.

Limits: this verifies the requested changes, not complete Slack parity. Public-channel creation and new group DM creation were not exercised against the live workspace in this pass. The web Lovable workspace still has the previously documented native-host limitation.
