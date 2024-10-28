/**
 * Ramdeobaba University Question Papers — Client Application
 * Features:
 * 1. Subject-Centric Grouping (Year-over-Year History)
 * 2. Common Acronym & Typo-Tolerant Search
 * 4. Catalog Index Compression (< 400 KB)
 * 5. Mobile-Optimized PDF Viewer (PDF.js Canvas Fallback)
 * 6. Local Starred / Bookmarked Subjects (Zero-Login)
 */

// Common Engineering Acronym Mapping (Feature 2)
const ACRONYM_MAP = {
    "dbms": "database management systems",
    "os": "operating systems",
    "cn": "computer networks",
    "dsa": "data structures and algorithms",
    "ds": "data structures",
    "daa": "design and analysis of algorithms",
    "toc": "theory of computation",
    "flat": "formal languages and automata theory",
    "ai": "artificial intelligence",
    "ml": "machine learning",
    "dl": "deep learning",
    "se": "software engineering",
    "spm": "software project management",
    "oops": "object oriented programming",
    "oop": "object oriented programming",
    "cd": "compiler design",
    "cc": "compiler construction",
    "wt": "web technologies",
    "iot": "internet of things",
    "vlsi": "vlsi design",
    "dsp": "digital signal processing",
    "maths": "mathematics",
    "math": "mathematics",
    "m1": "mathematics i",
    "m2": "mathematics ii",
    "m3": "mathematics iii",
    "m4": "mathematics iv",
    "coa": "computer organization and architecture",
    "ca": "computer architecture",
    "dc": "data communication",
    "crypto": "cryptography",
    "cyber": "cyber security",
    "bme": "biomedical engineering",
    "edc": "electronic devices and circuits",
    "lic": "linear integrated circuits",
    "emft": "electromagnetic field theory",
    "ee": "electrical engineering",
    "me": "mechanical engineering",
    "ce": "civil engineering"
};

// Known engineering acronyms & Roman numerals to preserve uppercase in Title Case
const KNOWN_UPPERCASE = new Set([
    "AI", "ML", "DSA", "DBMS", "OS", "CN", "TOC", "CD", "SE", "DLD", "COA", "CA", "DAA",
    "FLAT", "OOP", "OOPS", "API", "IOT", "IIOT", "NLP", "CV", "VLSI", "DSP", "CAD", "CAM",
    "HVAC", "BEE", "RBU", "RTMNU", "CBCS", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"
]);

const MINOR_WORDS = new Set([
    "and", "or", "of", "for", "to", "in", "on", "at", "by", "with", "from", "a", "an", "the"
]);

// Consolidates duplicate scan suffixes and scanner typos
function getCanonicalSubjectTitle(title) {
    if (!title) return "";
    let clean = title
        .replace(/[\x96–—]/g, "-")
        .replace(/[\s\-_]+(?:\([0-9]+\)|[0-9]+)\s*$/i, "")
        .replace(/\s+/g, " ")
        .trim();

    // Canonicalize scanner typos and common singular/plural variations
    clean = clean
        .replace(/\bCOMPLIER\b/gi, "COMPILER")
        .replace(/\bRELAIBILITY\b/gi, "RELIABILITY")
        .replace(/\bENTEPRENEURSHIP\b/gi, "ENTREPRENEURSHIP")
        .replace(/\bELECTRONICS DEVICES\b/gi, "ELECTRONIC DEVICES")
        .replace(/\bCONTROL SYSTEMS\b/gi, "CONTROL SYSTEM")
        .replace(/\bOPERATING SYSTEMS\b/gi, "OPERATING SYSTEM")
        .replace(/\bDATABASE MANAGEMENT SYSTEMS\b/gi, "DATABASE MANAGEMENT SYSTEM")
        .replace(/\bDATA STRUCTURES? AND ALGORITHMS?\b/gi, "DATA STRUCTURES & ALGORITHMS")
        .replace(/\bCOMPUTER NETWORKS\b/gi, "COMPUTER NETWORK");

    return clean;
}

function formatSemestersList(semSet, defaultSem) {
    if (!semSet || semSet.size === 0) return defaultSem || "All Semesters";
    const arr = Array.from(semSet).filter(s => s && s !== "All Semesters" && s !== "All Sem");
    if (arr.length === 0) return defaultSem || "All Semesters";

    const numSem = [];
    const otherSem = [];
    arr.forEach(s => {
        const m = s.match(/Sem\s*([0-9]+)/i);
        if (m) numSem.push(parseInt(m[1], 10));
        else otherSem.push(s);
    });
    numSem.sort((a, b) => a - b);

    let parts = [];
    if (numSem.length > 2 && (numSem[numSem.length - 1] - numSem[0] === numSem.length - 1)) {
        parts.push(`Sem ${numSem[0]} – ${numSem[numSem.length - 1]}`);
    } else if (numSem.length > 0) {
        parts.push(numSem.map(n => `Sem ${n}`).join(", "));
    }
    if (otherSem.length > 0) {
        parts.push(otherSem.join(", "));
    }
    return parts.join(", ") || defaultSem || "All Semesters";
}

