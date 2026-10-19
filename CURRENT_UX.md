# Current User Experience Audit

**Application**: Ralph Dulla Portfolio & Private Diary  
**Capacitor App Identifier**: `com.ralph.diary` (`capacitor.config.json`)  
**Audit Scope**: Exact as-is UX running on web and simulated mobile device (viewport width ~390px vs desktop 1280px)  
**Verification Method**: Static source inspection across `src/` + live execution via Vite on Node.js / Playwright headless browser at 390x844 (phone) and 1280x800 (desktop).

---

## Executive Summary & Architectural Duality

The repository houses a **hybrid dual-purpose application**:
1. **Public Web Portfolio & Shelf (`/`, `/portfolio`, `/library`, `/stats`)**: A responsive single-page portfolio with Lenis smooth scrolling, dark/light theme toggle, interactive project links, certificate viewer, and a public reading/gaming shelf.
2. **Capacitor Mobile Native / Owner Diary App (`/app/games`, `/app/books`)**: Configured with Capacitor (`capacitor.config.json`). When launched on native Android (`window.Capacitor?.isNativePlatform?.()`), the root route redirects immediately to `/app/games` (`src/App.jsx#L81-L85`). Non-owner visitors attempting to access the diary routes are intercepted by `RequireAuth` (`src/components/auth/RequireAuth.jsx#L22-L24`) and redirected to the `/login` screen.

---

## 1. First Impression

| Dimension | Web Portfolio Mobile View (~390px) | Native Android Mobile App View (`com.ralph.diary`) | Desktop View (1280px) |
| :--- | :--- | :--- | :--- |
| **Initial Route** | `/#/` (`src/App.jsx#L110`) | `/#/app/games` -> redirects to `/#/login` if not signed in (`src/App.jsx#L82`, `src/components/auth/RequireAuth.jsx#L22`) | `/#/` (`src/App.jsx#L110`) |
| **First Screen Elements** | Top bar (14px/h-14) with animated typewriter logo `RD` / `RDeveloper` / `RDesigner`, theme toggle button, hamburger icon. Centered avatar profile photo (`112px x 112px` rounded-[30%]), name headline, subtitle, 3 social icons, 2 action links. | Centered login card on neutral backdrop: "RD" rounded box, "Diary Sign In" (24px), subtitle "Private logging access for games & books", email & password inputs, "Sign In" button. | Top bar with horizontal text nav links, typewriter logo, theme toggle, sides decorated with interactive gooey pixel-trail mouse effect (`src/components/Layout.jsx#L82-L98`). |
| **Primary Headline** | "Ralph Dulla" (`src/components/Hero.jsx#L36-L38`) | "Diary Sign In" (`src/pages/LoginPage.jsx#L78-L80`) | "Ralph Dulla" (`src/components/Hero.jsx#L36-L38`) |
| **Subhead** | "Computer Science Student & Developer" (`src/components/Hero.jsx#L39-L41`) | "Private logging access for games & books" (`src/pages/LoginPage.jsx#L81-L83`) | "Computer Science Student & Developer" (`src/components/Hero.jsx#L39-L41`) |
| **Visual Tone** | Minimalist monochrome editorial: light gray backdrop (`#f9f9f9`), dark gray borders (`#e5e5e5`), dark slate text (`#1a1a1a`), dashed outer container framing. | Clean, focused utility authentication modal. | Editorial personal dashboard with soft translucent frosted headers (`backdrop-blur-md`). |
| **Call to Action** | "View My Work ↓" (smooth-scroll anchor) and "Download CV" (`src/components/Hero.jsx#L61-L80`). | "Sign In" button (`src/pages/LoginPage.jsx#L125-L138`). | "View My Work ↓" and "Download CV". |
| **Onboarding / Login** | No splash screen or walkthrough on web. Native wrapper directs unauthenticated users straight to password entry. | No carousel/tutorial; standard authentication barrier. | None. Direct content exposure. |

