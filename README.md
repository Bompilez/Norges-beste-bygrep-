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

## Technology

The project is built as a static website with HTML, CSS and JavaScript. Firebase is used for hosting, data storage and backend functions.

In short:

- **Firebase Hosting** serves the website.
- **Firestore** stores submissions.
- **Firebase Functions** receives and processes form submissions.
- **Firebase App Check** helps protect the form from abuse.
- **Firebase/Google Analytics** is used only after consent.

## Development

To preview the site locally:

```bash
cd public
python3 -m http.server 8080
```

## Deploy

Deploy the public website:

```bash
firebase deploy --only hosting
```

Deploy the full Firebase project when backend or Firestore configuration has changed:

```bash
firebase deploy
```

## License

This project was made for a specific campaign. It is not licensed for reuse, copying or redistribution.