function toTitleCase(rawTitle) {
    if (!rawTitle) return "";
    const clean = rawTitle.replace(/[\x96–—]/g, "-").replace(/\s+/g, " ").trim();
    const words = clean.split(" ");
    return words.map((w, i) => {
        const match = w.match(/^([(\[\"\'\-\/]*)(.*?)([)\]\"\'.,:;\-\/]*)$/);
        if (!match) return w;
        const [, prefix, core, suffix] = match;
        if (!core) return w;
        const upper = core.toUpperCase();
        let cased;
        if (KNOWN_UPPERCASE.has(upper)) {
            cased = upper;
        } else if (i > 0 && MINOR_WORDS.has(core.toLowerCase())) {
            cased = core.toLowerCase();
        } else {
            cased = core.charAt(0).toUpperCase() + core.slice(1).toLowerCase();
        }
        return prefix + cased + suffix;
    }).join(" ");
}

// Hugging Face Global CDN for Question Papers Archive
const HF_DATASET_CDN = "https://huggingface.co/datasets/aigenops/rbu-pyqs/resolve/main";

function getPaperFileUrl(docPath) {
    const clean = encodeURIComponent(docPath).replace(/%2F/g, '/');
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        return `/PYQs/${clean}`;
    }
    return `${HF_DATASET_CDN}/${clean}`;
}

// Application State
const state = {
    allPapers: [],
    branchesList: [],
    activeDiscipline: "ALL",
    selectedBranch: null,       // { program, branch, count, semRange }
    filteredPapers: [],
    currentPage: 1,
    pageSize: 20,
    groupMode: "grouped",       // 'grouped' or 'flat' (Feature 1)
    branchFilterQuery: "",      // Quick filter within current branch
    branchFilters: {
        semester: "ALL",
        year: "ALL",
        type: "ALL",
        scheme: "ALL"
    },
    searchQuery: "",
    sortBy: "year-desc",
    currentReaderDoc: null,

    // Starred Subjects (Zero-Login Bookmarks)
    starredSubjects: new Set(),

    // PDF.js Canvas Viewer State
    pdfDoc: null,
    pdfPageNum: 1,
    pdfScale: 1.2,
    viewerEngine: "native"       // 'native' or 'canvas'
};

// DOM Cache
const dom = {};

document.addEventListener("DOMContentLoaded", () => {
    cacheDom();
    loadStarredSubjects();
    bindEvents();
    bindTouchAndGestureNavigation();
    bindGlobalLinkInterceptor();
    initViewerEngine();
    loadCatalog();
    window.addEventListener("popstate", () => {
        syncStateFromUrl();
    });
});

function cacheDom() {
    dom.searchInput = document.getElementById("search-input");
    dom.clearSearch = document.getElementById("clear-search");
    dom.suggestionBar = document.getElementById("search-suggestion-bar");
    dom.suggestionText = document.getElementById("suggestion-text");

    dom.navStarredBtn = document.getElementById("nav-starred-btn");
    dom.navStarredCount = document.getElementById("nav-starred-count");
    dom.starredShelf = document.getElementById("starred-shelf");
    dom.starredCardsGrid = document.getElementById("starred-cards-grid");

    // Mobile Bottom App Bar
    dom.mobileBottomBar = document.getElementById("mobile-bottom-bar");
    dom.mobileStarredBadge = document.getElementById("mobile-starred-badge");
    dom.tabHome = document.getElementById("tab-home");
    dom.tabSearch = document.getElementById("tab-search");
    dom.tabStarred = document.getElementById("tab-starred");
    dom.tabShare = document.getElementById("tab-share");

    // Views
    dom.categoryView = document.getElementById("category-view");
    dom.explorerView = document.getElementById("explorer-view");
    dom.categoryTabs = document.getElementById("category-tabs");
    dom.branchesGrid = document.getElementById("branches-grid");

    // Explorer view
    dom.breadProgram = document.getElementById("bread-program");
    dom.breadBranch = document.getElementById("bread-branch");
    dom.explorerBranchTitle = document.getElementById("explorer-branch-title");
    dom.semesterPills = document.getElementById("semester-pills");
    dom.groupToggle = document.getElementById("group-toggle");
    dom.schemeSelect = document.getElementById("scheme-select");
    dom.typeSelect = document.getElementById("type-select");
    dom.yearSelect = document.getElementById("year-select");
    dom.sortSelect = document.getElementById("sort-select");
    dom.branchFilterInput = document.getElementById("branch-filter-input");

    // Quick Jump Dropdown Selectors
    dom.quickJumpStrip = document.getElementById("quick-jump-strip");
    dom.quickProgramSelect = document.getElementById("quick-program-select");
    dom.quickBranchSelect = document.getElementById("quick-branch-select");
    dom.quickGoBtn = document.getElementById("quick-go-btn");

    dom.resultsCount = document.getElementById("results-count");
    dom.subjectsContainer = document.getElementById("subjects-container");
    dom.emptyState = document.getElementById("empty-state");

    dom.pagination = document.getElementById("pagination");
    dom.prevPage = document.getElementById("prev-page");
    dom.nextPage = document.getElementById("next-page");
    dom.pageNumbers = document.getElementById("page-numbers");

    // Modal
    dom.modal = document.getElementById("reader-modal");
    dom.modalTitle = document.getElementById("modal-title");
    dom.modalMeta = document.getElementById("modal-meta");
    dom.modalOpenTab = document.getElementById("modal-open-tab");
    dom.modalDownload = document.getElementById("modal-download");
    dom.modalClose = document.getElementById("modal-close");
    dom.modalAidBtn = document.getElementById("modal-aid-btn");
    dom.viewerToggleBtn = document.getElementById("viewer-toggle-btn");
    dom.viewerToggleLabel = document.getElementById("viewer-toggle-label");
    dom.modalIframe = document.getElementById("modal-iframe");
    dom.modalPrevPaper = document.getElementById("modal-prev-paper");
    dom.modalNextPaper = document.getElementById("modal-next-paper");

    // Share Class Pack Modal (Feature 6)
    dom.shareModal = document.getElementById("share-modal");
    dom.shareModalTitle = document.getElementById("share-modal-title");
    dom.shareModalSub = document.getElementById("share-modal-sub");
    dom.shareTextArea = document.getElementById("share-text-area");
    dom.shareCopyBtn = document.getElementById("share-copy-btn");
    dom.shareCopyLabel = document.getElementById("share-copy-label");
    dom.shareWhatsappBtn = document.getElementById("share-whatsapp-btn");
    dom.shareTelegramBtn = document.getElementById("share-telegram-btn");

    // Canvas viewer
    dom.canvasToolbar = document.getElementById("canvas-toolbar");
    dom.canvasViewerWrap = document.getElementById("canvas-viewer-wrap");
    dom.pdfRenderCanvas = document.getElementById("pdf-render-canvas");
    dom.pdfPageNumIndicator = document.getElementById("pdf-page-num");
    dom.pdfZoomText = document.getElementById("pdf-zoom-text");
    dom.pdfPrevBtn = document.getElementById("pdf-prev-btn");
    dom.pdfNextBtn = document.getElementById("pdf-next-btn");
}

function bindEvents() {
    // Search input (debounced with Acronym & Typo Tolerance)
    let searchTimeout;
    dom.searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        const val = e.target.value.trim();
        dom.clearSearch.style.display = val ? "flex" : "none";
        searchTimeout = setTimeout(() => {
            state.searchQuery = val.toLowerCase();
            state.currentPage = 1;
            handleSearchChange();
        }, 120);
    });

    dom.clearSearch.addEventListener("click", () => {
        dom.searchInput.value = "";
        dom.clearSearch.style.display = "none";
        dom.suggestionBar.style.display = "none";
        state.searchQuery = "";
        state.currentPage = 1;
        handleSearchChange();
        dom.searchInput.focus();
    });

    // Category Discipline Tabs
    dom.categoryTabs.addEventListener("click", (e) => {
        const btn = e.target.closest(".filter-pill");
        if (!btn) return;
        const discipline = btn.dataset.discipline;
        const url = discipline === "ALL" ? "/" : `/?discipline=${encodeURIComponent(discipline)}`;
        navigate(url, { push: true });
    });

    // Grouping Mode Switcher (Feature 1: Subject-Centric vs Flat)
    if (dom.groupToggle) {
        dom.groupToggle.addEventListener("click", (e) => {
            const btn = e.target.closest(".toggle-btn");
            if (!btn) return;
            dom.groupToggle.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.groupMode = btn.dataset.mode;
            state.currentPage = 1;
            renderCurrentContent();
        });
    }

    if (dom.schemeSelect) {
        dom.schemeSelect.addEventListener("change", (e) => {
            state.branchFilters.scheme = e.target.value;
            state.currentPage = 1;
            applyBranchFilters();
        });
    }

    if (dom.typeSelect) {
        dom.typeSelect.addEventListener("change", (e) => {
            state.branchFilters.type = e.target.value;
            state.currentPage = 1;
            applyBranchFilters();
        });
    }

    if (dom.yearSelect) {
        dom.yearSelect.addEventListener("change", (e) => {
            state.branchFilters.year = e.target.value;
            state.currentPage = 1;
            applyBranchFilters();
        });
    }

    if (dom.sortSelect) {
        dom.sortSelect.addEventListener("change", (e) => {
            state.sortBy = e.target.value;
            sortFilteredPapers();
            renderCurrentContent();
        });
    }

    if (dom.branchFilterInput) {
        let branchFilterTimeout;
        dom.branchFilterInput.addEventListener("input", (e) => {
            clearTimeout(branchFilterTimeout);
            const val = e.target.value.trim();
            branchFilterTimeout = setTimeout(() => {
                state.branchFilterQuery = val.toLowerCase();
                state.currentPage = 1;
                renderCurrentContent();
                updateResultsMeta();
            }, 100);
        });
    }

    // Quick Jump Dropdown Selectors
    if (dom.quickProgramSelect) {
        dom.quickProgramSelect.addEventListener("change", (e) => {
            const prog = e.target.value;
            if (!prog) {
                dom.quickBranchSelect.innerHTML = '<option value="">2. Choose Department...</option>';
                dom.quickBranchSelect.disabled = true;
                dom.quickGoBtn.disabled = true;
                return;
            }
            const branches = state.branchesList.filter(b => b.program === prog);
            let bHtml = `<option value="">2. Choose Department (${branches.length})...</option>`;
            branches.sort((a, b) => a.branch.localeCompare(b.branch)).forEach(b => {
                bHtml += `<option value="${escapeHtml(b.key)}">${escapeHtml(b.branch)}</option>`;
            });
            dom.quickBranchSelect.innerHTML = bHtml;
            dom.quickBranchSelect.disabled = false;
            dom.quickGoBtn.disabled = true;
        });
    }

    if (dom.quickBranchSelect) {
        dom.quickBranchSelect.addEventListener("change", (e) => {
            dom.quickGoBtn.disabled = !e.target.value;
        });
    }

    if (dom.quickGoBtn) {
        dom.quickGoBtn.addEventListener("click", () => {
            const key = dom.quickBranchSelect.value;
            if (key) {
                selectBranch(key);
            }
        });
    }

    // Share modal click outside
    if (dom.shareModal) {
        dom.shareModal.addEventListener("click", (e) => {
            if (e.target === dom.shareModal) closeShareModal();
        });
    }

    // Pagination
    dom.prevPage.addEventListener("click", () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            renderCurrentContent();
            scrollToGridTop();
        }
    });

    dom.nextPage.addEventListener("click", () => {
        const totalItems = (state.groupMode === "grouped") ? getSubjectGroups().length : state.filteredPapers.length;
        const maxPage = Math.ceil(totalItems / state.pageSize);
        if (state.currentPage < maxPage) {
            state.currentPage++;
            renderCurrentContent();
            scrollToGridTop();
        }
    });

    // Modal close
    dom.modalClose.addEventListener("click", closeReader);
    dom.modal.addEventListener("click", (e) => {
        if (e.target === dom.modal) closeReader();
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (dom.shareModal && dom.shareModal.style.display !== "none") {
                closeShareModal();
            } else if (dom.modal.style.display !== "none") {
                closeReader();
            } else if (dom.searchInput.value) {
                dom.searchInput.value = "";
                dom.clearSearch.style.display = "none";
                dom.suggestionBar.style.display = "none";
                state.searchQuery = "";
                handleSearchChange();
            } else if (state.selectedBranch) {
                returnToCategories();
            }
        }
        if (e.key === "/" && document.activeElement !== dom.searchInput) {
            e.preventDefault();
            dom.searchInput.focus();
        }
    });
}

// ==========================================================================
// FEATURE 4: CATALOG INDEX COMPRESSION & UNPACKING (< 400 KB)
// ==========================================================================

async function loadCatalog() {
    try {
        let res = null;
        try {
            res = await fetch("./catalog.min.json");
            if (!res.ok) res = null;
        } catch (e) {}

        if (!res) {
            try {
                res = await fetch("/catalog.min.json");
                if (!res.ok) res = null;
            } catch (e) {}
        }

        if (!res) {
            res = await fetch("https://huggingface.co/datasets/aigenops/rbu-pyqs/resolve/main/catalog.min.json");
        }

        if (!res || !res.ok) throw new Error("Failed to load catalog");
        const data = await res.json();

        // Check if compact schema with lookups
        if (data.lookup && data.items) {
            const { p, b, s, ty, se } = data.lookup;
            state.allPapers = data.items.map(row => ({
                id: row[0],
                title: row[1],
                code: row[2],
                program: p[row[3]],
                branch: b[row[4]],
                sem: s[row[5]],
                type: ty[row[6]],
                session: se[row[7]],
                year: row[8],
                size_kb: row[9],
                path: row[10]
            }));
        } else {
            state.allPapers = data;
        }

        aggregateBranches();
        setupQuickJump();
        renderBranches();
        renderStarredShelf();
        syncStateFromUrl();
    } catch (err) {
        console.error("Catalog load error", err);
    }
}

