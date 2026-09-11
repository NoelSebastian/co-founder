# Native Lovable browser experiment

This is an isolated macOS test host, not the production Buzz/Tauri release. It loads the existing local frontend on port 5174 and places a separate WKWebView over the Lovable page's content rectangle. The sidebar stays in the local webview. Remote Lovable content has no application message handler or native filesystem privileges. Normal WebKit authentication, TLS and framing protections remain enabled.

Build:

```
xcrun clang -fobjc-arc -framework Cocoa -framework WebKit main.m -o 'Co-founder Browser Test.app/Contents/MacOS/CoFounderBrowser'
```

Open `Co-founder Browser Test.app`, select Continue as Noel, then Business applications → Lovable. This test uses the existing Page Flow Counter project, leaves it unpublished, and has a separate persistent browser session. Lovable authentication in this native session must be verified before claiming a usable editor-and-preview integration. OAuth popup support is implemented through WKUIDelegate.

Swift source is an abandoned equivalent experiment; the installed Swift toolchain and SDK disagree. The Objective-C host compiles successfully using the installed Clang and frameworks.

## Observed test result

- Objective-C native host compiled successfully; frontend TypeScript passed.
- Existing Co-founder UI loaded and real backend pages/Slack conversations appeared.
- Sidebar verified visually: Business applications → Lovable → Sales pipeline, followed by remaining pages.
- Separate native Lovable webview rendered next to the sidebar. Remote editor initially required login, as expected for the separate profile.
- Google OAuth popup opened to the account sign-in form. The user's existing Google session from the Codex browser is not shared with this WKWebView profile.
- User sign-in is required to finish testing the private editor and nested preview. Do not claim the full native workflow passes yet.
- A missing `navigator.mediaDevices` crash in the huddle initialization path was fixed with feature checks. This does not enable microphone support in the prototype.