*Screenshots*:
- Mobile Portfolio Hero: `screenshots/mobile_portfolio_hero.png`
- Mobile Dark Mode: `screenshots/mobile_portfolio_dark.png`
- Desktop Portfolio Hero: `screenshots/desktop_portfolio_hero.png`
- Mobile Login Screen: `screenshots/mobile_login.png`

---

## 2. Navigation Architecture & Routes

### Route Map

```
HashRouter (src/App.jsx#L105)
 ├── /                       RootRoute: redirects to /app/games if Capacitor native, else HomePage
 ├── /portfolio              HomePage (public portfolio)
 ├── /library                LibraryPage (defaults to 'books' tab)
 ├── /stats                  LibraryPage (defaults to 'games' tab)
 ├── /login                  LoginPage
 ├── /app                    Redirects to /app/games
 ├── /app/games              GamesPage [RequireAuth: owner only]
 ├── /app/books              BooksPage [RequireAuth: owner only]
 └── *                       Catch-all: Redirects to /
```

### Navigation Modalities

1. **Portfolio Top Bar (`src/components/Layout.jsx#L100-L175`)**:
   - **Desktop**: Fixed top bar (`h-14`, `max-w-3xl`) with smooth-scrolling anchor links: `About`, `Experience`, `Projects`, `Certificates`, `Library`, `Contact`, plus theme toggle.
   - **Mobile (<640px)**: Anchors collapse into a hamburger button (`BsList` / `BsX`). Tapping opens a vertical drop-down list. If owner is signed in or native mode is detected, an extra "Open Diary App" row appears (`src/components/Layout.jsx#L162-L171`).
2. **Bottom Tabs Navigation (`src/components/navigation/BottomTabs.jsx#L107-L133`)**:
   - Used inside `/app/games` and `/app/books`.
   - **Mobile**: Fixed full-width bottom bar (`py-1.5`, `border-t`, `bg-white/95 dark:bg-gray-950/95`) with 4 tabs:
     - `Games` (`/app/games`) — Controller icon
     - `Books` (`/app/books`) — Book icon
     - `Stats` (`/stats`) — BarChart icon
     - `Portfolio` (`/portfolio`) — Person icon
   - **Desktop**: Floats as a centered pill capsule (`md:max-w-md md:left-1/2 md:-translate-x-1/2 md:bottom-4 md:rounded-full md:border`).
3. **Public Subpage Header (`src/pages/LibraryPage.jsx#L768-L776`)**:
   - Top banner with "← Back to Home" link (`/portfolio`) and dark mode toggle.
   - Tab switchers: "Bookshelf (51)" and "Games (0)" buttons.
4. **Dead Ends & Traps**:
   - **In `/library` and `/stats`**: There is no bottom navigation bar and no hamburger menu. Users only have the top "← Back to Home" text button.
   - **Unauthenticated visiting `/app/games`**: Redirects to `/login` with return state. If a visitor signs in with a valid Firebase account that is *not* the designated `OWNER_UID`, they see an "Owner Access Only" blocking screen (`src/components/auth/RequireAuth.jsx#L26-L56`) with two buttons: "Sign Out" and "Back to Portfolio".

---

## 3. Screen by Screen Breakdown