function setupQuickJump() {
    if (!dom.quickProgramSelect) return;
    const progSet = new Set();
    state.branchesList.forEach(b => progSet.add(b.program));
    const sortedProgs = Array.from(progSet).sort();
    let progHtml = '<option value="">1. Choose Program...</option>';
    sortedProgs.forEach(prog => {
        progHtml += `<option value="${escapeHtml(prog)}">${escapeHtml(getProgramDisplayLabel(prog))}</option>`;
    });
    dom.quickProgramSelect.innerHTML = progHtml;
}

function aggregateBranches() {
    const map = new Map();

    state.allPapers.forEach(p => {
        const key = `${p.program}::${p.branch}`;
        if (!map.has(key)) {
            let discipline = "BE";
            const prog = p.program;
            const bLow = p.branch.toLowerCase();

            if (bLow.includes("first year") || bLow.includes("elective") || bLow.includes("multi-disciplinary") || bLow.includes("honors")) {
                discipline = "COMMON";
            } else if (prog === "M. TECH") {
                discipline = "MTECH";
            } else if (prog === "MCA" || prog === "BCA" || prog === "RBU MCA") {
                discipline = "CA";
            } else if (prog === "MBA" || prog === "BBA" || prog === "MBA(INTEGRATED)" || prog === "RBU MBA") {
                discipline = "MGMT";
            } else {
                discipline = "BE";
            }

            map.set(key, {
                key: key,
                program: p.program,
                branch: p.branch,
                discipline: discipline,
                count: 0,
                semesters: new Set(),
                years: new Set()
            });
        }

        const bInfo = map.get(key);
        bInfo.count++;
        if (p.sem && p.sem !== "All Semesters") bInfo.semesters.add(p.sem);
        if (p.year > 2000) bInfo.years.add(p.year);
    });

    state.branchesList = Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function getProgramDisplayLabel(program) {
    if (program === "B. E") return "B.Tech / B.E";
    if (program === "M. TECH") return "M.Tech";
    if (program === "MBA(INTEGRATED)") return "Integrated MBA";
    return program;
}

function renderBranches() {
    const disc = state.activeDiscipline;
    const filtered = state.branchesList.filter(b => {
        if (disc === "ALL") return true;
        return b.discipline === disc;
    });

    let html = "";
    filtered.forEach(b => {
        const semArray = Array.from(b.semesters).sort();
        let semRangeText = "All Semesters";
        if (semArray.length > 0) {
            semRangeText = `${semArray[0]} – ${semArray[semArray.length - 1]}`;
            if (semArray.length === 1) semRangeText = semArray[0];
        }

        html += `
            <a href="/?branch=${encodeURIComponent(b.key)}" class="department-card" data-branch="${escapeHtml(b.key)}">
                <div class="dept-card-top">
                    <div class="dept-badge-row">
                        <span class="dept-program-tag">${getProgramDisplayLabel(b.program)}</span>
                    </div>

                    <h3 class="dept-name">${escapeHtml(b.branch)}</h3>

                    <div class="dept-meta">
                        <span>${semRangeText}</span>
                    </div>
                </div>

                <div class="dept-card-footer">
                    <span class="dept-count">${b.count.toLocaleString()} Question Papers</span>
                    <span class="dept-action-link">
                        Browse
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </span>
                </div>
            </a>
        `;
    });

    dom.branchesGrid.innerHTML = html;
}

// ==========================================================================
// FEATURE 6: LOCAL STARRED / BOOKMARKED SUBJECTS (ZERO-LOGIN)
// ==========================================================================

function loadStarredSubjects() {
    try {
        const saved = localStorage.getItem("rbu_starred_subjects");
        if (saved) {
            const arr = JSON.parse(saved);
            state.starredSubjects = new Set(arr);
        }
    } catch (e) {
        state.starredSubjects = new Set();
    }
    updateStarredUI();
}

function saveStarredSubjects() {
    try {
        const arr = Array.from(state.starredSubjects);
        localStorage.setItem("rbu_starred_subjects", JSON.stringify(arr));
    } catch (e) {}
    updateStarredUI();
    renderStarredShelf();
}

function toggleStarSubject(e, subjectTitle, branch, sem) {
    e.stopPropagation();
    const starKey = `${branch}::${subjectTitle}`;
    if (state.starredSubjects.has(starKey)) {
        state.starredSubjects.delete(starKey);
    } else {
        state.starredSubjects.add(starKey);
    }
    saveStarredSubjects();
    renderCurrentContent();
}

function updateStarredUI() {
    const count = state.starredSubjects.size;
    if (dom.navStarredBtn && dom.navStarredCount) {
        if (count > 0) {
            dom.navStarredBtn.style.display = "inline-flex";
            dom.navStarredCount.textContent = `Starred (${count})`;
        } else {
            dom.navStarredBtn.style.display = "none";
        }
    }
    if (dom.mobileStarredBadge) {
        if (count > 0) {
            dom.mobileStarredBadge.style.display = "flex";
            dom.mobileStarredBadge.textContent = count;
        } else {
            dom.mobileStarredBadge.style.display = "none";
        }
    }
}

function renderStarredShelf() {
    if (!dom.starredShelf || !dom.starredCardsGrid) return;
    const count = state.starredSubjects.size;
    if (count === 0) {
        dom.starredShelf.style.display = "none";
        return;
    }

    dom.starredShelf.style.display = "flex";
    let html = "";
    state.starredSubjects.forEach(key => {
        const [branch, title] = key.split("::");
        const bInfo = state.branchesList.find(b => b.branch === branch);
        const branchKey = bInfo ? encodeURIComponent(bInfo.key) : encodeURIComponent(branch);
        const jumpUrl = `/?branch=${branchKey}&q=${encodeURIComponent(title)}`;
        html += `
            <a href="${jumpUrl}" class="starred-chip" data-branch="${escapeHtml(branch)}" data-title="${escapeHtml(title)}">
                <div class="starred-chip-info">
                    <span class="starred-chip-title">${escapeHtml(title)}</span>
                    <span class="starred-chip-sub">${escapeHtml(branch)}</span>
                </div>
                <button type="button" class="starred-chip-unstar" onclick="unstarFromShelf(event, '${escapeHtml(key)}')" title="Remove from starred">&times;</button>
            </a>
        `;
    });
    dom.starredCardsGrid.innerHTML = html;
}

window.unstarFromShelf = function(e, key) {
    e.stopPropagation();
    state.starredSubjects.delete(key);
    saveStarredSubjects();
    renderStarredShelf();
    if (state.selectedBranch) renderCurrentContent();
};

window.jumpToStarredSubject = function(branch, title) {
    // Find branch info
    const bInfo = state.branchesList.find(b => b.branch === branch);
    if (bInfo) {
        selectBranch(bInfo.key);
        // Set search query or expand subject
        state.searchQuery = title.toLowerCase();
        dom.searchInput.value = title;
        dom.clearSearch.style.display = "flex";
        applyBranchFilters();
    }
};

window.showStarredShelf = function() {
    returnToCategories();
    setTimeout(() => {
        if (dom.starredShelf) dom.starredShelf.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
};

window.focusSearchInput = function() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
        if (dom.searchInput) dom.searchInput.focus();
    }, 200);
};

// ==========================================================================
// FEATURE 2: COMMON ACRONYM & TYPO-TOLERANT SEARCH
// ==========================================================================

function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function isFuzzyMatch(query, target) {
    if (!query || !target) return false;
    const q = query.toLowerCase();
    const t = target.toLowerCase();

    // Direct substring match
    if (t.includes(q)) return true;

    // Check words in target against query
    const targetWords = t.split(/[\s\-_,.:]+/);
    for (const w of targetWords) {
        if (w.length >= 4 && q.length >= 4) {
            const maxDist = (w.length > 6) ? 2 : 1;
            if (Math.abs(w.length - q.length) <= maxDist) {
                if (levenshtein(w, q) <= maxDist) return true;
            }
        }
    }
    return false;
}

function handleSearchChange() {
    const q = state.searchQuery.trim();

    // If inside a selected department, scope search to that department's subjects
    if (state.selectedBranch) {
        state.branchFilterQuery = q.toLowerCase();
        state.currentPage = 1;
        renderCurrentContent();
        updateResultsMeta();
        return;
    }

    if (q.length > 0) {
        // Check for acronym expansion
        let expandedQuery = q;
        if (ACRONYM_MAP[q]) {
            expandedQuery = ACRONYM_MAP[q];
            dom.suggestionText.textContent = `Acronym detected: ${q.toUpperCase()} &rarr; ${expandedQuery.toUpperCase()}`;
            dom.suggestionBar.style.display = "block";
        } else {
            dom.suggestionBar.style.display = "none";
        }

        dom.categoryView.style.display = "none";
        dom.explorerView.style.display = "flex";

        dom.breadProgram.textContent = "Search";
        dom.breadBranch.textContent = `"${q}"`;
        dom.explorerBranchTitle.textContent = `Search Results for "${q}"`;

        dom.semesterPills.innerHTML = `<button class="sem-btn active" data-sem="ALL">All Semesters</button>`;
        populateGlobalYears();

        applySearchFilters(expandedQuery);
    } else {
        dom.suggestionBar.style.display = "none";
        returnToCategories();
    }
}

