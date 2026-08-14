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

The site has a statically generated frontend and a serverless Firebase backend.

- **Vite 7** provides the development server and production build.
- **TypeScript 5** is used for all frontend application code.
- **HTML and CSS** provide the page structure and styling without a frontend framework.
- **Firebase Web SDK** provides the browser integrations.
- **Firebase Hosting** serves the generated `dist/` directory.
- **Cloud Firestore** stores nominations and administrator configuration.
- **Firebase Functions**, running on Node.js 22, validates and processes requests.
- **Firebase Authentication** protects the administration interface.
- **Firebase App Check** helps protect public and administrative endpoints from abuse.
- **Google Analytics for Firebase** and **Meta Pixel** run only after consent.

The existing Firebase Functions remain in JavaScript. TypeScript currently checks the frontend with a migration-friendly configuration; strict mode can be enabled incrementally as the domain and DOM types are strengthened.

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

This project was made for a specific campaign. It is not licensed for reuse, copying or redistribution.