### Screen 1: Home Portfolio (`/#/` or `/#/portfolio`)
- **Top to Bottom**:
  1. *Header (`src/components/Layout.jsx#L100`)*: Animated Typewriter text `RD` / `RDeveloper` / `RDesigner` on left; Dark mode icon and hamburger button on right.
  2. *Hero (`src/components/Hero.jsx`)*: 128x128 rounded avatar (`/assets/images/PFP.webp`), Name "Ralph Dulla", title "Computer Science Student & Developer", social icons (GitHub, Facebook, LinkedIn), action buttons "View My Work ↓" and "Download CV".
  3. *About (`src/components/About.jsx`)*: 3 paragraphs highlighting CS degree, AI workflow, Figma design process, and hobbies (gaming, movies, music, collecting books).
  4. *Experience & Tech Stack (`src/components/Experience.jsx`)*:
     - "Tech Stack": Category chips for Languages (6), Frameworks (4), Backend (3), Tools (5) with branded icons and hover lifts.
     - "Experience": Vertical timeline with dots for UIC education, Echoverse OJT, VIBE club, and SITES custodian.
  5. *Projects (`src/components/Projects.jsx`)*: 5 cards (TonyWrites, Echoverse Digital Marketing, PReDiCT, Counseling Management System, Gear Guard). Each card features title, private/public tag, GitHub link icon, live demo link icon, description, and technology tags.
  6. *Certificates (`src/components/Certificates.jsx`)*: 2 initial cards (AWS Cloud Solutions, Coursera React) with "View More (5 more)" button that expands to all 7 certificates.
  7. *Library Shelf Preview (`src/components/Library.jsx`)*: "Library" header with "View All →" link leading to `/#/library`. Displays total book count and reading count. Horizontal snap-scrolling carousel of book covers with progress bars.
  8. *Contact (`src/components/Contact.jsx`)*: Form with fields for Name, Email, and Message, and a "Send Message" submit button.
- **Interactions**:
  - Tapping hamburger opens drop-down menu.
  - Tapping theme toggle flips `#f9f9f9` to `#030712`.
  - Tapping any project live demo opens external site in new tab.
  - Tapping any certificate opens the Certificate Modal Viewer.
  - Swiping the book carousel scrolls horizontally through covers.
- **Feedback & Animations**:
  - Lenis smooth scroll inertia on wheel/touch.
  - Scroll-triggered reveal animations (`data-animate` with translateY and opacity fade in `src/index.css#L57-L64`).
  - Active button scale transitions (`active:scale-95`).
- **States**:
  - Contact form: `isSending` shows spinner in button; success renders green confirmation text; error renders red error message (`src/components/Contact.jsx#L94-L103`).

### Screen 2: Public Library & Shelf (`/#/library` & `/#/stats`)
- **Top to Bottom**:
  1. *Top Bar*: "← Back to Home" link and theme switch.
  2. *Header*: "My Library" or "Game Logs", subtitle, and two pill buttons: "Bookshelf (51)" and "Games (0)" (`src/pages/LibraryPage.jsx#L788-L793`).
  3. *Books Tab*:
     - 4 Stat tiles: "Total Books" (51), "Completed" (34), "Reading" (0), "Avg Rating" (4.8).
     - "Reading Progress" widget with SVG circular progress ring (67%) and status legend.
     - "Top Authors" frequency list with Stephanie Garber (6), Rebecca Ross (4), Lynn Painter (4), etc.
     - "Favorites" horizontal cover reel with badge labels.
     - "All Books" filter bar: Status pills ("All Books", "Reading", "Completed", "Want to Read", "Favorites") and horizontal scrolling genre chips (50+ genre tags).
     - Responsive grid of book cards with covers, status tags, titles, authors, star ratings, and progress bars.
  4. *Games Tab*:
     - 4 Stat tiles: "Finished Games" (0), "Total Hours" (0 hrs), "Avg Rating" (0.0 / 10), "Platforms" (1).
     - Recharts analytics cards: Rating distribution bar chart, Finished by year bar chart, Top genres distribution.
     - Platform filter pill bar ("All", plus detected platforms).
     - Empty state banner with game controller illustration and "No games logged yet" copy.
- **States**:
  - Loading: If live Firebase data is fetching, spinners appear.
  - Empty: When no games are logged, fallback state displays "No games logged yet" with explanation.

### Screen 3: Book Detail Modal (`src/components/library/BookModal.jsx`)
- **Visuals**: Center dialog with backdrop blur (`bg-black/50 backdrop-blur-sm`).
- **Top to Bottom**:
  1. `3:2` aspect cover artwork with close button (`X`) top-right.
  2. Book title (`font-display font-bold text-xl`) and author.
  3. Heart icon if marked favorite.
  4. 5-star rating visualizer.
  5. Status badge (e.g. green "Completed", blue "Reading", amber "To Read") and percentage indicator.
  6. Progress bar track (`h-2 rounded-full`).
  7. Genre pill tags in soft pink accents.