function populateGlobalYears() {
    if (!dom.yearSelect) return;
    const years = new Set();
    state.allPapers.forEach(p => {
        if (p.year > 2000) years.add(p.year);
    });
    const sorted = Array.from(years).sort((a, b) => b - a);
    let options = `<option value="ALL">All Years</option>`;
    sorted.forEach(y => {
        options += `<option value="${y}">${y}</option>`;
    });
    dom.yearSelect.innerHTML = options;
}

function applySearchFilters(expandedQuery) {
    const q = state.searchQuery;
    const exp = expandedQuery || q;
    const { type, year, scheme } = state.branchFilters;

    state.filteredPapers = state.allPapers.filter(p => {
        // Matches exact query, acronym expansion, or typo-fuzzy match
        const titleMatch = isFuzzyMatch(q, p.title) || (exp !== q && isFuzzyMatch(exp, p.title));
        const codeMatch = p.code && p.code.toLowerCase().includes(q);
        const branchMatch = p.branch.toLowerCase().includes(q);
        const semMatch = p.sem.toLowerCase().includes(q);

        if (!titleMatch && !codeMatch && !branchMatch && !semMatch) return false;

        if (year !== "ALL" && String(p.year) !== String(year)) return false;
        if (type !== "ALL" && p.type !== type) return false;
        if (scheme !== "ALL") {
            const curScheme = getCurriculumScheme(p.year);
            if (curScheme.id !== scheme) return false;
        }
        return true;
    });

    sortFilteredPapers();
    updateResultsMeta();
    renderCurrentContent();
}

// ==========================================================================
// FEATURE 1: SUBJECT-CENTRIC GROUPING (YEAR-OVER-YEAR HISTORY)
// ==========================================================================

function getSubjectGroups() {
    const groupsMap = new Map();
    const subQuery = (state.branchFilterQuery || "").trim().toLowerCase();

    state.filteredPapers.forEach(p => {
        const canonicalRaw = getCanonicalSubjectTitle(p.title);
        const canonicalKey = canonicalRaw.toUpperCase();

        if (!groupsMap.has(canonicalKey)) {
            groupsMap.set(canonicalKey, {
                rawKey: canonicalKey,
                title: canonicalRaw,
                code: p.code || "",
                branch: p.branch,
                sem: p.sem,
                program: p.program,
                semesters: new Set(),
                papers: []
            });
        }
        const g = groupsMap.get(canonicalKey);
        g.papers.push(p);
        if (p.sem) g.semesters.add(p.sem);
        if (!g.code && p.code) g.code = p.code;
    });

    let groups = Array.from(groupsMap.values());

    // Apply quick filter on subjects if user searched inside branch
    if (subQuery) {
        const expQuery = ACRONYM_MAP[subQuery] || subQuery;
        groups = groups.filter(g => {
            const t = g.title.toLowerCase();
            const c = (g.code || "").toLowerCase();
            return isFuzzyMatch(subQuery, t) || isFuzzyMatch(expQuery, t) || c.includes(subQuery);
        });
    }

    // Sort papers within each subject by year descending, regular first
    groups.forEach(g => {
        g.papers.sort((a, b) => (b.year - a.year) || (a.type.localeCompare(b.type)));
    });

    // Sort subject groups
    if (state.sortBy === "title-asc") {
        groups.sort((a, b) => a.title.localeCompare(b.title));
    } else if (state.sortBy === "title-desc") {
        groups.sort((a, b) => b.title.localeCompare(a.title));
    } else {
        // Year desc: by latest available paper
        groups.sort((a, b) => (b.papers[0]?.year || 0) - (a.papers[0]?.year || 0) || a.title.localeCompare(b.title));
    }

    return groups;
}

function renderCurrentContent() {
    if (state.groupMode === "grouped") {
        renderSubjectGroups();
    } else {
        renderFlatPapers();
    }
}

function renderSubjectGroups() {
    const groups = getSubjectGroups();
    const total = groups.length;

    if (total === 0) {
        dom.subjectsContainer.innerHTML = "";
        dom.emptyState.style.display = "flex";
        dom.pagination.style.display = "none";
        return;
    }

    dom.emptyState.style.display = "none";
    dom.pagination.style.display = "flex";

    const start = (state.currentPage - 1) * state.pageSize;
    const end = Math.min(start + state.pageSize, total);
    const pageGroups = groups.slice(start, end);

    let html = "";
    pageGroups.forEach((group, idx) => {
        const displayTitle = toTitleCase(group.title);
        const starKey = `${group.branch}::${group.title}`;
        const isStarred = state.starredSubjects.has(starKey);
        const starClass = isStarred ? "starred" : "";

        // Determine year range
        const years = group.papers.map(p => p.year).filter(y => y > 2000);
        let yearSpanText = "";
        if (years.length > 0) {
            const minYear = Math.min(...years);
            const maxYear = Math.max(...years);
            yearSpanText = minYear === maxYear ? String(minYear) : `${minYear} – ${maxYear}`;
        }

        // Semesters display (clean range e.g. Sem 3 – Sem 6)
        const semText = formatSemestersList(group.semesters, group.sem);

        const bKey = state.selectedBranch ? encodeURIComponent(state.selectedBranch.key) : "";
        const semParam = (state.branchFilters && state.branchFilters.semester !== "ALL") ? `&sem=${encodeURIComponent(state.branchFilters.semester)}` : "";

        // Expanded drawer rows (One-click row to read online + quick download icon)
        let drawerRowsHtml = "";
        group.papers.forEach(p => {
            const fileUrl = getPaperFileUrl(p.path);
            const yr = p.year ? `${p.session} ${p.year}` : p.session;
            const scheme = getCurriculumScheme(p.year);
            const isReg = p.type === "Regular";
            let rowPaperUrl = "";
            if (bKey) {
                rowPaperUrl = `/?branch=${bKey}${semParam}&paper=${p.id}`;
            } else {
                const pBranchObj = state.branchesList.find(b => b.branch === p.branch && b.program === p.program);
                const pBranchKey = pBranchObj ? encodeURIComponent(pBranchObj.key) : encodeURIComponent(p.branch);
                rowPaperUrl = `/?branch=${pBranchKey}&paper=${p.id}`;
            }
            drawerRowsHtml += `
                <div class="session-paper-row" onclick="openReaderById(${p.id})">
                    <div class="session-paper-left">
                        <span class="exam-status-dot ${isReg ? 'dot-reg' : 'dot-makeup'}"></span>
                        <a href="${rowPaperUrl}" class="session-paper-name-link" onclick="handleLinkClick(event, '${rowPaperUrl}')">${escapeHtml(yr)} Examination</a>
                        <span class="exam-pill ${p.type}">${p.type}</span>
                        <span class="scheme-tag ${scheme.badgeClass}" title="${scheme.description}">${scheme.badge}</span>
                    </div>
                    <div class="session-paper-right">
                        <span class="paper-size">${p.size_kb} KB</span>
                        <a href="${fileUrl}" download="${escapeHtml(p.title)}.pdf" class="paper-download-icon-btn" onclick="event.stopPropagation()" title="Download PDF">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </a>
                    </div>
                </div>
            `;
        });

        const drawerId = `drawer-${idx}`;

        html += `
            <div class="subject-group-card" id="card-${drawerId}">
                <div class="subject-group-header" onclick="toggleSubjectDrawer('${drawerId}')">
                    <div class="subject-title-block">
                        <div class="subject-top-row">
                            <h4 class="subject-name">${escapeHtml(displayTitle)}</h4>
                            ${group.code ? `<span class="subject-code-tag">${escapeHtml(group.code)}</span>` : ''}
                        </div>

                        <div class="subject-sub-meta">
                            <span class="meta-sem-badge">${escapeHtml(semText)}</span>
                            <span class="meta-dot">&bull;</span>
                            <span>${group.papers.length} Past Paper${group.papers.length === 1 ? '' : 's'}</span>
                            ${yearSpanText ? `<span class="meta-dot">&bull;</span><span>${yearSpanText}</span>` : ''}
                        </div>
                    </div>

                    <div class="subject-header-actions" onclick="event.stopPropagation()">
                        <button class="star-btn ${starClass}" onclick="toggleStarSubject(event, '${escapeHtml(group.title)}', '${escapeHtml(group.branch)}', '${escapeHtml(semText)}')" title="${isStarred ? 'Remove from starred' : 'Star this subject for quick access'}">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            </svg>
                        </button>
                        <button class="expand-drawer-btn" onclick="toggleSubjectDrawer('${drawerId}')" id="btn-${drawerId}">
                            <span>View All (${group.papers.length})</span>
                            <svg class="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="subject-papers-drawer" id="${drawerId}" style="display: none;">
                    <div class="drawer-papers-list">
                        ${drawerRowsHtml}
                    </div>
                </div>
            </div>
        `;
    });

    dom.subjectsContainer.innerHTML = html;
    renderPagination(total);
}

window.toggleSubjectDrawer = function(drawerId) {
    const el = document.getElementById(drawerId);
    if (!el) return;
    const isClosed = el.style.display === "none";
    el.style.display = isClosed ? "flex" : "none";

    const card = document.getElementById(`card-${drawerId}`);
    if (card) {
        card.classList.toggle("drawer-open", isClosed);
    }
    const btn = document.getElementById(`btn-${drawerId}`);
    if (btn) {
        const chevron = btn.querySelector(".chevron-icon");
        if (chevron) {
            chevron.style.transform = isClosed ? "rotate(180deg)" : "rotate(0deg)";
        }
    }
};

