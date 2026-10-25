# CineScope: TMDB Movie Discovery SPA

CineScope is a responsive Single Page Application built with HTML, CSS, JavaScript, jQuery, AJAX, JSON, and the TMDB API.

## Features
- Search movies by title using TMDB's movie search endpoint.
- Search suggestions while typing.
- Popular movie discovery.
- Movie detail dialog with overview, genres, runtime, rating, and cast.
- Genre filtering and sorting.
- Pagination.
- Watchlist stored in browser `localStorage`.
- Loading, empty, and error states.
- Responsive layout, semantic landmarks, labels, keyboard focus styling, and reduced-motion support.

## Setup
1. Create a TMDB account and request a v3 API key from your TMDB account settings.
2. Open `app.js` and replace `PASTE_YOUR_TMDB_V3_API_KEY_HERE` with your v3 API key.
3. Save all files in one folder.
4. Run a local server (recommended): in VS Code, install the Live Server extension, right-click `index.html`, and select **Open with Live Server**. Alternatively, run `python -m http.server 8000` in this folder and visit `http://localhost:8000`.
5. Use the browser developer console to investigate any errors.

The v3 API key is visible in a client-side app. Use only a TMDB key intended for this kind of application, follow TMDB terms, and never place a private bearer token in a public repository. If your course requires secrets to be hidden, use a server-side proxy instead.

## Deploy to GitHub Pages
1. Create a public GitHub repository, for example `cinescope-tmdb-spa`.
2. Upload `index.html`, `styles.css`, `app.js`, and this README to the repository root.
3. In GitHub, open **Settings → Pages**.
4. Under the build/deployment source, select **Deploy from a branch**, choose `main` and `/(root)`, then save.
5. Wait for the deployment workflow to finish. Open the URL shown on the Pages settings screen.
6. Test search, details, filters, watchlist, mobile layout, and the browser console on the live site.

## Accessibility test
Install the WAVE browser extension from https://wave.webaim.org/ or use the online tool on your deployed URL. Review errors, alerts, contrast, heading structure, labels, image alternatives, and landmarks. Fix issues and save screenshots of the WAVE results for your report. Also test with keyboard-only navigation. WAVE is a useful aid, not an accessibility certification.

## TMDB attribution
This product uses the TMDB API but is not endorsed or certified by TMDB. Review TMDB's current API terms and attribution guidance before submitting or publishing.

## Troubleshooting
- **401 error:** verify the v3 API key was copied correctly.
- **No movie results:** check the search spelling and filters.
- **Network error:** check internet access and browser developer tools.
- **Watchlist not persisting:** make sure local storage is enabled in the browser.