- **Interactions**: Tapping backdrop or `X` closes modal.

### Screen 4: Certificate Modal Viewer (`src/components/Certificates.jsx#L142-L227`)
- **Visuals**: Fullscreen centered overlay modal rendered via React portal.
- **Content**:
  - Header with certificate title, issuer, "Open ↗" button, and Close `X` button.
  - If PDF: Warning banner noting "PDF preview blank or not loading on mobile? View / Download PDF" with direct download button, followed by an `iframe` element (`h-[55vh]` on mobile, `h-[70vh]` on desktop).
  - If Image: Centered responsive image container.
- **Interactions**: Tapping close or pressing Escape restores background scrolling and closes viewer.

### Screen 5: Login Page (`/#/login`)
- **Visuals**: Narrow column container (`max-w-md`), centered card with dark mode toggle top-right and "Back to Portfolio" top-left.
- **Fields**:
  - Email Address input (`type="email"`).
  - Password input (`type="password"`).
  - "Sign In" button with loading spinner when submitting.
- **Error States**: Inline red banner for `auth/invalid-credential`, `auth/too-many-requests`, and `auth/network-request-failed` (`src/pages/LoginPage.jsx#L36-L44`).

### Screen 6: Owner Diary — Games Page (`/#/app/games`)
*(Verified via code analysis and local authenticated mock execution)*
- **Top to Bottom**:
  1. *Header (`src/components/navigation/BottomTabs.jsx#L50-L99`)*: Title "Games Diary" with pulsing green active dot indicator. User email display, JSON Data Backup export download button (`BsDownload`), Theme toggle, and Sign Out button (`BsBoxArrowRight`).
  2. *Toolbar (`src/pages/app/GamesPage.jsx#L304-L343`)*: Title "Games Logged", subtitle, "Pull from Database" (cloud download), "Push to Cloud" (sync), and "+ Log Game" action button.
  3. *Stats Row (`src/pages/app/GamesPage.jsx#L360-L385`)*: 3 stat tiles for Finished count, Hours count, and Average Rating / 10.
  4. *Filter Bar*: Status tabs: "All", "Finished", "Playing", "Backlog".
  5. *Games Grid*: 1-col on mobile, 2-col on tablet, 3-col on desktop. Cards show cover image (or placeholder controller), status badge, rating badge, title, platform, hours played, genres, finished date, Edit pencil button, and Delete trash button.
  6. *Add/Edit Modal*:
     - Debounced live auto-search field (RAWG / CheapShark / Wikipedia search).
     - Search results list with thumbnail, release year, and genres. Tapping auto-populates fields.
     - Manual input fields: Title, Status, Platform, Rating (0-10), Hours Played, Date Finished, Genres, Cover URL, and Private Review textarea (stored in private Firestore subcollection).
  7. *Bottom Navigation Bar*: 4 tabs (`Games`, `Books`, `Stats`, `Portfolio`).

### Screen 7: Owner Diary — Books Page (`/#/app/books`)
*(Verified via code analysis and local authenticated mock execution)*
- **Top to Bottom**:
  1. *Header*: Identical top bar with backup export and theme toggle.
  2. *Toolbar (`src/pages/app/BooksPage.jsx#L295-L350`)*: "Books Collection" title, Bookmory Markdown Import button (`.md` file selector), "Sync to Cloud", "Pull from Cloud", and "+ Log Book" button.
  3. *Stats Row*: Reading, Completed, Want to Read, Total Pages read.
  4. *Status Filter*: "All", "Reading", "Completed", "To Read".
  5. *Books Grid*: Cards show book cover, favorite heart, rating, progress bar, current page / total pages, Edit button, Delete button, and **"Start Timer" (`BsClock`) button**.
  6. *Add/Edit Modal*:
     - Debounced live Open Library / iTunes book search.
     - Manual fields: Title, Author, Total Pages, Current Page, Status, Rating (1-5), Genres, Cover URL, Favorite checkbox, and Private Notes.