function renderFlatPapers() {
    const total = state.filteredPapers.length;
    if (total === 0) {
        dom.subjectsContainer.innerHTML = "";
        dom.emptyState.style.display = "flex";
        dom.pagination.style.display = "none";
        return;
    }

    dom.emptyState.style.display = "none";
    dom.pagination.style.display = "flex";

    const start = (state.currentPage - 1) * state.pageSize;
    const end = Math.min(start + state.pageSize, total);
    const pageItems = state.filteredPapers.slice(start, end);

    let html = '<div class="papers-grid">';
    pageItems.forEach(item => {
        const fileUrl = getPaperFileUrl(item.path);
        const yearText = item.year ? `${item.session} ${item.year}` : item.session;
        const examLabel = item.type === "Make-Up" ? "Make-Up" : "Regular";
        const scheme = getCurriculumScheme(item.year);

        let paperUrl = "";
        if (state.selectedBranch) {
            const bKey = encodeURIComponent(state.selectedBranch.key);
            const semParam = (state.branchFilters && state.branchFilters.semester !== "ALL") ? `&sem=${encodeURIComponent(state.branchFilters.semester)}` : "";
            paperUrl = `/?branch=${bKey}${semParam}&paper=${item.id}`;
        } else {
            const pBranchObj = state.branchesList.find(b => b.branch === item.branch && b.program === item.program);
            const pBranchKey = pBranchObj ? encodeURIComponent(pBranchObj.key) : encodeURIComponent(item.branch);
            paperUrl = `/?branch=${pBranchKey}&paper=${item.id}`;
        }

        html += `
            <div class="paper-card" onclick="openReaderById(${item.id})">
                <div class="paper-card-body">
                    <div class="paper-meta-top">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span class="exam-pill ${item.type}">${examLabel}</span>
                            <span class="scheme-tag ${scheme.badgeClass}">${scheme.badge}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span class="paper-size">${item.size_kb} KB</span>
                            <a href="${fileUrl}" download="${escapeHtml(item.title)}.pdf" class="paper-download-icon-btn" onclick="event.stopPropagation()" title="Download PDF">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                            </a>
                        </div>
                    </div>

                    <h4 class="paper-title">
                        <a href="${paperUrl}" class="session-paper-name-link" onclick="handleLinkClick(event, '${paperUrl}')">${escapeHtml(toTitleCase(item.title))}</a>
                    </h4>

                    <div class="paper-sub-details">
                        <span>${escapeHtml(item.sem)} &bull; ${escapeHtml(yearText)}</span>
                        ${item.code ? `<span>Code: ${escapeHtml(item.code)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';

    dom.subjectsContainer.innerHTML = html;
    renderPagination(total);
}

function renderPagination(totalItems) {
    const maxPage = Math.ceil(totalItems / state.pageSize);
    if (maxPage <= 1) {
        dom.pagination.style.display = "none";
        return;
    }
    dom.pagination.style.display = "flex";

    const current = state.currentPage;
    const bKey = state.selectedBranch ? encodeURIComponent(state.selectedBranch.key) : "";
    const semParam = (state.branchFilters && state.branchFilters.semester !== "ALL") ? `&sem=${encodeURIComponent(state.branchFilters.semester)}` : "";
    const baseQs = bKey ? `/?branch=${bKey}${semParam}` : "/?";

    dom.prevPage.href = (current > 1) ? `${baseQs}&page=${current - 1}` : "#";
    dom.prevPage.classList.toggle("disabled", current <= 1);
    dom.prevPage.setAttribute("aria-disabled", current <= 1 ? "true" : "false");

    dom.nextPage.href = (current < maxPage) ? `${baseQs}&page=${current + 1}` : "#";
    dom.nextPage.classList.toggle("disabled", current >= maxPage);
    dom.nextPage.setAttribute("aria-disabled", current >= maxPage ? "true" : "false");

    let html = "";
    const delta = 2;
    const range = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(maxPage - 1, current + delta); i++) {
        range.push(i);
    }

    if (current - delta > 2) range.unshift("...");
    if (current + delta < maxPage - 1) range.push("...");

    range.unshift(1);
    if (maxPage > 1) range.push(maxPage);

    range.forEach(p => {
        if (p === "...") {
            html += `<span style="padding: 0 4px; color: var(--text-subtle);">&hellip;</span>`;
        } else {
            const isAct = (p === current) ? "active" : "";
            const pageUrl = `${baseQs}&page=${p}`;
            html += `<a href="${pageUrl}" class="num-btn ${isAct}" data-page="${p}">${p}</a>`;
        }
    });

    dom.pageNumbers.innerHTML = html;
}

window.goToPage = function(pageNum) {
    state.currentPage = pageNum;
    renderCurrentContent();
    scrollToGridTop();
};

function scrollToGridTop() {
    dom.resultsCount.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Branch Selection
window.selectBranch = function(key, { pushHistory = true } = {}) {
    if (pushHistory) {
        navigate(`/?branch=${encodeURIComponent(key)}`, { push: true });
        return;
    }
    const bInfo = state.branchesList.find(b => b.key === key);
    if (!bInfo) return;

    state.selectedBranch = bInfo;
    state.branchFilters = { semester: "ALL", year: "ALL", type: "ALL", scheme: "ALL" };
    state.branchFilterQuery = "";
    if (dom.branchFilterInput) dom.branchFilterInput.value = "";
    if (dom.searchInput) {
        dom.searchInput.value = "";
        dom.searchInput.placeholder = `Search inside ${bInfo.branch} (e.g. DBMS, AI, OS)...`;
        if (dom.clearSearch) dom.clearSearch.style.display = "none";
    }
    state.currentPage = 1;

    dom.categoryView.style.display = "none";
    dom.explorerView.style.display = "flex";

    dom.breadProgram.textContent = getProgramDisplayLabel(bInfo.program);
    dom.breadProgram.href = `/?discipline=${encodeURIComponent(bInfo.discipline)}`;
    dom.breadBranch.textContent = bInfo.branch;
    dom.explorerBranchTitle.textContent = bInfo.branch;

    setupSemesterPills(bInfo);
    setupYearDropdown(bInfo);

    if (dom.typeSelect) dom.typeSelect.value = "ALL";
    if (dom.yearSelect) dom.yearSelect.value = "ALL";
    if (dom.schemeSelect) dom.schemeSelect.value = "ALL";

    applyBranchFilters();
    window.scrollTo({ top: 0, behavior: "smooth" });
};

function setupSemesterPills(bInfo) {
    const sems = Array.from(bInfo.semesters).sort();
    const curSem = (state.branchFilters && state.branchFilters.semester) ? state.branchFilters.semester : "ALL";
    const bKey = encodeURIComponent(bInfo.key);
    let html = `<a href="/?branch=${bKey}" class="sem-btn ${curSem === 'ALL' ? 'active' : ''}" data-sem="ALL">All Semesters</a>`;
    sems.forEach(s => {
        const isAct = curSem === s ? "active" : "";
        html += `<a href="/?branch=${bKey}&sem=${encodeURIComponent(s)}" class="sem-btn ${isAct}" data-sem="${escapeHtml(s)}">${escapeHtml(s)}</a>`;
    });
    dom.semesterPills.innerHTML = html;
}

function setupYearDropdown(bInfo) {
    if (!dom.yearSelect) return;
    const years = Array.from(bInfo.years).sort((a, b) => b - a);
    let options = `<option value="ALL">All Years</option>`;
    years.forEach(y => {
        options += `<option value="${y}">${y}</option>`;
    });
    dom.yearSelect.innerHTML = options;
}

window.returnToCategories = function({ pushHistory = true } = {}) {
    if (pushHistory) {
        const disc = state.activeDiscipline || "ALL";
        navigate(disc !== "ALL" ? `/?discipline=${encodeURIComponent(disc)}` : "/", { push: true });
        return;
    }
    state.selectedBranch = null;
    state.searchQuery = "";
    state.branchFilterQuery = "";
    if (dom.branchFilterInput) dom.branchFilterInput.value = "";
    if (dom.searchInput) {
        dom.searchInput.value = "";
        dom.searchInput.placeholder = "Search by subject, code, or acronym (e.g. DBMS, OS, Mathematics)...";
        if (dom.clearSearch) dom.clearSearch.style.display = "none";
    }
    if (dom.suggestionBar) dom.suggestionBar.style.display = "none";

    dom.explorerView.style.display = "none";
    dom.categoryView.style.display = "flex";
    renderStarredShelf();
    window.scrollTo({ top: 0, behavior: "smooth" });
};

function applyBranchFilters() {
    const bInfo = state.selectedBranch;
    if (!bInfo) return;

    const { semester, year, type, scheme } = state.branchFilters;

    state.filteredPapers = state.allPapers.filter(p => {
        if (p.program !== bInfo.program || p.branch !== bInfo.branch) return false;
        if (semester !== "ALL" && p.sem !== semester) return false;
        if (year !== "ALL" && String(p.year) !== String(year)) return false;
        if (type !== "ALL" && p.type !== type) return false;
        if (scheme !== "ALL") {
            const curScheme = getCurriculumScheme(p.year);
            if (curScheme.id !== scheme) return false;
        }
        return true;
    });

    sortFilteredPapers();
    updateResultsMeta();
    renderCurrentContent();
}

function sortFilteredPapers() {
    switch (state.sortBy) {
        case "year-desc":
            state.filteredPapers.sort((a, b) => (b.year - a.year) || a.title.localeCompare(b.title));
            break;
        case "year-asc":
            state.filteredPapers.sort((a, b) => (a.year - b.year) || a.title.localeCompare(b.title));
            break;
        case "title-asc":
            state.filteredPapers.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case "title-desc":
            state.filteredPapers.sort((a, b) => b.title.localeCompare(a.title));
            break;
    }
}

window.resetBranchFilters = function() {
    state.branchFilters = { semester: "ALL", year: "ALL", type: "ALL", scheme: "ALL" };
    state.branchFilterQuery = "";
    if (dom.branchFilterInput) dom.branchFilterInput.value = "";
    if (dom.searchInput && state.selectedBranch) {
        dom.searchInput.value = "";
        if (dom.clearSearch) dom.clearSearch.style.display = "none";
    }
    if (dom.semesterPills) {
        dom.semesterPills.querySelectorAll(".sem-btn").forEach(b => {
            b.classList.toggle("active", b.dataset.sem === "ALL");
        });
    }
    if (dom.typeSelect) dom.typeSelect.value = "ALL";
    if (dom.yearSelect) dom.yearSelect.value = "ALL";
    if (dom.schemeSelect) dom.schemeSelect.value = "ALL";
    state.currentPage = 1;
    applyBranchFilters();
};

function updateResultsMeta() {
    const total = state.filteredPapers.length;
    const subjectsCount = getSubjectGroups().length;
    if (state.groupMode === "grouped") {
        dom.resultsCount.textContent = `${subjectsCount.toLocaleString()} subjects (${total.toLocaleString()} past examination papers)`;
    } else {
        dom.resultsCount.textContent = `${total.toLocaleString()} examination papers`;
    }
}

// ==========================================================================
// FEATURE 5: MOBILE-OPTIMIZED PDF VIEWER (PDF.JS CANVAS FALLBACK)
// ==========================================================================

function initViewerEngine() {
    const isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || window.innerWidth <= 768;
    state.viewerEngine = isMobile ? "canvas" : "native";

    if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.min.js";
    }
}

window.toggleViewerEngine = function() {
    state.viewerEngine = (state.viewerEngine === "native") ? "canvas" : "native";
    dom.viewerToggleLabel.textContent = (state.viewerEngine === "native") ? "Mobile Mode" : "Native Mode";
    if (state.currentReaderDoc) {
        loadDocumentInViewer(state.currentReaderDoc);
    }
};

window.openReaderById = function(id) {
    const doc = state.allPapers.find(p => p.id === id);
    if (!doc) return;
    openReader(doc, { updateUrl: true });
};

function openReader(doc, { updateUrl = true } = {}) {
    state.currentReaderDoc = doc;
    const fileUrl = getPaperFileUrl(doc.path);

    dom.modalTitle.textContent = doc.title + (doc.code ? ` (${doc.code})` : "");
    const yearText = doc.year ? `${doc.session} ${doc.year}` : doc.session;
    dom.modalMeta.textContent = `${doc.program} • ${doc.branch} • ${doc.sem} • ${yearText} (${doc.type})`;

    dom.modalOpenTab.href = fileUrl;
    dom.modalDownload.href = fileUrl;
    dom.modalDownload.download = `${doc.title}.pdf`;

    // Feature 10: Check for supplementary exam aids
    const aid = getSubjectSupplementaryAids(doc.title);
    if (dom.modalAidBtn) {
        if (aid && aid.available) {
            dom.modalAidBtn.style.display = "inline-flex";
            dom.modalAidBtn.title = `View ${aid.category}: ${aid.aidName}`;
        } else {
            dom.modalAidBtn.style.display = "none";
        }
    }

    updateReaderNavButtons(doc);

    dom.viewerToggleLabel.textContent = (state.viewerEngine === "native") ? "Mobile Mode" : "Native Mode";
    dom.modal.style.display = "flex";
    document.body.style.overflow = "hidden";

    loadDocumentInViewer(doc);

    if (updateUrl) {
        const params = new URLSearchParams(window.location.search);
        params.set("paper", doc.id);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.pushState({ paperId: doc.id }, "", newUrl);
    }
}

function loadDocumentInViewer(doc) {
    const fileUrl = getPaperFileUrl(doc.path);

    if (state.viewerEngine === "canvas" && window.pdfjsLib) {
        // Hide iframe, show canvas toolbar & wrap
        dom.modalIframe.style.display = "none";
        dom.canvasToolbar.style.display = "flex";
        dom.canvasViewerWrap.style.display = "flex";

        state.pdfPageNum = 1;
        state.pdfScale = window.innerWidth <= 640 ? 0.75 : 1.1;

        pdfjsLib.getDocument(fileUrl).promise.then(pdf => {
            state.pdfDoc = pdf;
            dom.pdfPageNumIndicator.textContent = `Page 1 of ${pdf.numPages}`;
            renderCanvasPage(1);
        }).catch(err => {
            console.error("PDF.js render error, falling back to native iframe", err);
            // Fallback to native iframe
            state.viewerEngine = "native";
            loadDocumentInViewer(doc);
        });

    } else {
        // Native iframe viewer
        dom.canvasToolbar.style.display = "none";
        dom.canvasViewerWrap.style.display = "none";
        dom.modalIframe.style.display = "block";
        dom.modalIframe.src = fileUrl + "#toolbar=1&navpanes=0";
    }
}

function renderCanvasPage(num) {
    if (!state.pdfDoc) return;
    state.pdfDoc.getPage(num).then(page => {
        const canvas = dom.pdfRenderCanvas;
        const ctx = canvas.getContext("2d");

        // On mobile, auto-calculate scale to fit width if at default zoom
        if (window.innerWidth <= 640 && state.pdfScale <= 0.8) {
            const containerWidth = dom.canvasViewerWrap.clientWidth || (window.innerWidth - 20);
            const unscaled = page.getViewport({ scale: 1.0 });
            if (unscaled.width > 0) {
                state.pdfScale = Math.max(0.35, Math.min(1.0, (containerWidth - 12) / unscaled.width));
            }
        }

        const viewport = page.getViewport({ scale: state.pdfScale });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.height = Math.floor(viewport.height * dpr);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        page.render(renderContext);

        dom.pdfPageNumIndicator.textContent = `Page ${num} of ${state.pdfDoc.numPages}`;
        dom.pdfZoomText.textContent = `${Math.round(state.pdfScale * 100)}%`;
        dom.pdfPrevBtn.disabled = (num <= 1);
        dom.pdfNextBtn.disabled = (num >= state.pdfDoc.numPages);
    });
}

window.prevCanvasPage = function() {
    if (state.pdfPageNum <= 1) return;
    state.pdfPageNum--;
    renderCanvasPage(state.pdfPageNum);
};

window.nextCanvasPage = function() {
    if (!state.pdfDoc || state.pdfPageNum >= state.pdfDoc.numPages) return;
    state.pdfPageNum++;
    renderCanvasPage(state.pdfPageNum);
};

window.zoomCanvas = function(delta) {
    const newScale = Math.max(0.4, Math.min(3.0, state.pdfScale + delta));
    state.pdfScale = newScale;
    renderCanvasPage(state.pdfPageNum);
};

window.resetCanvasZoom = function() {
    if (!state.pdfDoc) return;
    state.pdfDoc.getPage(state.pdfPageNum).then(page => {
        const containerWidth = dom.canvasViewerWrap.clientWidth || (window.innerWidth - 20);
        const unscaled = page.getViewport({ scale: 1.0 });
        if (unscaled.width > 0) {
            state.pdfScale = Math.max(0.35, Math.min(1.2, (containerWidth - 12) / unscaled.width));
        } else {
            state.pdfScale = 1.0;
        }
        renderCanvasPage(state.pdfPageNum);
    });
};

function updateReaderNavButtons(doc) {
    if (!doc || !dom.modalPrevPaper || !dom.modalNextPaper) return;

    const currentSubjectTitle = getCanonicalSubjectTitle(doc.title).toUpperCase();
    const branchName = doc.branch;
    const subjectPapers = state.allPapers.filter(p =>
        p.branch === branchName &&
        getCanonicalSubjectTitle(p.title).toUpperCase() === currentSubjectTitle
    );
    subjectPapers.sort((a, b) => (b.year - a.year) || a.type.localeCompare(b.type));

    const currentIndex = subjectPapers.findIndex(p => p.id === doc.id);
    if (currentIndex === -1) {
        dom.modalPrevPaper.disabled = true;
        dom.modalNextPaper.disabled = true;
        return;
    }

    dom.modalPrevPaper.disabled = (currentIndex <= 0);
    dom.modalNextPaper.disabled = (currentIndex >= subjectPapers.length - 1);

    if (currentIndex > 0) {
        const pDoc = subjectPapers[currentIndex - 1];
        dom.modalPrevPaper.title = `Previous: ${pDoc.session} ${pDoc.year} (${pDoc.type}) [ [ ]`;
    } else {
        dom.modalPrevPaper.title = "No newer papers for this subject";
    }

    if (currentIndex < subjectPapers.length - 1) {
        const nDoc = subjectPapers[currentIndex + 1];
        dom.modalNextPaper.title = `Next: ${nDoc.session} ${nDoc.year} (${nDoc.type}) [ ] ]`;
    } else {
        dom.modalNextPaper.title = "No older papers for this subject";
    }
}

window.navPaperRelative = function(delta) {
    if (!state.currentReaderDoc) return;
    const currentSubjectTitle = getCanonicalSubjectTitle(state.currentReaderDoc.title).toUpperCase();
    const branchName = state.currentReaderDoc.branch;
    const subjectPapers = state.allPapers.filter(p =>
        p.branch === branchName &&
        getCanonicalSubjectTitle(p.title).toUpperCase() === currentSubjectTitle
    );
    subjectPapers.sort((a, b) => (b.year - a.year) || a.type.localeCompare(b.type));

    const currentIndex = subjectPapers.findIndex(p => p.id === state.currentReaderDoc.id);
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + delta;
    if (targetIndex >= 0 && targetIndex < subjectPapers.length) {
        const nextDoc = subjectPapers[targetIndex];
        openReader(nextDoc, { updateUrl: true });
    }
};

function closeReader({ updateUrl = true } = {}) {
    dom.modal.style.display = "none";
    dom.modalIframe.src = "about:blank";
    if (dom.modalAidBtn) dom.modalAidBtn.style.display = "none";
    document.body.style.overflow = "auto";
    state.currentReaderDoc = null;
    state.pdfDoc = null;

    if (updateUrl) {
        const params = new URLSearchParams(window.location.search);
        if (params.has("paper")) {
            params.delete("paper");
            const qs = params.toString();
            const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
            window.history.pushState({}, "", newUrl);
        }
    }
}

// ==========================================================================
// SPA ROUTER, HISTORY MANAGEMENT & DEEP LINK SYNCHRONIZER
// ==========================================================================

function resolveAppUrl(url) {
    const basePath = window.location.pathname;
    if (url === "/" || !url) return basePath;
    if (url.startsWith("/?")) return `${basePath}?${url.slice(2)}`;
    if (url.startsWith("?")) return `${basePath}${url}`;
    return url;
}

window.navigate = function(url, { push = true } = {}) {
    const targetUrl = resolveAppUrl(url);
    if (push) {
        window.history.pushState({}, "", targetUrl);
    } else {
        window.history.replaceState({}, "", targetUrl);
    }
    syncStateFromUrl();
};

window.historyBack = function() {
    window.history.back();
};

window.historyForward = function() {
    window.history.forward();
};

window.handleLinkClick = function(event, url) {
    if (event) {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
            return;
        }
        event.preventDefault();
    }
    navigate(url, { push: true });
};

window.handleCrumbDisciplineClick = function(event) {
    if (event) {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
            return;
        }
        event.preventDefault();
    }
    const disc = state.selectedBranch ? state.selectedBranch.discipline : "ALL";
    navigate(`/?discipline=${encodeURIComponent(disc)}`, { push: true });
};

