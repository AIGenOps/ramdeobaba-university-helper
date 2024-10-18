# Ramdeobaba University Helper (RBU / RKNEC PYQ Archive)

A high-performance, modern question paper archive explorer and helper for Ramdeobaba University (formerly Shri Ramdeobaba College of Engineering and Management, RKNEC), Nagpur.

Indexed over **11,000+ past examination papers** across B.Tech, M.Tech, MCA, MBA, and first-year common courses.

---

## Features

- **Department & Semester Explorer**: Clean, uncluttered academic interface organized by Program, Department, and Semester.
- **Quick-Jump Selector**: Instant 2-step dropdown selector on the homepage (`Choose Program -> Choose Department -> Go`) to jump straight to your syllabus without scrolling.
- **Context-Aware Scoped Search**:
  - Global search on the landing page across all university papers.
  - In-branch scoped search that filters within your department (e.g., searching `DBMS`, `OS`, `AI`, `Security` while inside CSE).
  - Typo-tolerance and automatic acronym expansion (e.g., `CN` &rarr; Computer Networks, `TOC` &rarr; Theory of Computation).
- **1-Click Paper Reader**:
  - Instant PDF modal reading without forced downloads.
  - Dual-engine viewer: Desktop native browser PDF renderer with fallback to PDF.js canvas viewer for smooth mobile viewing.
  - 1-click download icon for offline revision.
- **Subject-Centric Syllabus Drawer**:
  - Automatically groups year-over-year examination papers (Regular, Make-up, CBCS, and RBU Schemes) by subject title.
- **Zero-Login Starred Subjects**:
  - Bookmark your current semester subjects for instant access saved in browser `localStorage`.
- **Class Pack Sharing**:
  - Formatted WhatsApp & Telegram sharable class packs with one-click clipboard copy.
- **Mobile App Experience**:
  - Designed as a mobile app with native bottom navigation (`Home`, `Search`, `Starred`, `Share`), smooth gesture navigation, and touch-optimized controls.

---

## Project Structure

```
├── web/                           # Frontend Single Page Application (SPA)
│   ├── index.html                 # Main interface HTML
│   ├── app.js                     # SPA routing, search, rendering & state management
│   ├── style.css                  # Modern UI styled with official Ramdeobaba University palette
│   ├── pdf.min.js                 # PDF.js core library
│   ├── pdf.worker.min.js          # PDF.js web worker
│   └── references/                # Built-in offline formula sheets and examination aids
├── app_server.py                  # Local Python server streaming PDFs with HTTP Range support
├── build_catalog.py               # Crawler & parser for raw PYQ file hierarchies
├── build_compact_catalog.py       # Compact JSON & Gzip compression pipeline for catalog
├── catalog.json                   # Full paper catalog index
├── catalog.min.json               # Compact matrix-formatted catalog (< 2MB)
├── catalog.min.json.gz            # Gzipped catalog (~220 KB for fast loading)
├── pull_pyqs.py                   # Multi-threaded FTP crawler to download papers from library server
├── pyqs_manifest.json             # Manifest of all remote FTP paper paths and sizes
├── tracker_server.py              # Real-time WebSocket/HTTP download tracker server
└── tracker.html                   # Visual live download progress monitor
```

---

## Getting Started

### 1. Run the Web Application
No external node or python dependencies required (uses Python standard library):

```bash
python3 app_server.py
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 2. Download or Sync Question Papers (Optional)
To pull or update question papers directly from the university library FTP repository:

```bash
python3 pull_pyqs.py --threads 8
```
Papers will be downloaded into the `PYQs/` directory.

### 3. Rebuild the Catalog Index (Optional)
If new papers are added to `PYQs/`:

```bash
python3 build_catalog.py
python3 build_compact_catalog.py
```

---

## Design System

- **Primary Colors**: Official Ramdeobaba University palette (`#F36F27` RBU Orange, `#104474` Academic Navy Blue, `#00173c` Background).
- **Typography**: Clean system sans-serif hierarchy for maximum legibility and speed.
- **Zero-Emoji Policy**: Strict academic professional tone throughout all UI components.