### Screen 8: Reading Timer Modal (`src/components/books/ReadingTimerModal.jsx`)
*(Verified via code analysis)*
- **Visuals**: Fullscreen centered modal overlay over the Books diary.
- **Components**:
  - Live digital stopwatch readout (`HH:MM:SS`) with large bold numbers.
  - Control buttons: Play / Start, Pause, and Finish Session.
  - Background persistence in `localStorage`: If the user refreshes or switches tabs, elapsed time continues calculating from timestamp.
  - Finish Session form: Inputs for starting page (`fromPage`) and ending page (`toPage`), calculating pages read and estimated reading speed (pages/hour).
  - "Save Session" button: Writes record to Firestore subcollection `readingSessions`.
  - Recent reading history list showing past timestamps, duration, and page intervals.

---

## 4. Key User Flows

### Flow 1: Browsing the Public Portfolio
- **Goal**: Read about Ralph, inspect projects, view skills, and check certifications.
- **Steps**:
  1. Load `/#/` (1 tap / initial entry).
  2. Tap hamburger menu icon on mobile (1 tap).
  3. Tap "Projects" link (1 tap). View scrolls smoothly down to `#projects`.
  4. Tap "View Live Site" icon on *Echoverse* or *PReDiCT* (1 tap). Opens target website in new tab.
  5. Scroll to "Certificates" section. Tap "View More (5 more)" (1 tap). List expands from 2 to 7 items.
  6. Tap on "AWS Cloud Solutions" (1 tap). Modal viewer pops open displaying PDF viewer.
  7. Tap "Close" icon or tap backdrop (1 tap). Returns to portfolio view.
- **Total Taps**: ~7 taps.

### Flow 2: Viewing Public Library & Gaming Stats
- **Goal**: Browse Ralph's 51 books and inspect completed game stats.
- **Steps**:
  1. From homepage, scroll to Library section and tap "View All →" (1 tap) OR navigate to `/#/library`.
  2. Arrive at `/library` displaying bookshelf stats (51 books, 34 completed, 67% progress ring).
  3. Tap on "Romance" genre pill (1 tap). Grid filters down immediately.
  4. Tap book card "A Curse for True Love" (1 tap). Modal opens showing cover art, rating, progress bar, and tags.
  5. Tap "X" to close (1 tap).
  6. Tap "Games (0)" tab button at top (1 tap).
  7. View shifts to "Game Logs", rendering analytics charts (Rating distribution, Finished by year, Top genres) and game cards (or empty state banner if 0 entries).
  8. Tap "← Back to Home" (1 tap). Returns to `/#/portfolio`.
- **Total Taps**: 6–7 taps.

### Flow 3: Logging a Game (Owner Diary Flow)
- **Goal**: Log a newly completed game into the personal diary.
- **Steps**:
  1. Navigate to `/login` (via hamburger menu "Open Diary App" or direct URL `/#/app/games`).
  2. Type Email and Password; tap "Sign In" (1 tap + keyboard entry).
  3. Redirected to `/#/app/games`.
  4. Tap "+ Log Game" button (1 tap). Add Game modal opens.
  5. Type "Hollow Knight" into the search field (1 tap + typing).
  6. Auto-search debounces (350ms) and displays search results list.
  7. Tap the matching result row (1 tap). Form auto-populates title, platform, release year, genres, and cover art URL.
  8. Enter Hours Played (e.g. "35") and select Rating (e.g. "9.5") (2 taps + typing).
  9. Type private reflections in "Private Review" notes box (1 tap + typing).
  10. Tap "Save Game Entry" (1 tap).
  11. Data saves to Firebase Firestore; modal closes; card appears in the grid immediately.
- **Total Taps**: ~8–9 taps.