function updateUrlParams() {
    const params = new URLSearchParams();
    if (state.selectedBranch) {
        params.set("branch", state.selectedBranch.key);
        if (state.branchFilters.semester && state.branchFilters.semester !== "ALL") {
            params.set("sem", state.branchFilters.semester);
        }
        if (state.currentPage > 1) {
            params.set("page", state.currentPage);
        }
    } else if (state.activeDiscipline && state.activeDiscipline !== "ALL") {
        params.set("discipline", state.activeDiscipline);
    }
    if (state.currentReaderDoc) {
        params.set("paper", state.currentReaderDoc.id);
    }
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
}

function syncStateFromUrl() {
    if (!state.branchesList || state.branchesList.length === 0) return;

    const params = new URLSearchParams(window.location.search);

    // 1. Search Query
    if (params.has("q") && params.get("q").trim().length > 0) {
        const query = params.get("q").trim();
        state.searchQuery = query.toLowerCase();
        dom.searchInput.value = query;
        dom.clearSearch.style.display = "flex";
        handleSearchChange();
        return;
    }

    // 2. Branch Exploration View
    if (params.has("branch")) {
        const branchKey = params.get("branch");
        const bInfo = state.branchesList.find(b => b.key === branchKey);
        if (bInfo) {
            const isBranchChange = !state.selectedBranch || state.selectedBranch.key !== bInfo.key;
            state.selectedBranch = bInfo;

            dom.categoryView.style.display = "none";
            dom.explorerView.style.display = "flex";

            dom.breadProgram.textContent = getProgramDisplayLabel(bInfo.program);
            dom.breadProgram.href = `/?discipline=${encodeURIComponent(bInfo.discipline)}`;
            dom.breadBranch.textContent = bInfo.branch;
            dom.explorerBranchTitle.textContent = bInfo.branch;

            // Semester filter
            const sem = params.get("sem") || "ALL";
            state.branchFilters.semester = sem;

            // Page
            const pageNum = parseInt(params.get("page") || "1", 10);
            state.currentPage = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum;

            if (isBranchChange) {
                setupSemesterPills(bInfo);
                setupYearDropdown(bInfo);
                if (dom.typeSelect) dom.typeSelect.value = "ALL";
                if (dom.yearSelect) dom.yearSelect.value = "ALL";
                if (dom.schemeSelect) dom.schemeSelect.value = "ALL";
                if (dom.searchInput) {
                    dom.searchInput.placeholder = `Search inside ${bInfo.branch} (e.g. DBMS, AI, OS)...`;
                }
            } else {
                dom.semesterPills.querySelectorAll(".sem-btn").forEach(b => {
                    b.classList.toggle("active", b.dataset.sem === sem);
                });
            }

            applyBranchFilters();

            // Paper Reader Modal
            if (params.has("paper")) {
                const paperId = parseInt(params.get("paper"), 10);
                const doc = state.allPapers.find(p => p.id === paperId);
                if (doc) {
                    if (!state.currentReaderDoc || state.currentReaderDoc.id !== doc.id) {
                        openReader(doc, { updateUrl: false });
                    }
                }
            } else {
                if (state.currentReaderDoc) {
                    closeReader({ updateUrl: false });
                }
            }

            // Open specific drawer if requested
            if (params.has("open")) {
                const drawerId = `drawer-${params.get("open")}`;
                const el = document.getElementById(drawerId);
                if (el && el.style.display === "none") {
                    toggleSubjectDrawer(drawerId);
                }
            }

            // Open share modal if requested
            if (params.has("share")) {
                setTimeout(() => openClassPackModal(), 80);
            }

            return;
        }
    }

    // 3. Departments / Categories View (Home)
    if (state.currentReaderDoc) {
        closeReader({ updateUrl: false });
    }
    if (state.selectedBranch || dom.explorerView.style.display !== "none") {
        state.selectedBranch = null;
        state.searchQuery = "";
        dom.searchInput.value = "";
        dom.clearSearch.style.display = "none";
        dom.suggestionBar.style.display = "none";
        dom.explorerView.style.display = "none";
        dom.categoryView.style.display = "flex";
    }

    const discipline = params.get("discipline") || "ALL";
    state.activeDiscipline = discipline;
    dom.categoryTabs.querySelectorAll(".filter-pill").forEach(b => {
        b.classList.toggle("active", b.dataset.discipline === discipline);
    });
    renderBranches();
    renderStarredShelf();
}

