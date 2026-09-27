# Chrome Web Store submission notes — DETEKTOR 0.8.0

## Single purpose

DETEKTOR performs user-initiated live fact-checking of audio/video content in the currently selected browser tab. It captures tab audio only after the user presses **Spustiť overovanie**, transcribes the audio, extracts externally verifiable claims, checks them against sources, and shows the results in the Chrome side panel.

## Permissions justification

- `storage` — stores local UI state, authenticated session tokens, installation ID, credit state, speaker references, and the user's first-run privacy acknowledgement.
- `activeTab` — gives temporary access to the tab the user explicitly selected by clicking the DETEKTOR action.
- `scripting` — reads limited page metadata and the current playback time of the active HTML5 video for source context and timestamps.
- `tabCapture` — captures audio from the user-selected active tab for the core live fact-checking feature.
- `offscreen` — maintains the audio MediaRecorder while the side panel/service worker lifecycle changes.
- `sidePanel` — provides the primary DETEKTOR user interface.
- `tabs` — keeps track of the selected source tab and restores/focuses it when the user restarts capture.
- host permission for `https://mexrrchqiehzvrefftym.supabase.co/*` — communicates only with DETEKTOR's Supabase authentication and backend functions.

## User data handled

- account email and authentication/session data;
- display name chosen by the user;
- stable local installation identifier;
- active-tab URL, page title and limited page metadata used for source context;
- user-initiated tab audio while LIVE checking is active;
- transcripts, identified claims, source/evidence records, speaker mapping and technical session metadata;
- Detektory wallet/usage information.

## Disclosure and consent

Before the first LIVE capture, the extension displays an in-product disclosure explaining that audio from the current tab and related session data are transmitted for secure server-side transcription and fact-checking. The user must press **Súhlasím a spustiť** before capture begins. The acknowledgement is stored locally and the disclosure can be reopened from the sidebar footer.

## Data transfers / processors

Data needed to provide the feature is processed through TP Innovation Labs / DETEKTOR.live infrastructure. Supabase provides authentication, database and server infrastructure. OpenAI provides AI processing used for transcription, claim extraction and related analysis.

The extension does not use captured browsing/audio content for personalized advertising and does not sell that content to third parties.

## Store listing disclosure sentence

**DETEKTOR zachytáva zvuk iba z karty, ktorú používateľ sám zvolí a spustí tlačidlom Spustiť overovanie. Zvuk a súvisiace údaje relácie sa bezpečne odosielajú na serverové spracovanie potrebné na prepis a fact-checking.**

## Before Submit for review

- replace the legal placeholders in the public privacy policy with final TP Innovation Labs identification, IČO and support/contact email;
- publish a working public Privacy Policy URL and enter it in the Chrome Web Store Privacy tab;
- upload final screenshots and store graphics;
- complete the Chrome Web Store data-use declarations and Limited Use certification;
- make a final ZIP with `manifest.json` at archive root;
- perform one clean-profile installation test from that exact ZIP.