### Flow 4: Reading Timer & Session Logging (Owner Diary Flow)
- **Goal**: Track a live reading session for an in-progress book.
- **Steps**:
  1. From `/#/app/games`, tap the "Books" tab in bottom navigation (1 tap).
  2. Find book marked "Reading" in the list; tap the Clock icon ("Start Timer") (1 tap).
  3. `ReadingTimerModal` appears with big stopwatch display.
  4. Tap "Start Reading" button (1 tap). Stopwatch begins counting seconds.
  5. (User reads book).
  6. Tap "Pause" or "Finish Session" (1 tap).
  7. Finish form expands asking for "Ending Page" (e.g. page 142) (1 tap + typing).
  8. Modal automatically computes pages read and reading velocity.
  9. Tap "Save Session" (1 tap).
  10. Session commits to cloud database, updates book current page progress, and displays in session history.
- **Total Taps**: ~6 taps.

### Flow 5: Contacting Ralph
- **Goal**: Send a direct message to Ralph via the contact form.
- **Steps**:
  1. Scroll down to `#contact` section on home portfolio.
  2. Tap "Name" input; type name (1 tap + typing).
  3. Tap "Email" input; type email address (1 tap + typing).
  4. Tap "Message" textarea; type message (1 tap + typing).
  5. Tap "Send Message" button (1 tap).
  6. Button shows spinning indicator with text "Sending...".
  7. On response from EmailJS, form resets and green text appears: "✓ Message sent successfully!" (auto-dismisses after 5 seconds).
- **Total Taps**: 4 taps + typing.

---

## 5. Look and Feel

### Color Palette

| Token / Usage | Light Mode Value | Dark Mode Value | Context / CSS Class |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `#f9f9f9` | `#030712` / `#0b0f19` | `bg-background` / `dark:bg-gray-950` (`tailwind.config.js#L11`) |
| **Surface / Card** | `#ffffff` | `#111827` (`bg-gray-900`) | `bg-surface` / `dark:bg-gray-900` |
| **Border** | `#e5e5e5` (`#e5e7eb`) | `#1f2937` (`border-gray-800`) | `border-border` / `dark:border-gray-800` |
| **Primary Text** | `#1a1a1a` | `#f3f4f6` (`text-gray-100`) | `text-primary` / `dark:text-gray-100` |
| **Secondary Text** | `#666666` | `#9ca3af` (`text-gray-400`) | `text-secondary` / `dark:text-gray-400` |
| **Rating / Accent Gold**| `#f59e0b` / `#fbbf24` | `#fbbf24` | Stars & ratings in book/game cards |
| **Completed Green** | `#10b981` / `#dcfce7` | `#064e3b` / `#34d399` | Finished status pill and active status dot |
| **Reading Blue** | `#3b82f6` / `#dbeafe` | `#1e3a8a` / `#60a5fa` | Reading status badge |
| **Want to Read Amber** | `#f59e0b` / `#fef3c7` | `#78350f` / `#fbbf24` | To Read status badge |
| **Tag Accent Pink** | `#ec4899` / `#fdf2f8` | `#831843` / `#f472b6` | Book genre chips and favorite hearts |

### Typography & Sizes
- **Body Font**: `"DM Sans"`, system-ui, sans-serif (`tailwind.config.js#L18`, self-hosted via `@fontsource/dm-sans` in `src/main.jsx`).
- **Heading / Display Font**: `"Outfit"`, system-ui, sans-serif (`tailwind.config.js#L19`, self-hosted via `@fontsource/outfit` in `src/main.jsx`).
- **Type Scale**:
  - `Hero H1`: `text-4xl md:text-5xl` (36px - 48px), bold, tracking tight.
  - `Section H2`: `text-lg` (18px), semi-bold, uppercase tracking wider (`tracking-wider`).
  - `Card Titles`: `text-base` / `text-sm` (14px - 16px), medium/semi-bold.
  - `Body / Descriptions`: `text-sm` (14px), leading relaxed (`leading-relaxed`).
  - `Badges & Captions`: `text-xs` (12px) and `text-[10px]`.