function bindGlobalLinkInterceptor() {
    document.addEventListener("click", (e) => {
        // Allow middle clicks, right clicks, and modifier keys (Ctrl/Cmd/Shift/Alt) for native browser tab behavior
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
            return;
        }

        const anchor = e.target.closest("a");
        if (!anchor) return;

        // Ignore disabled links
        if (anchor.classList.contains("disabled") || anchor.getAttribute("aria-disabled") === "true") {
            e.preventDefault();
            return;
        }

        const href = anchor.getAttribute("href");
        if (!href || href === "#" || href.startsWith("javascript:")) {
            if (href === "#") e.preventDefault();
            return;
        }

        // Ignore external links and downloads
        if (anchor.target === "_blank" || anchor.hasAttribute("download") || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
            return;
        }

        // Internal SPA navigation link (starts with "/" or "?")
        if (href.startsWith("/") || href.startsWith("?")) {
            e.preventDefault();
            navigate(href, { push: true });
        }
    });
}

function bindTouchAndGestureNavigation() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isHeaderTouch = false;

    window.addEventListener("touchstart", (e) => {
        if (!e.touches || e.touches.length !== 1) return;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();

        const target = e.target;
        isHeaderTouch = Boolean(target.closest(".reader-modal-bar") || target.closest(".reader-modal-window"));
    }, { passive: true });

    window.addEventListener("touchend", (e) => {
        if (!e.changedTouches || e.changedTouches.length !== 1) return;
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        const duration = Date.now() - touchStartTime;

        if (duration > 650) return;

        // 1. Modal Dismiss Gesture: Swipe Down on modal header
        if (dom.modal && dom.modal.style.display !== "none" && isHeaderTouch) {
            if (deltaY > 80 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
                closeReader();
                return;
            }
        }
    }, { passive: true });

    // Mouse thumb buttons (button 3 = Back, button 4 = Forward)
    window.addEventListener("mouseup", (e) => {
        if (e.button === 3) {
            e.preventDefault();
            window.history.back();
        } else if (e.button === 4) {
            e.preventDefault();
            window.history.forward();
        }
    });

    // Keyboard Shortcuts
    document.addEventListener("keydown", (e) => {
        const isInputActive = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);

        // Alt + Left Arrow or Backspace outside text input -> Back
        if ((e.altKey && e.key === "ArrowLeft") || (!isInputActive && e.key === "Backspace")) {
            e.preventDefault();
            window.history.back();
            return;
        }

        // Alt + Right Arrow -> Forward
        if (e.altKey && e.key === "ArrowRight") {
            e.preventDefault();
            window.history.forward();
            return;
        }

        // If reader modal is open:
        if (dom.modal && dom.modal.style.display !== "none") {
            if (e.key === "[" || (e.ctrlKey && e.key === "ArrowLeft")) {
                e.preventDefault();
                navPaperRelative(-1);
                return;
            }
            if (e.key === "]" || (e.ctrlKey && e.key === "ArrowRight")) {
                e.preventDefault();
                navPaperRelative(1);
                return;
            }
        }
    });
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================================================
// FEATURE 9: CURRICULUM SCHEME & SYLLABUS REVISION TAGS
// ==========================================================================
function getCurriculumScheme(year) {
    const y = parseInt(year, 10);
    if (!y || isNaN(y)) {
        return {
            id: "archive",
            name: "Institutional Archive",
            badge: "Archive",
            badgeClass: "scheme-archive",
            description: "Undated or archival examination record"
        };
    }
    if (y >= 2024) {
        return {
            id: "RBU",
            name: "RBU 2024 Scheme",
            badge: "RBU '24",
            badgeClass: "scheme-rbu",
            description: "Ramdeobaba University Autonomous Scheme (NEP 2020)"
        };
    }
    if (y >= 2018) {
        return {
            id: "CBCS",
            name: "Autonomous CBCS",
            badge: "CBCS",
            badgeClass: "scheme-cbcs",
            description: "RCOEM Autonomous Choice Based Credit System"
        };
    }
    return {
        id: "PRECBCS",
        name: "Pre-CBCS Scheme",
        badge: "Pre-CBCS",
        badgeClass: "scheme-precbcs",
        description: "Autonomous / RTMNU Pre-CBCS Syllabus"
    };
}

