# dameeland

A student social and learning app. The TypeScript npm workspace contains a React + Vite site, a React Native + Expo app, a Hono Worker and a shared design and product layer.

| Path | What lives here |
| --- | --- |
| `apps/web` | Responsive Vite app, browser session storage and image picker |
| `apps/mobile` | Expo app, native image picker, safe areas and SecureStore |
| `apps/api` | Hono routes, Wrangler config and D1 migrations |
| `packages/core` | Themes, logo and icons, accessible components, shared screens, typed API client and demo fixtures |
| `scripts` | Local API and browser checks, preview packaging and logo generation |

## Review the previews

Open `dameeland-web-preview.html` or `dameeland-mobile-preview.html` in a browser. The mobile preview is the Expo browser export inside a 390 × 844 frame that scales down to the viewport. Both files work offline. Tap through all three intro slides or use **Skip**, then choose **Explore demo**. Demo state resets on refresh. Use a test email and a test password if you want to exercise the demo signup form.

In the demo, try creating an image post, liking and reposting a card, leaving a comment, opening a story, following a classmate, sending Ada a message or finishing the daily quiz. Use the moon button or **Profile → Settings** to switch themes.

The original design skill governs colors, typography, the avatar rule, layout and onboarding. The HTML prototype governs the flow and demo cast. The full project export and App Screens board supply additional screen states and desktop composition. Both uploaded Markdown files contain the same one-line title.
The apps render the Hugeicons Stroke Rounded set as vectors. The original icon sprite remains available among the design references.

## Run with the local Worker

Use Node.js 24.3 or newer on the 24 release line, or Node.js 26 and npm. From the workspace root:

```bash
npm ci
npm run db:local
npm run dev:api
```

In a second terminal:

```bash
npm run dev:web
```

Open `http://localhost:5173` for the live local flow, or `http://localhost:5173/?demo=1` for sample data. Vite proxies API and WebSocket traffic to Wrangler on port 8787. A production Vite build can target a Worker using `VITE_API_URL`, with its exact web origin allowed by the Worker config.

```bash
npm -w @dameeland/mobile run start -- --go --lan
```

Scan the Metro QR code using Expo Go for SDK 58 on a phone connected to the same network. If LAN access is unavailable, sign into Expo from `apps/mobile` with `npx expo login`, then run `npm -w @dameeland/mobile run start -- --go --tunnel` from the workspace root.

Expo starts in demo mode by default. To connect a simulator or physical device to the local API, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env.local`. Use `http://localhost:8787` for iOS Simulator or `http://10.0.2.2:8787` for the standard Android emulator. For a physical device, use the development machine's LAN address and start Wrangler with `npm -w @dameeland/api run dev -- --ip 0.0.0.0` on a trusted local network.

## Admin access

Create a regular account, get its immutable user ID from the authenticated `GET /api/me` response, then set `ADMIN_USER_IDS` on the Worker to that ID. Separate multiple IDs with commas. For local development, set it in `apps/api/.dev.vars`. Reopen the app after changing the allowlist and go to **Profile → Settings → Admin dashboard**.

Apply D1 migration `0007_admin_accounts.sql` before running the updated API. It returns previously self-selected tech accounts to student status. Admins can reassign the tech role, which grants a verified badge and a rounded-square avatar. Regular accounts can receive an independent badge. The dashboard shows activity totals and recent signups, posts, and comments. It displays only aggregate counts for private messages. Existing accounts without a recorded signup date are included in total users.

## Implemented flows

- Three onboarding slides with one post card per slide, signup and login, light/dark/system themes, responsive navigation, profiles, feed, Explore, Messages, Learn, Play and Settings.
- Profiles can upload a picture and cover from the device photo picker. Followers and Following open paginated lists of linked profiles. In preview mode, selected photos and follow changes are local to the demo session.
- The local API persists accounts and sessions, posts, comments, idempotent likes and reposts, follows and direct message history in D1. R2 stores image attachments. One Durable Object per conversation broadcasts new messages to authorized participants.
- Learn opens a chapter-based maths lesson, the progress dashboard, and a working study timer. Play opens Quiz Duel, the games hub, and the sample leaderboard and rewards. Home opens the events and birthday screens. The preview’s Settings page links to the screen states, design system, and logo board.
- The teacher dashboard, focus room, social events, birthdays, rewards, stories, group conversations and call screens use local preview data. The app renders the call, voice-note and video story interfaces as simulations. The lesson uses written sample chapters. Preview actions are held in memory, and some reset when you leave the screen. Live audio/video, shared classroom records and cross-device progress still require backend or media integration.

The Wrangler configuration uses a placeholder database ID and a local origin. Set up production bindings and access controls before opening it to students.

## Startup and lazy loading

The web and Expo apps share an animated logo loader during startup and session restore. The eyes stay still when reduced motion is enabled. The secondary screens load when opened, and Expo initializes its image picker when an attachment is requested.

The normal Vite build emits a separate secondary-screen chunk. Use `npm run build:previews` to make self-contained offline HTML files with the modules embedded and evaluated when needed.

## Google sign-in

Create a Google OAuth client of type **Web application**. Set `GOOGLE_CLIENT_ID` and `GOOGLE_REDIRECT_URI` on the API Worker and set `GOOGLE_CLIENT_SECRET` as a Worker secret. Register the exact Worker callback URL, such as `https://api.example.com/api/google/callback`, as an authorized redirect URI on that client. Apply the D1 migrations before deploying the Worker.

New accounts choose a unique, case-insensitive username (3–24 letters, digits or underscores). The app checks availability while typing and the database enforces uniqueness on sign-up. Existing accounts can still log in with their current credentials.

Web uses a pop-up. On a phone, complete the Google flow in the system browser and return to the app. The offline previews show the Google buttons and support email-based demo accounts. Existing password accounts keep their existing login method if their email matches a new Google sign-in attempt.

## Checks and builds

With the local Worker running, `npm test` tests signup, login, logout, feed, image round trips through R2, follow filtering, reactions, comments, private room access and a Durable Object WebSocket broadcast.

With both development servers running:

```bash
npx playwright install chromium
npm run test:browser
```

The browser check covers the 390 px layout, desktop navigation, onboarding, social interactions, quiz results and API-backed signup, session restore, posting and logout.

```bash
npm run typecheck
npm run build
npm run build:mobile
npm run build:previews
```

Expo exports iOS and Android bundles as well as the browser build. Open the mobile HTML for interactive browser review or run Expo on a compatible device to exercise native integrations.