### Spacing & Layout
- Main container: `max-w-3xl` (768px max width) with horizontal padding `px-6`.
- Borders: Distinctive vertical side borders `border-x border-dashed border-border dark:border-gray-800` flanking the central column on desktop.
- Spacing between sections: `py-8` to `py-16`.

### Corner Radius & Elevation
- Avatar: Custom `rounded-[30%]` organic squircle shape.
- Cards: `rounded-2xl` (16px) for modals and stat cards; `rounded-lg` (8px) for project and certificate cards.
- Pills & Buttons: `rounded-full` for chips and tab indicators.
- Elevation: `shadow-sm` on rest, elevating to `shadow-md` on hover; dark mode relies on subtle borders (`border-gray-800`) and removes heavy drop shadows.

### Mood in One Sentence
> *The interface delivers a restrained, bookish, and tactile editorial feel that seamlessly balances a clean monochrome engineering resume with an intimate, personal media diary.*

---

## 6. Mobile Feel & Ergonomics (~390px Viewport)

| Ergonomic Factor | Mobile Experience Assessment | Evidence / Reference |
| :--- | :--- | :--- |
| **Thumb Reachability** | **High in Diary App, Mixed in Portfolio**. In the Diary app (`/app/*`), bottom navigation tabs (`h-14`) and primary actions sit within immediate thumb sweep. On the public portfolio, primary navigation requires reaching the top-right hamburger icon. | `src/components/navigation/BottomTabs.jsx#L107-L133`, `src/components/Layout.jsx#L136-L144` |
| **Tap Target Sizes** | **Good (>=40px)**. Nav toggle is `p-2` with `w-5 h-5` icon (~40x40px). Buttons like "View More" and "Toggle Dark Mode" have comfortable touch paddings. Smallest targets are genre tag pills (approx 28px height). | `src/components/Layout.jsx#L129, L139` |
| **Horizontal Overflow** | **No sideways bleed on pages**. The root layout specifies `overflow-x: hidden` / responsive column widths (`max-w-3xl w-full`). Carousels (`src/components/Library.jsx` and genre chips) scroll horizontally with scrollbars hidden. | Verified live at 390px width. |
| **Keyboard Behavior** | Forms (`Contact.jsx`, `LoginPage.jsx`, `GamesPage.jsx` modal) use standard HTML inputs. Input focus rings trigger `focus:ring-2 focus:ring-primary/20`. On small mobile viewports, opening keyboard inside the Add Game modal requires scrolling inside `max-h-[90vh] overflow-y-auto`. | `src/pages/app/GamesPage.jsx#L520` |
| **Safe Areas & Notches** | **Needs refinement**. Fixed bottom navigation (`BottomTabs.jsx#L107`) uses `py-1.5 px-4` without explicit `env(safe-area-inset-bottom)` padding, meaning on modern iPhones and Android gesture bars, the lower tabs may sit close to the home bar. | `src/components/navigation/BottomTabs.jsx#L107` |
| **Web vs Native Feel** | The public portfolio feels like a polished, high-end editorial website. When in `/app/*` with bottom tabs, it successfully mimics a native mobile application, especially when running inside the Capacitor Android APK. | `capacitor.config.json`, `src/App.jsx#L81-L85` |

---

## 7. Friction, Polish & Accessibility

### Friction Points & Inconsistencies

1. **Active Tab State Desynchronization on `/library` vs `/stats`**:
   - `App.jsx` defines separate routes: `<Route path="/library" ... initialTab="books" />` and `<Route path="/stats" ... initialTab="games" />`.
   - In `src/pages/LibraryPage.jsx#L82`, `activeTab` is initialized as `useState(initialTab)`.
   - **Bug / Friction**: When a user is on `/library` and navigates directly to `/stats` (e.g. via the bottom navigation bar "Stats" tab), React does not remount `LibraryPage` and there is no `useEffect` updating `activeTab`. As a result, navigating to `/stats` leaves the view showing the Bookshelf until the user manually taps the "Games" button.