// ==========================================================================
// FEATURE 10: SUPPLEMENTARY / FORMULA SHEET ATTACHMENT SLOT
// ==========================================================================
function getSubjectSupplementaryAids(subjectTitle) {
    const t = (subjectTitle || "").toLowerCase();
    if (t.includes("math") || t.includes("calculus") || t.includes("algebra") || t.includes("probability") || t.includes("statistic") || t.includes("numerical") || t.includes("discrete")) {
        return {
            category: "Mathematical & Statistical Tables",
            aidName: "Normal Distribution Z-Table & Standard Transform Pairs",
            note: "Approved for examinations requiring statistical reference.",
            available: true,
            refUrl: "/references/math_stats.html"
        };
    }
    if (t.includes("thermal") || t.includes("thermodynamics") || t.includes("steam") || t.includes("heat transfer") || t.includes("fluid mechanics") || t.includes("refrigeration") || t.includes("power plant") || t.includes("ic engine")) {
        return {
            category: "Thermodynamic & Steam Tables",
            aidName: "Properties of Saturated Water/Steam & Mollier Chart Data",
            note: "Use of Steam Tables permitted subject to invigilator verification.",
            available: true,
            refUrl: "/references/steam_tables.html"
        };
    }
    if (t.includes("concrete") || t.includes("steel") || t.includes("structural") || t.includes("rcc") || t.includes("design of") || t.includes("geotechnical") || t.includes("surveying")) {
        return {
            category: "Bureau of Indian Standards (BIS) Codes",
            aidName: "IS 456 / IS 800 Structural Design Aids Summary",
            note: "Standard code provisions permitted as per paper instructions.",
            available: true,
            refUrl: "/references/civil_codes.html"
        };
    }
    if (t.includes("circuit") || t.includes("network") || t.includes("electromagnetic") || t.includes("signal") || t.includes("physics") || t.includes("electronic") || t.includes("vlsi") || t.includes("control system")) {
        return {
            category: "Signals & Constants Tables",
            aidName: "Z-Transform & Common Signals Transform Table",
            note: "Permitted when formulas are authorized in course syllabus.",
            available: true,
            refUrl: "/references/ee_transforms.html"
        };
    }
    return {
        category: "General Examination Reference",
        aidName: "Approved Scientific Calculator (FX-991/FX-82 Series)",
        note: "Non-programmable calculator permitted unless restricted on question paper.",
        available: false,
        refUrl: null
    };
}

window.openSupplementaryReference = function(refUrl, aidName) {
    if (!refUrl) return;
    window.open(refUrl, "_blank", "noopener,noreferrer");
};

window.openCurrentPaperSupplementary = function() {
    if (!state.currentReaderDoc) return;
    const aid = getSubjectSupplementaryAids(state.currentReaderDoc.title);
    if (aid && aid.available && aid.refUrl) {
        window.open(aid.refUrl, "_blank", "noopener,noreferrer");
    }
};

// ==========================================================================
// FEATURE 6: WHATSAPP & TELEGRAM "CLASS PACK" SHARE FORMATTER
// ==========================================================================
window.openClassPackModal = function() {
    const bInfo = state.selectedBranch;
    if (!bInfo) return;
    const sem = state.branchFilters.semester;
    const semText = sem === "ALL" ? "All Semesters" : sem;
    const currentHost = window.location.origin;
    const shareUrl = `${currentHost}/?branch=${encodeURIComponent(bInfo.key)}${sem !== 'ALL' ? '&sem=' + encodeURIComponent(sem) : ''}`;

    const groups = getSubjectGroups();
    const subjectLines = groups.slice(0, 10).map(g => {
        const topSessions = g.papers.slice(0, 3).map(p => {
            const sch = getCurriculumScheme(p.year);
            return `${p.session.slice(0, 3)}'${String(p.year).slice(-2)} [${sch.badge}]`;
        }).join(", ");
        return `• ${toTitleCase(g.title)} (${g.papers.length} papers: ${topSessions}...)`;
    }).join("\n");

    const moreText = groups.length > 10 ? `\n... plus ${groups.length - 10} more subjects archived` : '';

    const text = `RAMDEOBABA UNIVERSITY — EXAM QUESTION PAPERS\n` +
        `Department: ${bInfo.branch}\n` +
        `Semester: ${semText}\n` +
        `Available Question Papers: ${state.filteredPapers.length}\n\n` +
        `Included Subject Archives:\n${subjectLines}${moreText}\n\n` +
        `Read & Download on Portal:\n${shareUrl}\n\n` +
        `Ramdeobaba University Central Library Repository • rbunagpur.in`;

    showShareModal(`Share ${bInfo.branch} Class Pack`, `Question Papers pack for ${semText}`, text, shareUrl);
};

window.openSubjectPackModal = function(event, title, branch, sem) {
    if (event) event.stopPropagation();
    const canonicalKey = getCanonicalSubjectTitle(title).toUpperCase();
    const displayTitle = toTitleCase(title);
    const papers = state.allPapers.filter(p => p.branch === branch && getCanonicalSubjectTitle(p.title).toUpperCase() === canonicalKey);
    papers.sort((a, b) => (b.year - a.year) || a.type.localeCompare(b.type));

    const currentHost = window.location.origin;
    const branchObj = state.branchesList.find(b => b.branch === branch);
    const branchKey = branchObj ? branchObj.key : branch;
    const shareUrl = `${currentHost}/?branch=${encodeURIComponent(branchKey)}`;

    const paperList = papers.slice(0, 8).map(p => {
        const yr = p.year ? `${p.session} ${p.year}` : p.session;
        const sch = getCurriculumScheme(p.year);
        return `• ${yr} (${p.type}) [${sch.badge}]`;
    }).join("\n");

    const text = `RAMDEOBABA UNIVERSITY — PAST PAPERS\n` +
        `Subject: ${displayTitle}\n` +
        `Department: ${branch} (${sem})\n` +
        `Available Past Papers (${papers.length}):\n${paperList}\n\n` +
        `Read Online & Download:\n${shareUrl}\n\n` +
        `Ramdeobaba University Central Library Repository • rbunagpur.in`;

    showShareModal(`Share ${displayTitle} Pack`, `Past examination papers archive`, text, shareUrl);
};

function showShareModal(title, subtitle, formattedText, url) {
    dom.shareModalTitle.textContent = title;
    dom.shareModalSub.textContent = subtitle;
    dom.shareTextArea.value = formattedText;
    dom.shareCopyLabel.textContent = "Copy to Clipboard";

    const encodedText = encodeURIComponent(formattedText);
    dom.shareWhatsappBtn.href = `https://api.whatsapp.com/send?text=${encodedText}`;
    dom.shareTelegramBtn.href = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodedText}`;

    dom.shareModal.style.display = "flex";
}

window.closeShareModal = function() {
    dom.shareModal.style.display = "none";
};

window.copyShareText = function() {
    const text = dom.shareTextArea.value;
    navigator.clipboard.writeText(text).then(() => {
        dom.shareCopyLabel.textContent = "Copied to Clipboard!";
        setTimeout(() => {
            dom.shareCopyLabel.textContent = "Copy to Clipboard";
        }, 2500);
    }).catch(() => {
        dom.shareTextArea.select();
        document.execCommand("copy");
        dom.shareCopyLabel.textContent = "Copied!";
    });
};
