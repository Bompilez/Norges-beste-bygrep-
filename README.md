# Norges beste bygrep

This is the campaign website for **Norges beste bygrep**, a public nomination campaign where people can suggest urban projects, public spaces, infrastructure and other initiatives that have made Norwegian cities better places to live.

The site is used to collect nominations from the public, explain the campaign, handle privacy and consent, and let people optionally enter a gift card draw connected to the campaign.

## Website

The live site is available here:

https://norgesbestebygrep.no

## What the site includes

- A campaign front page.
- A nomination form for selected Norwegian cities.
- Optional participation in a gift card draw.
- A privacy policy.
- Cookie and analytics consent.
- Share image and favicon for link previews.
- An admin page for reviewing submissions.

## Stack

The site uses a static Vite frontend and a serverless Firebase backend.

- **Vite 7**, **TypeScript 5**, HTML and CSS provide the frontend without a UI framework.
- **Firebase Hosting** serves the generated `dist/` directory.
- **Cloud Firestore** and **Firebase Functions** store and process submissions.
- **Firebase Authentication** and **App Check** protect the administration interface and endpoints.
- **Google Analytics (GA4)** and **Meta Pixel** run only after consent.

## Project structure

```text
public/
  src/                 TypeScript application source
  static/              Files copied unchanged to the build
  admin/               Admin HTML and CSS entry point
  index.html           Main Vite entry point
functions/             Firebase Functions backend
dist/                  Generated production build (not committed)
firebase.json          Firebase Hosting, Functions and Firestore configuration
vite.config.ts         Vite entry points and build configuration
tsconfig.json          TypeScript configuration
```

Vite uses `public/` as its configured project root. TypeScript source therefore lives in `public/src/`, while `public/static/` contains assets copied unchanged to `dist/`.

## Configuration

The browser-facing Firebase configuration, GA4 measurement ID, App Check site key and Meta Pixel ID are defined in the frontend source. These identifiers are public integration settings, not server credentials:

- `public/src/firebase-client.ts` — Firebase and GA4 configuration
- `public/src/script.ts` — App Check site key for the campaign form
- `public/src/admin/submissions.ts` — admin Firebase and App Check configuration
- `public/src/analytics.ts` — Meta Pixel configuration

Backend secrets are managed by Firebase Functions rather than committed to the repository. The functions currently require `CONTACT_ENCRYPTION_KEY` and `RATE_LIMIT_SECRET`. The active Firebase project is selected through `.firebaserc`.

## Development

Install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

Create a production build and run the TypeScript checks:

```bash
npm run build
```

Available commands:

```bash
npm run dev        # Start the local development server
npm run typecheck  # Run TypeScript without building
npm run build      # Type-check and create dist/
npm run preview    # Preview the production build locally
```

## Deploy

Build and deploy the public website:

```bash
npm run build
firebase deploy --only hosting
```

Deploy the full Firebase project when backend or Firestore configuration has changed:

```bash
firebase deploy
```

## License

This is a proprietary, client-specific project. Use and distribution are subject to the applicable project agreements.