2. **Missing Bottom Bar on Public Subpages**:
   - In `/app/games` and `/app/books`, the bottom bar has a "Stats" tab leading to `/stats`.
   - Once on `/stats` (or `/library`), the bottom bar disappears completely because `LibraryPage` does not wrap with `BottomTabs`. The user only has a text link "Back to Home". To get back to the Diary app, they must go Home and then tap the floating pill or hamburger menu.
3. **Certificate PDF Viewer on Mobile**:
   - Native mobile browsers often fail to render raw PDF files inside HTML `iframe` tags.
   - *Polish Note*: The developer anticipated this and provided an explicit amber warning banner with a direct "View / Download PDF" button (`src/components/Certificates.jsx#L194-L214`), resolving what would otherwise be a blank frame.
4. **Mouse Pixel Trail on Mobile Touch**:
   - The interactive canvas effect (`PixelTrail`) is disabled on fine pointer touch screens (`!screenSize.lessThan('md') && window.matchMedia('(pointer: fine)').matches` in `src/components/Layout.jsx#L83`), preventing touch gesture conflicts.

### Accessibility Audit

| Area | Status | Observations |
| :--- | :--- | :--- |
| **Color Contrast** | **Pass** | Dark mode text (`#f3f4f6`) against `#030712` exceeds 14:1. Light mode `#1a1a1a` on `#f9f9f9` exceeds 15:1. Secondary text `#666666` meets WCAG AA for body text. |
| **Focus Rings** | **Pass** | Global stylesheet defines `*:focus-visible` with `outline-2 outline-offset-2 outline-primary/50 dark:outline-gray-400` (`src/index.css#L38-L40`). |
| **Screen Reader Labels** | **Good** | Icon buttons include `aria-label` (e.g. `aria-label="Toggle Dark Mode"`, `aria-label="Close navigation menu"`). Contact inputs utilize `sr-only` labels. |
| **Alt Text on Imagery** | **Good** | Avatar includes `alt="Ralph Dulla's profile photo"`. Book covers include `alt={book.title}`. Certificates include `alt={selectedCert.title}`. |
| **Tap Highlight Blink** | **Polished** | Global `-webkit-tap-highlight-color: transparent` configured to prevent gray flash on mobile taps (`src/index.css#L43-L45`). |

---

## 8. Screenshot Index

All screenshots captured live at native scale and stored in `screenshots/`:

| Screenshot File | Description | Viewport |
| :--- | :--- | :--- |
| `screenshots/mobile_portfolio_hero.png` | Public portfolio top view, avatar, social icons, and intro | 390 x 844 |
| `screenshots/mobile_portfolio_dark.png` | Public portfolio hero in dark mode (`#030712`) | 390 x 844 |
| `screenshots/mobile_menu_open.png` | Mobile hamburger dropdown navigation menu | 390 x 844 |
| `screenshots/mobile_library_books.png` | Public library bookshelf tab with reading progress ring & authors | 390 x 844 |
| `screenshots/mobile_stats_games_active.png` | Public library games tab showing ratings & year charts | 390 x 844 |
| `screenshots/mobile_book_modal.png` | Book details popup modal with progress bar and genres | 390 x 844 |
| `screenshots/mobile_certificate_modal.png` | Certificate modal with mobile PDF fallback banner | 390 x 844 |
| `screenshots/mobile_contact.png` | Contact form section on mobile | 390 x 844 |
| `screenshots/mobile_login.png` | Owner Diary authentication login screen | 390 x 844 |
| `screenshots/desktop_portfolio_hero.png` | Full desktop hero view with side pixel trail effect | 1280 x 800 |
| `screenshots/desktop_library_books.png` | Full desktop bookshelf view with dual-column analytics | 1280 x 800 |
| `screenshots/desktop_stats_games.png` | Full desktop gaming analytics charts and platform filters | 1280 x 800 |
