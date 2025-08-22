# 🌿 WindSong Project

**WindSong** is an interactive poem generator with animated backgrounds, drifting elements, and user controls.  
The site combines HTML, CSS, and JavaScript into a modular structure where each file has a dedicated role.

---

## 📂 Project Structure

### Core Files
- **index.html** – The main page containing the poem rings, output box, buttons, and program structure.
- **index.js** – Handles poem generation, ring animations, and logic for displaying poems on the page.
- **tracks.json** – Data file holding music/track references for playback integration.
- **mobile.html** – A wrapper that detects mobile devices and resizes the experience for smaller screens.

### Environment & Background
- **environment.html** – Provides the decorative animated background (wind, leaves, butterflies, etc.).
- **environment.js** – Script powering the background animation logic.
- **environment-loader.js** – Injects the background iframe (`environment.html`) and ensures scripts like `environment.js` and `windsong-controller.js` load in the correct order.

### Controllers
- **windsong-controller.js** – Adds the control menu for adjusting:
  - **Wind** → speed of drifting elements (affects leaves, butterflies, and poem drift).
  - **Breath** → spacing between lines of the generated poems.
  - **Elegra** → final poem display pattern.
  - **Rez** → how many times per hour a poem is generated.
  - Includes Apply/Exit behavior to save and restore menu selections during a session.

### Music
- **music/** – Directory holding background music tracks used by the site.

---

## 🚀 Features
- Interactive poem generation with drifting visual elements.
- Mobile wrapper (`mobile.html`) for consistent experience across devices.
- Control panel to adjust poem display and background behavior.
- Background animations (wind + leaves) layered beneath main content.
- Configurable poem output frequency (Rez).
- Session persistence for menu options (resets only on page refresh).

---

## 🛠️ Notes
- Backups and experimental files (e.g., `index.backup.html`, `environment-backup.js`, `index.not.html`) are not part of the active build.
- `CNAME` defines the custom domain if deployed via GitHub Pages.
- `.DS_Store` is a macOS system file and not needed for the project.
