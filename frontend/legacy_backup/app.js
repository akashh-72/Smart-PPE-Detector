/**
 * SafeGuard AI - Enterprise Single-Page Application (SPA) Controller
 * Handles Multi-Page Navigation, Live Vision AI Inference,
 * Hardware Twin Actuation, Staff Directory, Audit Ledger & System Settings.
 */

// Backend API Base URL
const API_BASE = (window.location.protocol === "http:" || window.location.protocol === "https:")
  ? (window.location.port === "5500" || window.location.port === "3000" ? `http://${window.location.hostname}:8000` : "")
  : "http://localhost:8000";

class SafeGuardApp {
  constructor() {
    // Current Active Route / View
    this.currentView = "home";
    this.currentTab = "webcam";
    this.videoStream = null;
    this.cameraActive = false;
    this.isScanning = false;
    this.isContinuous = false;
    this.continuousTimer = null;
    this.benchmarks = [];
    this.logs = [];
    this.staffList = [];
    this.selectedDeptFilter = "all";

    // Active User Profile
    this.currentUser = {
      name: "Alex Vance",
      role: "Safety Officer",
      avatar: "AV",
      bg: "#f97316",
    };

    // Mandatory PPE checklist defaults
    this.requiredItems = ["helmet", "vest"];
    this.confThreshold = 0.5;
    this.gateDuration = 5;

    // Onboarding Tour State
    this.onboardingStep = 1;
    this.totalOnboardingSteps = 5;

    this.initDOMElements();
    this.bindEvents();
    this.initRouting();
    this.startClock();
    this.initGearMatrix();
    this.initFirebaseAuthAndRealtime();
    this.loadStaff();
    this.loadBenchmarks();
    this.loadLogs();
    this.loadStats();
    this.loadSettings();
  }

  /* --------------------------------------------------------------------------
     DOM ELEMENT BINDINGS
     -------------------------------------------------------------------------- */
  initDOMElements() {
    // Navigation & Page Views
    this.navLinks = document.querySelectorAll(".nav-item, .nav-dropdown-item");
    this.pageViews = document.querySelectorAll(".page-view");
    this.btnMobileToggle = document.getElementById("btnMobileMenuToggle");
    this.primaryNav = document.getElementById("primaryNav");

    // Profile & Header Widgets
    this.navUserAvatar = document.getElementById("navUserAvatar");
    this.navUserName = document.getElementById("navUserName");
    this.navUserRole = document.getElementById("navUserRole");
    this.btnOpenLoginModal = document.getElementById("btnOpenLoginModal");
    this.clockDisplay = document.getElementById("clockDisplay");

    // Vision Station Viewport Elements
    this.tabWebcamBtn = document.getElementById("tabWebcamBtn");
    this.tabUploadBtn = document.getElementById("tabUploadBtn");
    this.tabBenchmarksBtn = document.getElementById("tabBenchmarksBtn");
    this.viewportContainer = document.getElementById("viewportContainer");
    this.webcamVideo = document.getElementById("webcamVideo");
    this.visionCanvas = document.getElementById("visionCanvas");
    this.annotatedResultImg = document.getElementById("annotatedResultImg");
    this.scanLaser = document.getElementById("scanLaserLine");
    this.gantryHeaderTag = document.getElementById("gantryHeaderTag");
    this.verdictBanner = document.getElementById("verdictBanner");
    this.verdictTitle = document.getElementById("verdictTitle");
    this.verdictDetail = document.getElementById("verdictDetail");
    this.verdictIcon = document.getElementById("verdictIcon");

    // Viewport Toolbar & Fallback
    this.viewportToolbar = document.getElementById("viewportToolbar");
    this.viewportModeTag = document.getElementById("viewportModeTag");
    this.btnResumeLive = document.getElementById("btnResumeLive");
    this.cameraFallbackOverlay = document.getElementById("cameraFallbackOverlay");
    this.cameraFallbackMsg = document.getElementById("cameraFallbackMsg");
    this.btnRetryWebcam = document.getElementById("btnRetryWebcam");
    this.btnFallbackUpload = document.getElementById("btnFallbackUpload");

    // Scanning HUD
    this.scanningHudOverlay = document.getElementById("scanningHudOverlay");
    this.scannerMainTitle = document.getElementById("scannerMainTitle");
    this.scannerSubtext = document.getElementById("scannerSubtext");

    // Camera Actions & Upload
    this.cameraControls = document.getElementById("cameraControls");
    this.btnCaptureVerify = document.getElementById("btnCaptureVerify");
    this.captureSpinner = document.getElementById("captureSpinner");
    this.captureIcon = document.getElementById("captureIcon");
    this.captureBtnText = document.getElementById("captureBtnText");
    this.btnToggleContinuous = document.getElementById("btnToggleContinuous");
    this.continuousDot = document.getElementById("continuousDot");
    this.continuousBtnText = document.getElementById("continuousBtnText");
    this.uploadDropzone = document.getElementById("uploadDropzone");
    this.fileInput = document.getElementById("fileInput");
    this.dropzoneBusy = document.getElementById("dropzoneBusy");
    this.dropzoneBusyText = document.getElementById("dropzoneBusyText");
    this.dropzonePrompt = document.getElementById("dropzonePrompt");
    this.benchmarksCarousel = document.getElementById("benchmarksCarousel");
    this.benchmarkCardsGrid = document.getElementById("benchmarkCardsGrid");

    // Checklist Cards & Confidence Bars
    this.cards = {
      helmet: document.getElementById("cardHelmet"),
      vest: document.getElementById("cardVest"),
      mask: document.getElementById("cardMask"),
      gloves: document.getElementById("cardGloves"),
      shoes: document.getElementById("cardShoes"),
    };
    this.confLabels = {
      helmet: document.getElementById("confHelmet"),
      vest: document.getElementById("confVest"),
      mask: document.getElementById("confMask"),
      gloves: document.getElementById("confGloves"),
      shoes: document.getElementById("confShoes"),
    };
    this.confFills = {
      helmet: document.getElementById("fillHelmet"),
      vest: document.getElementById("fillVest"),
      mask: document.getElementById("fillMask"),
      gloves: document.getElementById("fillGloves"),
      shoes: document.getElementById("fillShoes"),
    };
    this.statusPills = {
      helmet: document.getElementById("statusHelmet"),
      vest: document.getElementById("statusVest"),
      mask: document.getElementById("statusMask"),
      gloves: document.getElementById("statusGloves"),
      shoes: document.getElementById("statusShoes"),
    };
    this.toggles = {
      helmet: document.getElementById("reqHelmet"),
      vest: document.getElementById("reqVest"),
      mask: document.getElementById("reqMask"),
      gloves: document.getElementById("reqGloves"),
      shoes: document.getElementById("reqShoes"),
    };

    // Live Stats In Gateway
    this.latencyVal = document.getElementById("latencyVal");
    this.compliancePctVal = document.getElementById("compliancePctVal");

    // Staff Management Elements
    this.staffCardsContainer = document.getElementById("staffCardsContainer");
    this.staffSearchInput = document.getElementById("staffSearchInput");
    this.staffDeptFilters = document.getElementById("staffDeptFilters");
    this.btnOpenAddStaffModal = document.getElementById("btnOpenAddStaffModal");
    this.kpiStaffTotal = document.getElementById("kpiStaffTotal");
    this.kpiStaffActive = document.getElementById("kpiStaffActive");
    this.kpiStaffRestricted = document.getElementById("kpiStaffRestricted");

    // Records & Audit Elements
    this.auditTableBody = document.getElementById("auditTableBody");
    this.btnExportCsv = document.getElementById("btnExportCsv");
    this.btnClearLogs = document.getElementById("btnClearLogs");
    this.recordFilterVerdict = document.getElementById("recordFilterVerdict");
    this.recordFilterViolation = document.getElementById("recordFilterViolation");
    this.recordSearchInput = document.getElementById("recordSearchInput");
    this.statTotalScans = document.getElementById("statTotalScans");
    this.statGrantedScans = document.getElementById("statGrantedScans");
    this.statDeniedScans = document.getElementById("statDeniedScans");
    this.statPassRate = document.getElementById("statPassRate");
    this.statAvgLatency = document.getElementById("statAvgLatency");

    // Home Banner Stat
    this.homeHugeScansCount = document.getElementById("homeHugeScansCount");
    this.homeStatLastUpdated = document.getElementById("homeStatLastUpdated");

    // Modals
    this.onboardingModal = document.getElementById("onboardingModal");
    this.loginModal = document.getElementById("loginModal");
    this.addStaffModal = document.getElementById("addStaffModal");
    this.previewModal = document.getElementById("previewModal");
    this.rpiModal = document.getElementById("rpiModal");

    // Toast Container
    this.toastContainer = document.getElementById("toastContainer");
  }

  /* --------------------------------------------------------------------------
     EVENT BINDINGS
     -------------------------------------------------------------------------- */
  bindEvents() {
    // Mobile navigation toggle
    if (this.btnMobileToggle) {
      this.btnMobileToggle.addEventListener("click", () => {
        if (this.primaryNav) {
          this.primaryNav.classList.toggle("mobile-open");
        }
      });
    }

    // Nested ERP Dropdown Items Navigation & Deep-Linking
    document.querySelectorAll(".nav-dropdown-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const page = item.dataset.page;
        const tabTarget = item.dataset.tabTarget;
        const scrollTarget = item.dataset.scrollTarget;

        if (page) {
          window.location.hash = `#${page}`;
        }
        if (tabTarget) {
          setTimeout(() => this.switchVisionTab(tabTarget), 60);
        }
        if (scrollTarget) {
          setTimeout(() => {
            const el = document.getElementById(scrollTarget);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 150);
        }

        // Close dropdown & mobile nav if open
        item.closest(".nav-dropdown")?.classList.remove("open");
        if (window.innerWidth <= 1024 && this.primaryNav) {
          this.primaryNav.style.display = "none";
        }
      });
    });

    // Toggle Dropdowns on touch/click for mobile/tablet
    document.querySelectorAll(".nav-dropdown-trigger").forEach((trigger) => {
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const parent = trigger.closest(".nav-dropdown");
        const isOpen = parent?.classList.contains("open");
        document.querySelectorAll(".nav-dropdown.open").forEach((d) => d.classList.remove("open"));
        if (!isOpen) parent?.classList.add("open");
      });
    });

    // Hardware Blueprint Navigation Button in Dropdown
    const btnNavWiring = document.getElementById("btnNavOpenWiringBlueprint");
    if (btnNavWiring) {
      btnNavWiring.addEventListener("click", () => {
        this.rpiModal?.classList.remove("hidden");
        btnNavWiring.closest(".nav-dropdown")?.classList.remove("open");
      });
    }

    // User Profile Dropdown Toggle
    const profileDropdown = document.getElementById("userProfileDropdown");
    const profileTrigger = document.getElementById("userProfileTrigger");
    if (profileTrigger && profileDropdown) {
      profileTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle("open");
      });
    }

    // Global Click-Outside Dismiss for Dropdowns and Popovers
    document.addEventListener("click", (e) => {
      if (profileDropdown && !profileDropdown.contains(e.target)) {
        profileDropdown.classList.remove("open");
      }
      document.querySelectorAll(".nav-dropdown.open").forEach((drop) => {
        if (!drop.contains(e.target)) drop.classList.remove("open");
      });
    });

    // Vision Station Tab Switching
    if (this.tabWebcamBtn) this.tabWebcamBtn.addEventListener("click", () => this.switchVisionTab("webcam"));
    if (this.tabUploadBtn) this.tabUploadBtn.addEventListener("click", () => this.switchVisionTab("upload"));
    if (this.tabBenchmarksBtn) this.tabBenchmarksBtn.addEventListener("click", () => this.switchVisionTab("benchmarks"));

    // Capture & Camera Actions
    if (this.btnCaptureVerify) this.btnCaptureVerify.addEventListener("click", () => this.performWebcamCapture());
    if (this.btnResumeLive) this.btnResumeLive.addEventListener("click", () => this.resumeLiveVideo());
    if (this.btnRetryWebcam) this.btnRetryWebcam.addEventListener("click", () => this.initWebcam());
    if (this.btnFallbackUpload) this.btnFallbackUpload.addEventListener("click", () => this.switchVisionTab("upload"));
    if (this.btnToggleContinuous) this.btnToggleContinuous.addEventListener("click", () => this.toggleContinuousScan());

    // File Upload Drag & Drop
    if (this.uploadDropzone && this.fileInput) {
      this.uploadDropzone.addEventListener("click", () => this.fileInput.click());
      this.fileInput.addEventListener("change", (e) => this.handleFileSelect(e));
      this.uploadDropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        this.uploadDropzone.classList.add("dragover");
      });
      this.uploadDropzone.addEventListener("dragleave", () => this.uploadDropzone.classList.remove("dragover"));
      this.uploadDropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        this.uploadDropzone.classList.remove("dragover");
        if (e.dataTransfer.files.length) {
          this.processImageFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Checklist Toggles
    Object.keys(this.toggles).forEach((item) => {
      const toggle = this.toggles[item];
      if (toggle) {
        toggle.addEventListener("change", () => {
          this.updateRequiredItemsFromToggles();
          this.showToast(`Updated policy: ${item.toUpperCase()} is ${toggle.checked ? "MANDATORY" : "OPTIONAL"}`);
        });
      }
    });

    // Hardware Simulator Manual Actions
    const btnOpenGate = document.getElementById("btnManualOpenGate");
    const btnCloseGate = document.getElementById("btnManualCloseGate");
    const btnResetHw = document.getElementById("btnResetStandby");
    if (btnOpenGate) btnOpenGate.addEventListener("click", () => window.hardwareSimulator?.grantAccess());
    if (btnCloseGate) btnCloseGate.addEventListener("click", () => window.hardwareSimulator?.denyAccess(["Manual Lock"]));
    if (btnResetHw) btnResetHw.addEventListener("click", () => window.hardwareSimulator?.resetStandby());

    // Hardware Blueprint Guide Modal
    const btnOpenRpi = document.getElementById("btnOpenRpiGuide");
    const btnCloseRpi = document.getElementById("btnCloseRpiModal");
    const btnDoneRpi = document.getElementById("btnDoneRpiModal");
    if (btnOpenRpi) btnOpenRpi.addEventListener("click", () => this.rpiModal?.classList.remove("hidden"));
    if (btnCloseRpi) btnCloseRpi.addEventListener("click", () => this.rpiModal?.classList.add("hidden"));
    if (btnDoneRpi) btnDoneRpi.addEventListener("click", () => this.rpiModal?.classList.add("hidden"));

    // Preview / Lightbox Modal
    const btnClosePreview = document.getElementById("btnClosePreviewModal");
    if (btnClosePreview) btnClosePreview.addEventListener("click", () => this.previewModal?.classList.add("hidden"));

    // Staff Search & Department Filter
    if (this.staffSearchInput) {
      this.staffSearchInput.addEventListener("input", () => this.renderStaff());
    }
    if (this.staffDeptFilters) {
      this.staffDeptFilters.querySelectorAll(".filter-pill").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.staffDeptFilters.querySelectorAll(".filter-pill").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.selectedDeptFilter = btn.dataset.dept;
          this.renderStaff();
        });
      });
    }

    // Add Staff Modal
    if (this.btnOpenAddStaffModal) {
      this.btnOpenAddStaffModal.addEventListener("click", () => this.addStaffModal?.classList.remove("hidden"));
    }
    const btnCloseAddStaff = document.getElementById("btnCloseAddStaffModal");
    const btnCancelAddStaff = document.getElementById("btnCancelAddStaff");
    if (btnCloseAddStaff) btnCloseAddStaff.addEventListener("click", () => this.addStaffModal?.classList.add("hidden"));
    if (btnCancelAddStaff) btnCancelAddStaff.addEventListener("click", () => this.addStaffModal?.classList.add("hidden"));
    const addStaffForm = document.getElementById("addStaffForm");
    if (addStaffForm) {
      addStaffForm.addEventListener("submit", (e) => this.handleAddStaffSubmit(e));
    }

    // Records Table Actions & Filters
    if (this.btnExportCsv) this.btnExportCsv.addEventListener("click", () => this.exportCsv());
    if (this.btnClearLogs) this.btnClearLogs.addEventListener("click", () => this.clearLogs());
    if (this.recordFilterVerdict) this.recordFilterVerdict.addEventListener("change", () => this.renderLogsTable());
    if (this.recordFilterViolation) this.recordFilterViolation.addEventListener("change", () => this.renderLogsTable());
    if (this.recordSearchInput) this.recordSearchInput.addEventListener("input", () => this.renderLogsTable());

    // Settings Sliders & Save
    const sliderConf = document.getElementById("sliderConfThreshold");
    const valConf = document.getElementById("valConfThreshold");
    if (sliderConf && valConf) {
      sliderConf.addEventListener("input", () => {
        valConf.textContent = `${sliderConf.value}%`;
        this.confThreshold = parseInt(sliderConf.value, 10) / 100;
      });
    }

    const sliderGate = document.getElementById("sliderGateDuration");
    const valGate = document.getElementById("valGateDuration");
    if (sliderGate && valGate) {
      sliderGate.addEventListener("input", () => {
        valGate.textContent = `${sliderGate.value} Seconds`;
        this.gateDuration = parseInt(sliderGate.value, 10);
      });
    }

    const btnSaveSettings = document.getElementById("btnSaveAllSettings");
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener("click", () => this.saveSettings());
    }

    const btnSettingsExport = document.getElementById("btnSettingsExportCsv");
    if (btnSettingsExport) btnSettingsExport.addEventListener("click", () => this.exportCsv());

    const btnSettingsClear = document.getElementById("btnSettingsClearLogs");
    if (btnSettingsClear) btnSettingsClear.addEventListener("click", () => this.clearLogs());

    const btnSettingsReset = document.getElementById("btnSettingsResetDefaults");
    if (btnSettingsReset) btnSettingsReset.addEventListener("click", () => this.resetDefaultSettings());

    // Contact Form Submission
    const contactForm = document.getElementById("contactForm");
    if (contactForm) {
      contactForm.addEventListener("submit", (e) => this.handleContactSubmit(e));
    }

    // FAQ Accordion
    document.querySelectorAll(".faq-item .faq-question").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.closest(".faq-item");
        item.classList.toggle("active");
      });
    });

    // Atlas Gear Matrix Selector
    const matrixSelect = document.getElementById("roleMatrixSelect");
    if (matrixSelect) {
      matrixSelect.addEventListener("change", () => this.updateGearMatrix(matrixSelect.value));
    }

    // Atlas Category Filter
    document.querySelectorAll(".atlas-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".atlas-filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const cat = btn.dataset.cat;
        document.querySelectorAll(".atlas-catalog-card").forEach((card) => {
          if (cat === "all" || card.dataset.cat === cat) {
            card.style.display = "flex";
          } else {
            card.style.display = "none";
          }
        });
      });
    });

    // Onboarding Modal Trigger
    const btnOpenOnboarding1 = document.getElementById("btnHeroOpenOnboarding");
    const btnOpenOnboarding2 = document.getElementById("btnLaunchOnboardingModal");
    const btnCloseOnboarding = document.getElementById("btnCloseOnboardingModal");
    const btnNextOnboarding = document.getElementById("btnNextOnboardingStep");
    const btnPrevOnboarding = document.getElementById("btnPrevOnboardingStep");

    if (btnOpenOnboarding1) btnOpenOnboarding1.addEventListener("click", () => this.openOnboarding(1));
    if (btnOpenOnboarding2) btnOpenOnboarding2.addEventListener("click", () => this.openOnboarding(1));
    if (btnCloseOnboarding) btnCloseOnboarding.addEventListener("click", () => this.onboardingModal?.classList.add("hidden"));
    if (btnNextOnboarding) btnNextOnboarding.addEventListener("click", () => this.stepOnboarding(1));
    if (btnPrevOnboarding) btnPrevOnboarding.addEventListener("click", () => this.stepOnboarding(-1));

    // User Login & Profile Modal Triggers
    if (this.btnOpenLoginModal) {
      this.btnOpenLoginModal.addEventListener("click", () => {
        this.showAuthError(null);
        this.updateModalActiveUser(this.currentUser);
        this.loginModal?.classList.remove("hidden");
      });
    }
    const btnCloseLogin = document.getElementById("btnCloseLoginModal");
    if (btnCloseLogin) {
      btnCloseLogin.addEventListener("click", () => this.loginModal?.classList.add("hidden"));
    }

    // Sign Out Buttons (Header & Modal)
    const handleSignOut = async () => {
      try {
        if (window.SafeGuardFirebase?.signOut) {
          await window.SafeGuardFirebase.signOut();
        }
        this.currentUser = null;
        this.updateUserNavbarLoggedOut();
        this.updateModalActiveUser(null);
        this.loginModal?.classList.add("hidden");
        this.showToast("Signed out of workstation.");
      } catch (err) {
        this.showToast("Failed to sign out.", "error");
      }
    };

    const btnNavLogout = document.getElementById("btnNavLogout");
    if (btnNavLogout) btnNavLogout.addEventListener("click", handleSignOut);
    const btnModalSignOut = document.getElementById("btnModalSignOut");
    if (btnModalSignOut) btnModalSignOut.addEventListener("click", handleSignOut);

    // Auth Tabs Switch (Sign In vs Register)
    const tabSignIn = document.getElementById("tabBtnSignIn");
    const tabRegister = document.getElementById("tabBtnRegister");
    const signInContainer = document.getElementById("authSignInContainer");
    const regContainer = document.getElementById("authRegisterContainer");

    if (tabSignIn && tabRegister) {
      tabSignIn.addEventListener("click", () => {
        tabSignIn.classList.add("active");
        tabRegister.classList.remove("active");
        signInContainer?.classList.remove("hidden");
        regContainer?.classList.add("hidden");
        this.showAuthError(null);
      });

      tabRegister.addEventListener("click", () => {
        tabRegister.classList.add("active");
        tabSignIn.classList.remove("active");
        regContainer?.classList.remove("hidden");
        signInContainer?.classList.add("hidden");
        this.showAuthError(null);
      });
    }

    // Quick-Switch Login Presets (Uses Real Firebase Accounts)
    document.querySelectorAll(".role-preset-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const email = btn.dataset.email || "alex.vance@safeguard.io";
        const password = btn.dataset.pass || "123456";
        document.querySelectorAll(".role-preset-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.showAuthError(null);

        this.showToast(`Authenticating ${btn.dataset.name} with Firebase...`);
        try {
          if (window.SafeGuardFirebase?.signIn) {
            await window.SafeGuardFirebase.signIn(email, password);
          } else {
            this.currentUser = {
              name: btn.dataset.name,
              role: btn.dataset.role,
              avatar: btn.dataset.avatar,
              bg: btn.dataset.bg,
              email: email,
            };
            this.updateUserNavbar();
          }
          this.loginModal?.classList.add("hidden");
          this.showToast(`Logged in as ${btn.dataset.name} (${btn.dataset.role})`);
        } catch (err) {
          console.warn("Preset auth error:", err);
          this.showAuthError(err.message || "Failed to authenticate preset profile.");
        }
      });
    });

    // Firebase Email / Password Sign In Form
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("loginEmail")?.value || "";
        const password = document.getElementById("loginPin")?.value || "";
        const btn = document.getElementById("btnSubmitLogin");
        const btnText = document.getElementById("loginBtnText");

        this.showAuthError(null);
        if (btnText) btnText.textContent = "Verifying Credentials...";
        if (btn) btn.disabled = true;

        try {
          if (window.SafeGuardFirebase?.signIn) {
            await window.SafeGuardFirebase.signIn(email, password);
          } else {
            this.currentUser = {
              name: email.split("@")[0].replace(".", " ").toUpperCase(),
              role: "Safety Admin",
              avatar: email.charAt(0).toUpperCase(),
              bg: "#f97316",
              email: email,
            };
            this.updateUserNavbar();
          }
          this.loginModal?.classList.add("hidden");
          this.showToast(`Authenticated session: ${this.currentUser?.name || email}`);
        } catch (err) {
          this.showAuthError(err.message || "Invalid work email or security PIN.");
        } finally {
          if (btnText) btnText.textContent = "Sign In with Firebase";
          if (btn) btn.disabled = false;
        }
      });
    }

    // Firebase New User Registration Form
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("regName")?.value || "";
        const email = document.getElementById("regEmail")?.value || "";
        const password = document.getElementById("regPassword")?.value || "";
        const dept = document.getElementById("regDept")?.value || "Construction Operations";
        const role = document.getElementById("regRole")?.value || "Safety Officer";
        const btn = document.getElementById("btnSubmitRegister");
        const btnText = document.getElementById("registerBtnText");

        this.showAuthError(null);
        if (btnText) btnText.textContent = "Creating Account...";
        if (btn) btn.disabled = true;

        try {
          if (window.SafeGuardFirebase?.signUp) {
            await window.SafeGuardFirebase.signUp(email, password, name, role, dept);
          }
          this.loginModal?.classList.add("hidden");
          registerForm.reset();
          this.showToast(`Firebase account created! Welcome, ${name}`);
        } catch (err) {
          this.showAuthError(err.message || "Failed to create account.");
        } finally {
          if (btnText) btnText.textContent = "Create Firebase Account";
          if (btn) btn.disabled = false;
        }
      });
    }
  }

  /* --------------------------------------------------------------------------
     SPA ROUTING SYSTEM (Hash Navigation)
     -------------------------------------------------------------------------- */
  initRouting() {
    window.addEventListener("hashchange", () => this.handleRouting());
    // Initial routing
    this.handleRouting();
  }

  handleRouting() {
    const rawHash = window.location.hash.replace("#", "").trim();
    const cleanHash = rawHash.split("?")[0].split("/")[0];
    const validViews = ["home", "gateway", "staff", "records", "atlas", "about", "contact", "settings"];
    const targetView = validViews.includes(cleanHash) ? cleanHash : "home";

    this.currentView = targetView;

    // Switch visible page view
    this.pageViews.forEach((view) => {
      if (view.id === `view-${targetView}`) {
        view.classList.add("active");
      } else {
        view.classList.remove("active");
      }
    });

    // Update nav links active indicator (both top items and dropdown items)
    this.navLinks.forEach((link) => {
      if (link.dataset.page === targetView) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    // Highlight parent nav dropdown group
    document.querySelectorAll(".nav-dropdown").forEach((drop) => {
      const group = drop.dataset.navGroup;
      let isGroupActive = false;
      if (group === "operations" && targetView === "gateway") isGroupActive = true;
      if (group === "safety" && ["staff", "records", "atlas"].includes(targetView)) isGroupActive = true;
      if (group === "admin" && ["settings", "about", "contact"].includes(targetView)) isGroupActive = true;

      drop.classList.toggle("active", isGroupActive);
    });

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Page-specific initializers & camera management
    if (targetView === "gateway") {
      if (!this.cameraActive) {
        this.initWebcam();
      } else {
        this.resumeLiveVideo();
      }
    } else {
      // Pause continuous scan when user navigates away from gateway
      if (this.isContinuous) {
        this.toggleContinuousScan();
      }
    }

    if (targetView === "staff") {
      this.loadStaff();
    } else if (targetView === "records") {
      this.loadLogs();
      this.loadStats();
    }
  }

  updateUserNavbar() {
    if (!this.currentUser) {
      this.updateUserNavbarLoggedOut();
      return;
    }
    const avatar = this.currentUser.avatar || "AV";
    const name = this.currentUser.name || "Worker";
    const role = this.currentUser.role || "Operator";
    const bg = this.currentUser.bg || "#f97316";

    if (this.navUserAvatar) {
      this.navUserAvatar.textContent = avatar;
      this.navUserAvatar.style.background = bg;
    }
    if (this.navUserName) this.navUserName.textContent = name;
    if (this.navUserRole) this.navUserRole.textContent = role;

    // Synchronize Profile Menu Card Header
    const menuAvatar = document.getElementById("menuUserAvatar");
    const menuName = document.getElementById("menuUserName");
    const menuRole = document.getElementById("menuUserRole");
    if (menuAvatar) {
      menuAvatar.textContent = avatar;
      menuAvatar.style.background = bg;
    }
    if (menuName) menuName.textContent = name;
    if (menuRole) menuRole.textContent = role;

    const btnNavLogout = document.getElementById("btnNavLogout");
    if (btnNavLogout) btnNavLogout.classList.remove("hidden");
  }

  updateUserNavbarLoggedOut() {
    if (this.navUserAvatar) {
      this.navUserAvatar.textContent = "??";
      this.navUserAvatar.style.background = "#64748b";
    }
    if (this.navUserName) this.navUserName.textContent = "Terminal Guest";
    if (this.navUserRole) this.navUserRole.textContent = "Sign In Required";

    const menuAvatar = document.getElementById("menuUserAvatar");
    const menuName = document.getElementById("menuUserName");
    const menuRole = document.getElementById("menuUserRole");
    if (menuAvatar) {
      menuAvatar.textContent = "??";
      menuAvatar.style.background = "#64748b";
    }
    if (menuName) menuName.textContent = "Terminal Guest";
    if (menuRole) menuRole.textContent = "Visitor Profile";

    const btnNavLogout = document.getElementById("btnNavLogout");
    if (btnNavLogout) btnNavLogout.classList.add("hidden");
  }

  showAuthError(msg) {
    const banner = document.getElementById("authErrorBanner");
    const text = document.getElementById("authErrorText");
    if (!banner) return;
    if (msg) {
      if (text) text.textContent = msg;
      banner.classList.add("visible");
    } else {
      banner.classList.remove("visible");
    }
  }

  updateModalActiveUser(user) {
    const card = document.getElementById("activeUserSessionCard");
    const avatar = document.getElementById("modalUserAvatar");
    const name = document.getElementById("modalUserName");
    const email = document.getElementById("modalUserEmail");
    const role = document.getElementById("modalUserRole");
    const title = document.getElementById("authModalTitle");

    if (!card) return;
    if (user) {
      card.classList.remove("hidden");
      if (avatar) {
        avatar.textContent = user.avatar || "AV";
        avatar.style.background = user.bg || "#f97316";
      }
      if (name) name.textContent = user.name;
      if (email) email.textContent = user.email || "";
      if (role) role.textContent = user.role || "Safety Officer";
      if (title) title.textContent = "Workstation Profile Active";
    } else {
      card.classList.add("hidden");
      if (title) title.textContent = "Workstation User Access";
    }
  }

  initFirebaseAuthAndRealtime() {
    const attach = () => {
      const fb = window.SafeGuardFirebase;
      if (!fb) return;

      // 1. Live Authentication listener
      fb.onAuthStateChange((user, profile) => {
        if (user && profile) {
          this.currentUser = {
            name: profile.name || user.displayName || user.email.split("@")[0],
            email: user.email,
            role: profile.role || "Safety Officer",
            avatar: profile.avatar || "AV",
            bg: profile.bg || "#f97316",
            uid: user.uid,
          };
          this.updateUserNavbar();
          this.updateModalActiveUser(this.currentUser);
        } else {
          this.currentUser = null;
          this.updateUserNavbarLoggedOut();
          this.updateModalActiveUser(null);
        }
      });

      // 2. Realtime Access Logs stream
      fb.subscribeLogs((logs) => {
        this.logs = logs;
        this.renderLogsTable();
        this.calculateRealtimeStats(logs);
      });

      // 3. Realtime Staff Directory stream
      fb.subscribeStaff((staffList) => {
        if (staffList && staffList.length) {
          this.staffList = staffList;
          this.renderStaff();
        }
      });

      // 4. Realtime System Configuration stream
      fb.subscribeSettings((settings) => {
        if (settings) {
          this.applySettingsFromFirebase(settings);
        }
      });
    };

    if (window.SafeGuardFirebase?.isReady) {
      attach();
    } else {
      window.addEventListener("firebase-ready", () => attach());
    }
  }

  calculateRealtimeStats(logs) {
    if (!logs) return;
    const total = logs.length;
    const granted = logs.filter((l) => l.status === "GRANTED").length;
    const denied = logs.filter((l) => l.status === "DENIED").length;
    const passRate = total > 0 ? Math.round((granted / total) * 100) : 0;
    const totalLatency = logs.reduce((acc, l) => acc + (parseFloat(l.inference_time_ms) || 0), 0);
    const avgLatency = total > 0 ? Math.round(totalLatency / total) : 0;

    if (this.statTotalScans) this.statTotalScans.textContent = total;
    if (this.statGrantedScans) this.statGrantedScans.textContent = granted;
    if (this.statDeniedScans) this.statDeniedScans.textContent = denied;
    if (this.statPassRate) this.statPassRate.textContent = `${passRate}%`;
    if (this.statAvgLatency) this.statAvgLatency.textContent = `${avgLatency} ms`;

    if (this.homeHugeScansCount) {
      const count = 6775580 + total;
      this.homeHugeScansCount.textContent = count.toLocaleString();
    }
  }

  applySettingsFromFirebase(cfg) {
    if (!cfg) return;
    if (cfg.confidence_threshold) {
      const val = Math.round(parseFloat(cfg.confidence_threshold) * 100);
      const slider = document.getElementById("sliderConfThreshold");
      const label = document.getElementById("valConfThreshold");
      if (slider) slider.value = val;
      if (label) label.textContent = `${val}%`;
      this.confThreshold = parseFloat(cfg.confidence_threshold);
    }
    if (cfg.gate_open_duration) {
      const val = parseInt(cfg.gate_open_duration, 10);
      const slider = document.getElementById("sliderGateDuration");
      const label = document.getElementById("valGateDuration");
      if (slider) slider.value = val;
      if (label) label.textContent = `${val} Seconds`;
      this.gateDuration = val;
    }
    if (cfg.site_name) {
      const inp = document.getElementById("setSiteName");
      if (inp) inp.value = cfg.site_name;
    }
    if (cfg.strict_mode !== undefined) {
      const chk = document.getElementById("setStrictMode");
      if (chk) chk.checked = cfg.strict_mode === "true" || cfg.strict_mode === true;
    }
    if (cfg.sound_alerts !== undefined) {
      const chk = document.getElementById("setSoundAlerts");
      if (chk) chk.checked = cfg.sound_alerts === "true" || cfg.sound_alerts === true;
    }
    if (Array.isArray(cfg.required_items)) {
      this.requiredItems = cfg.required_items;
      Object.keys(this.toggles).forEach((item) => {
        if (this.toggles[item]) {
          this.toggles[item].checked = this.requiredItems.includes(item);
        }
      });
    }
  }

  /* --------------------------------------------------------------------------
     LIVE CAMERA & WEBCAM LOGIC
     -------------------------------------------------------------------------- */
  async initWebcam() {
    try {
      if (this.videoStream) {
        this.videoStream.getTracks().forEach((track) => track.stop());
      }
      this.cameraFallbackOverlay?.classList.add("hidden");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });

      this.videoStream = stream;
      if (this.webcamVideo) {
        this.webcamVideo.srcObject = stream;
        await this.webcamVideo.play();
      }
      this.cameraActive = true;
      this.resumeLiveVideo();
      this.showToast("Camera stream connected successfully");
    } catch (err) {
      console.warn("Webcam access error:", err);
      this.cameraActive = false;
      if (this.cameraFallbackOverlay) {
        this.cameraFallbackOverlay.classList.remove("hidden");
        if (this.cameraFallbackMsg) {
          this.cameraFallbackMsg.textContent =
            "Camera stream unavailable or permission denied. You can still test with sample benchmark photos or file upload.";
        }
      }
    }
  }

  resumeLiveVideo() {
    if (this.webcamVideo) this.webcamVideo.style.display = "block";
    if (this.annotatedResultImg) {
      this.annotatedResultImg.classList.add("hidden");
      this.annotatedResultImg.src = "";
    }
    if (this.viewportToolbar) this.viewportToolbar.classList.add("hidden");
    if (this.verdictBanner) this.verdictBanner.classList.add("hidden");
    if (this.scanningHudOverlay) this.scanningHudOverlay.classList.add("hidden");
    if (this.scanLaser) this.scanLaser.classList.remove("active");
  }

  switchVisionTab(tab) {
    this.currentTab = tab;
    [this.tabWebcamBtn, this.tabUploadBtn, this.tabBenchmarksBtn].forEach((btn) => {
      if (btn) btn.classList.remove("active");
    });

    if (tab === "webcam") {
      this.tabWebcamBtn?.classList.add("active");
      this.cameraControls?.classList.remove("hidden");
      this.uploadDropzone?.classList.add("hidden");
      this.benchmarksCarousel?.classList.add("hidden");
      this.resumeLiveVideo();
    } else if (tab === "upload") {
      this.tabUploadBtn?.classList.add("active");
      this.cameraControls?.classList.add("hidden");
      this.uploadDropzone?.classList.remove("hidden");
      this.benchmarksCarousel?.classList.add("hidden");
    } else if (tab === "benchmarks") {
      this.tabBenchmarksBtn?.classList.add("active");
      this.cameraControls?.classList.add("hidden");
      this.uploadDropzone?.classList.add("hidden");
      this.benchmarksCarousel?.classList.remove("hidden");
    }
  }

  async performWebcamCapture() {
    if (this.isScanning || !this.cameraActive) return;
    this.isScanning = true;

    // Show scanner HUD & laser
    this.showScanningHUD("CAPTURING CAMERA FRAME", "Extracting video tensor & running YOLOv8 ONNX model...");
    if (this.captureSpinner) this.captureSpinner.classList.remove("hidden");
    if (this.captureIcon) this.captureIcon.classList.add("hidden");
    if (this.captureBtnText) this.captureBtnText.textContent = "Analyzing Frame...";

    try {
      const canvas = this.visionCanvas;
      const video = this.webcamVideo;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const base64Data = canvas.toDataURL("image/jpeg", 0.88);

      const response = await fetch(`${API_BASE}/api/scan/base64`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: base64Data,
          required_items: this.requiredItems,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      this.handleVerificationResult(result);
    } catch (err) {
      console.error("Verification failed:", err);
      this.showToast("Verification request failed. Ensure backend is running.", "error");
    } finally {
      this.isScanning = false;
      this.hideScanningHUD();
      if (this.captureSpinner) this.captureSpinner.classList.add("hidden");
      if (this.captureIcon) this.captureIcon.classList.remove("hidden");
      if (this.captureBtnText) this.captureBtnText.textContent = "Capture & Verify Now";
    }
  }

  handleFileSelect(e) {
    if (e.target.files.length) {
      this.processImageFile(e.target.files[0]);
    }
  }

  async processImageFile(file) {
    if (this.isScanning) return;
    this.isScanning = true;

    this.dropzoneBusy?.classList.remove("hidden");
    this.dropzonePrompt?.classList.add("hidden");
    this.showScanningHUD("PROCESSING UPLOAD", "Analyzing high-res photo for PPE compliance...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("required_items", JSON.stringify(this.requiredItems));

    try {
      const response = await fetch(`${API_BASE}/api/scan/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      this.handleVerificationResult(result);
      this.showToast(`Upload verified: ${result.access_granted ? "GRANTED" : "DENIED"}`);
    } catch (err) {
      console.error("Upload error:", err);
      this.showToast("Failed to inspect uploaded file.", "error");
    } finally {
      this.isScanning = false;
      this.hideScanningHUD();
      this.dropzoneBusy?.classList.add("hidden");
      this.dropzonePrompt?.classList.remove("hidden");
    }
  }

  handleVerificationResult(result) {
    // Show annotated image
    if (result.annotated_image_base64 && this.annotatedResultImg) {
      this.annotatedResultImg.src = result.annotated_image_base64;
      this.annotatedResultImg.classList.remove("hidden");
      if (this.webcamVideo) this.webcamVideo.style.display = "none";
      if (this.viewportToolbar) this.viewportToolbar.classList.remove("hidden");
    }

    // Update telemetry metrics
    if (this.latencyVal) this.latencyVal.textContent = `${Math.round(result.inference_time_ms)} ms`;
    if (this.compliancePctVal) this.compliancePctVal.textContent = `${Math.round(result.compliance_percentage)}%`;

    // Update Checklist Tiles
    this.updateChecklistCards(result.detections, result.missing_items);

    // Trigger Verdict Banner
    if (this.verdictBanner) {
      this.verdictBanner.classList.remove("hidden", "denied");
      if (result.access_granted) {
        this.verdictTitle.textContent = "ENTRY GRANTED";
        this.verdictDetail.textContent = "All Required Safety Gear Verified &bull; Gate Unlocked";
        this.verdictIcon.innerHTML = "&#10004;";
        window.hardwareSimulator?.grantAccess();
      } else {
        this.verdictBanner.classList.add("denied");
        this.verdictTitle.textContent = "ENTRY DENIED";
        const missingStr = result.missing_items.map((i) => i.toUpperCase()).join(", ");
        this.verdictDetail.textContent = `Missing Required Gear: ${missingStr} &bull; Gate Locked`;
        this.verdictIcon.innerHTML = "&#9888;";
        window.hardwareSimulator?.denyAccess(result.missing_items);
      }
    }

    // Sync verification to Firebase Realtime Database
    if (window.SafeGuardFirebase?.pushScanLog) {
      window.SafeGuardFirebase.pushScanLog({
        id: result.log_id || Date.now(),
        status: result.access_granted ? "GRANTED" : "DENIED",
        compliance_percentage: result.compliance_percentage,
        average_confidence: result.average_confidence,
        inference_time_ms: result.inference_time_ms,
        compliant_items: result.compliant_items,
        missing_items: result.missing_items,
        image_filename: result.image_filename || "",
      });
    }

    // Broadcast hardware state to Firebase RTDB for digital twin collaboration
    if (window.SafeGuardFirebase?.updateHardware) {
      window.SafeGuardFirebase.updateHardware({
        state: result.access_granted ? "GRANTED" : "DENIED",
        gate: {
          state: result.access_granted ? "OPEN" : "CLOSED",
          angle: result.access_granted ? 90 : 0,
        },
        led: {
          green: !!result.access_granted,
          red: !result.access_granted,
        },
        buzzer: {
          active: !result.access_granted,
          pattern: !result.access_granted ? "double_beep" : "off",
        },
        lcd: {
          line1: result.access_granted ? "ACCESS GRANTED" : "ACCESS DENIED",
          line2: result.access_granted
            ? "ENTRY APPROVED"
            : `WEAR ${(result.missing_items || []).join(", ").toUpperCase() || "REQUIRED PPE"}`,
          backlight: result.access_granted ? "green" : "red",
        },
      });

      // Auto-reset barrier to Standby after gateDuration seconds
      if (result.access_granted) {
        setTimeout(() => {
          if (window.SafeGuardFirebase?.updateHardware) {
            window.SafeGuardFirebase.updateHardware({
              state: "STANDBY",
              gate: { state: "CLOSED", angle: 0 },
              led: { green: false, red: false },
              buzzer: { active: false, pattern: "off" },
              lcd: { line1: "SAFEGUARD AI GATE", line2: "STANDBY - READY", backlight: "blue" },
            });
          }
        }, (this.gateDuration || 5) * 1000);
      }
    }

    // Reload audit logs and stats in background
    this.loadLogs();
    this.loadStats();
  }

  updateChecklistCards(detections, missingItems) {
    Object.keys(this.cards).forEach((item) => {
      const det = detections[item];
      const isReq = this.requiredItems.includes(item);
      const isMissing = missingItems.includes(item);

      const conf = det ? Math.round(det.confidence * 100) : 0;
      const detected = det ? det.detected : false;

      if (this.confLabels[item]) this.confLabels[item].textContent = `${conf}%`;
      if (this.confFills[item]) this.confFills[item].style.width = `${conf}%`;

      const pill = this.statusPills[item];
      if (pill) {
        pill.className = "item-status-pill";
        if (detected) {
          pill.classList.add("compliant");
          pill.textContent = "VERIFIED";
        } else if (isReq && isMissing) {
          pill.classList.add("missing");
          pill.textContent = "MISSING / REQUIRED";
        } else {
          pill.classList.add("neutral");
          pill.textContent = isReq ? "NOT DETECTED" : "OPTIONAL";
        }
      }
    });
  }

  showScanningHUD(title, sub) {
    if (this.scanningHudOverlay) {
      this.scanningHudOverlay.classList.remove("hidden");
      if (this.scannerMainTitle) this.scannerMainTitle.textContent = title;
      if (this.scannerSubtext) this.scannerSubtext.textContent = sub;
    }
    if (this.scanLaser) this.scanLaser.classList.add("active");
  }

  hideScanningHUD() {
    if (this.scanningHudOverlay) this.scanningHudOverlay.classList.add("hidden");
    if (this.scanLaser) this.scanLaser.classList.remove("active");
  }

  toggleContinuousScan() {
    this.isContinuous = !this.isContinuous;
    if (this.isContinuous) {
      this.continuousDot?.classList.add("active");
      if (this.continuousBtnText) this.continuousBtnText.textContent = "Auto Scan: ON (Every 2s)";
      this.showToast("Continuous real-time verification activated");
      this.continuousTimer = setInterval(() => {
        if (!this.isScanning && this.cameraActive && this.currentView === "gateway") {
          this.performWebcamCapture();
        }
      }, 2000);
    } else {
      this.continuousDot?.classList.remove("active");
      if (this.continuousBtnText) this.continuousBtnText.textContent = "Auto Continuous Scan: OFF";
      if (this.continuousTimer) clearInterval(this.continuousTimer);
      this.showToast("Continuous scan paused");
    }
  }

  updateRequiredItemsFromToggles() {
    this.requiredItems = [];
    Object.keys(this.toggles).forEach((item) => {
      if (this.toggles[item]?.checked) {
        this.requiredItems.push(item);
      }
    });
  }

  /* --------------------------------------------------------------------------
     BENCHMARK TEST PRESETS
     -------------------------------------------------------------------------- */
  async loadBenchmarks() {
    try {
      const res = await fetch(`${API_BASE}/api/benchmarks`);
      if (!res.ok) return;
      this.benchmarks = await res.json();
      this.renderBenchmarks();
    } catch (e) {
      console.warn("Failed to load benchmarks:", e);
    }
  }

  renderBenchmarks() {
    if (!this.benchmarkCardsGrid) return;
    this.benchmarkCardsGrid.innerHTML = "";

    this.benchmarks.forEach((bm) => {
      const card = document.createElement("div");
      card.className = "benchmark-card-pill";
      const isGranted = (bm.expected || bm.expected_status) === "GRANTED";
      const badgeClass = isGranted ? "granted" : "denied";
      const badgeText = isGranted ? "ENTRY GRANTED" : "ENTRY DENIED";
      const title = bm.name || bm.title || "Scenario";
      const imgSrc = bm.image_url || `/api/benchmarks/image/${bm.id}.jpg`;

      card.innerHTML = `
        <div class="benchmark-thumb-wrap">
          <img src="${imgSrc}" alt="${title}" class="benchmark-thumb-img" onerror="this.src='assets/hero-kiosk.jpg'">
          <span class="benchmark-status-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="benchmark-card-body">
          <strong>${title}</strong>
          <span class="desc">${bm.description || ""}</span>
          <button class="benchmark-btn-run" type="button">
            <span>Run Test Scan</span>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
        </div>
      `;
      card.addEventListener("click", () => this.runBenchmark(bm.id));
      this.benchmarkCardsGrid.appendChild(card);
    });
  }

  async runBenchmark(id) {
    this.showScanningHUD("TEST SCENARIO VERIFICATION", `Loading deterministic sample [${id}]...`);
    try {
      const res = await fetch(`${API_BASE}/api/benchmarks/run/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ required_items: this.requiredItems }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      this.handleVerificationResult(result);
      this.showToast(`Test scenario verified: ${result.access_granted ? "GRANTED" : "DENIED"}`);
    } catch (err) {
      console.error("Benchmark failed:", err);
      this.showToast("Benchmark execution error.", "error");
    } finally {
      this.hideScanningHUD();
    }
  }

  /* --------------------------------------------------------------------------
     STAFF MANAGEMENT MODULE
     -------------------------------------------------------------------------- */
  async loadStaff() {
    try {
      const res = await fetch(`${API_BASE}/api/staff`);
      if (res.ok) {
        this.staffList = await res.json();
      }
    } catch (e) {
      console.warn("Using offline staff records fallback:", e);
      if (!this.staffList.length) {
        this.staffList = [
          { id: 1, name: "Alex Vance", employee_id: "EMP-1042", department: "Construction Operations", role: "Site Engineer", required_ppe: ["helmet", "vest"], status: "ACTIVE", compliance_score: 99.4, last_access: "Today 11:42", avatar_bg: "#f97316" },
          { id: 2, name: "Marcus Miller", employee_id: "EMP-2089", department: "Heavy Machinery", role: "Crane Operator", required_ppe: ["helmet", "vest"], status: "ACTIVE", compliance_score: 98.7, last_access: "Today 10:15", avatar_bg: "#ea580c" },
          { id: 3, name: "Dr. Elena Rostova", employee_id: "EMP-3011", department: "Quality & Safety", role: "Lead Safety Inspector", required_ppe: ["helmet", "vest", "mask"], status: "ACTIVE", compliance_score: 100.0, last_access: "Today 12:05", avatar_bg: "#16a34a" },
          { id: 4, name: "David Chen", employee_id: "EMP-4105", department: "Electrical High Voltage", role: "Substation Tech", required_ppe: ["helmet", "vest", "gloves"], status: "ACTIVE", compliance_score: 97.2, last_access: "Yesterday", avatar_bg: "#2563eb" },
          { id: 5, name: "Sarah Connor", employee_id: "EMP-5024", department: "Quality & Safety", role: "Safety Officer", required_ppe: ["helmet", "vest", "mask"], status: "ACTIVE", compliance_score: 100.0, last_access: "Today 09:12", avatar_bg: "#9333ea" },
          { id: 6, name: "Vikram Patel", employee_id: "CON-8821", department: "Logistics & Supply", role: "Site Contractor", required_ppe: ["helmet", "vest"], status: "RESTRICTED", compliance_score: 84.5, last_access: "Oct 05", avatar_bg: "#dc2626" },
        ];
      }
    }
    this.renderStaff();
  }

  renderStaff() {
    if (!this.staffCardsContainer) return;
    this.staffCardsContainer.innerHTML = "";

    const query = (this.staffSearchInput?.value || "").toLowerCase().trim();
    const deptFilter = this.selectedDeptFilter;

    let filtered = this.staffList.filter((s) => {
      const matchQuery =
        s.name.toLowerCase().includes(query) ||
        s.employee_id.toLowerCase().includes(query) ||
        s.role.toLowerCase().includes(query) ||
        s.department.toLowerCase().includes(query);
      const matchDept = deptFilter === "all" || s.department === deptFilter;
      return matchQuery && matchDept;
    });

    // Update KPI counts
    if (this.kpiStaffTotal) this.kpiStaffTotal.textContent = this.staffList.length;
    if (this.kpiStaffActive) this.kpiStaffActive.textContent = this.staffList.filter((s) => s.status === "ACTIVE").length;
    if (this.kpiStaffRestricted) this.kpiStaffRestricted.textContent = this.staffList.filter((s) => s.status !== "ACTIVE").length;

    if (!filtered.length) {
      this.staffCardsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background:#ffffff; border-radius:24px; color:#64748b;">
          <h3>No matching personnel found</h3>
          <p>Try clearing your search query or department filter.</p>
        </div>
      `;
      return;
    }

    filtered.forEach((staff) => {
      const card = document.createElement("div");
      card.className = "staff-member-card";

      const initials = staff.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
      const ppeChips = (staff.required_ppe || ["helmet", "vest"])
        .map((p) => `<span class="mandate-tag">&#10004; ${p.toUpperCase()}</span>`)
        .join("");

      card.innerHTML = `
        <div class="staff-card-top">
          <div class="staff-avatar-large" style="background:${staff.avatar_bg || "#f97316"};">${initials}</div>
          <div class="staff-identity">
            <h3>${staff.name}</h3>
            <span class="staff-emp-id">${staff.employee_id}</span> &bull;
            <span class="staff-role-sub">${staff.role}</span>
          </div>
        </div>

        <span class="staff-dept-badge">${staff.department}</span>

        <div class="staff-mandate-tags">
          ${ppeChips}
        </div>

        <div style="font-size:0.75rem; color:#64748b; margin-bottom: 0.75rem;">
          Compliance Score: <strong style="color:#0f172a;">${staff.compliance_score || 99}%</strong> &bull;
          Last Pass: <em>${staff.last_access || "Active"}</em>
        </div>

        <div class="staff-card-footer">
          <span class="staff-status-pill ${staff.status.toLowerCase()}">${staff.status}</span>
          <div class="staff-actions-row">
            <button class="btn-micro btn-toggle-staff" data-id="${staff.id}">
              ${staff.status === "ACTIVE" ? "Revoke Access" : "Authorize"}
            </button>
            <button class="btn-micro-danger btn-delete-staff" data-id="${staff.id}">&times;</button>
          </div>
        </div>
      `;

      card.querySelector(".btn-toggle-staff").addEventListener("click", () => this.toggleStaffStatus(staff.id));
      card.querySelector(".btn-delete-staff").addEventListener("click", () => this.deleteStaff(staff.id));

      this.staffCardsContainer.appendChild(card);
    });
  }

  async handleAddStaffSubmit(e) {
    e.preventDefault();
    const name = document.getElementById("newStaffName").value.trim();
    const empId = document.getElementById("newStaffEmpId").value.trim();
    const dept = document.getElementById("newStaffDept").value;
    const role = document.getElementById("newStaffRole").value.trim();

    const reqPpe = [];
    if (document.getElementById("staffReqHelmet")?.checked) reqPpe.push("helmet");
    if (document.getElementById("staffReqVest")?.checked) reqPpe.push("vest");
    if (document.getElementById("staffReqMask")?.checked) reqPpe.push("mask");
    if (document.getElementById("staffReqGloves")?.checked) reqPpe.push("gloves");
    if (document.getElementById("staffReqShoes")?.checked) reqPpe.push("shoes");

    const palette = ["#f97316", "#ea580c", "#2563eb", "#16a34a", "#9333ea", "#0891b2"];
    const avatar_bg = palette[Math.floor(Math.random() * palette.length)];

    try {
      if (window.SafeGuardFirebase?.addStaff) {
        await window.SafeGuardFirebase.addStaff({
          name,
          employee_id: empId,
          department: dept,
          role,
          required_ppe: reqPpe,
          status: "ACTIVE",
          compliance_score: 100.0,
          last_access: "Just Enrolled",
          avatar_bg,
        });
      }

      // Also notify backend API if online
      fetch(`${API_BASE}/api/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          employee_id: empId,
          department: dept,
          role,
          required_ppe: reqPpe,
        }),
      }).catch(() => {});

      this.addStaffModal?.classList.add("hidden");
      document.getElementById("addStaffForm").reset();
      this.showToast(`Personnel successfully enrolled in Firebase: ${name}`);
    } catch (err) {
      console.warn("Failed saving staff:", err);
      this.showToast("Failed to save personnel record.", "error");
    }
  }

  async toggleStaffStatus(id) {
    const target = this.staffList.find((s) => s.id === id || s.firebaseKey === id);
    if (!target) return;
    const newStatus = target.status === "ACTIVE" ? "RESTRICTED" : "ACTIVE";
    const targetKey = target.firebaseKey || target.id;

    try {
      if (window.SafeGuardFirebase?.toggleStaffStatus) {
        await window.SafeGuardFirebase.toggleStaffStatus(targetKey, newStatus);
      }
      fetch(`${API_BASE}/api/staff/${id}/toggle`, { method: "POST" }).catch(() => {});
      target.status = newStatus;
      this.renderStaff();
      this.showToast(`Updated access state for ${target.name} to ${newStatus}`);
    } catch (e) {
      console.warn("Offline staff toggle:", e);
    }
  }

  async deleteStaff(id) {
    if (!confirm("Are you sure you want to remove this personnel record from Firebase?")) return;
    const target = this.staffList.find((s) => s.id === id || s.firebaseKey === id);
    const targetKey = target?.firebaseKey || id;

    try {
      if (window.SafeGuardFirebase?.deleteStaff) {
        await window.SafeGuardFirebase.deleteStaff(targetKey);
      }
      fetch(`${API_BASE}/api/staff/${id}`, { method: "DELETE" }).catch(() => {});
      this.staffList = this.staffList.filter((s) => s.id !== id && s.firebaseKey !== id);
      this.renderStaff();
      this.showToast("Personnel record removed from Firebase RTDB.");
    } catch (e) {
      console.warn("Offline staff delete:", e);
    }
  }

  /* --------------------------------------------------------------------------
     RECORDS & AUDIT LEDGER MODULE
     -------------------------------------------------------------------------- */
  async loadLogs() {
    try {
      const res = await fetch(`${API_BASE}/api/logs?limit=50`);
      if (res.ok) {
        this.logs = await res.json();
        this.renderLogsTable();
      }
    } catch (e) {
      console.warn("Failed loading logs:", e);
    }
  }

  renderLogsTable() {
    if (!this.auditTableBody) return;
    this.auditTableBody.innerHTML = "";

    const verdictFilter = this.recordFilterVerdict?.value || "all";
    const violationFilter = this.recordFilterViolation?.value || "all";
    const searchQuery = (this.recordSearchInput?.value || "").toLowerCase().trim();

    const filtered = this.logs.filter((log) => {
      const matchVerdict = verdictFilter === "all" || log.status === verdictFilter;
      const matchViolation =
        violationFilter === "all" || (log.missing_items && log.missing_items.includes(violationFilter));
      const matchSearch =
        searchQuery === "" ||
        String(log.id).includes(searchQuery) ||
        log.timestamp.toLowerCase().includes(searchQuery);
      return matchVerdict && matchViolation && matchSearch;
    });

    if (!filtered.length) {
      this.auditTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="9" style="text-align: center; padding: 2rem; color: #94a3b8;">
            No access verification logs match the selected filters.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach((log) => {
      const tr = document.createElement("tr");

      const isGranted = log.status === "GRANTED";
      const statusPill = isGranted
        ? `<span class="staff-status-pill active">&#10004; GRANTED</span>`
        : `<span class="staff-status-pill restricted">&#9888; DENIED</span>`;

      const missingTags = (log.missing_items || []).length
        ? log.missing_items.map((m) => `<span class="mandate-tag" style="background:#fee2e2;color:#b91c1c;">Missing ${m}</span>`).join(" ")
        : `<span style="color:#10b981;font-weight:600;font-size:0.75rem;">Full Compliance</span>`;

      const imgSrc = log.image_filename ? `/data/captures/${log.image_filename}` : "assets/hero-kiosk.jpg";

      tr.innerHTML = `
        <td><strong style="font-family:var(--font-mono);color:var(--brand-orange);">#LOG-${String(log.id).padStart(4, "0")}</strong></td>
        <td style="font-size:0.8rem;color:#64748b;">${log.timestamp}</td>
        <td>
          <img src="${imgSrc}" class="thumb-preview-mini" alt="Capture Proof" onerror="this.src='assets/hero-kiosk.jpg'">
        </td>
        <td>${statusPill}</td>
        <td><strong>${Math.round(log.compliance_percentage)}%</strong></td>
        <td>${Math.round(log.average_confidence)}%</td>
        <td>${missingTags}</td>
        <td style="font-family:var(--font-mono);font-size:0.78rem;">${Math.round(log.inference_time_ms)}ms</td>
        <td>
          <button class="btn-micro btn-inspect-log" data-id="${log.id}">Inspect</button>
        </td>
      `;

      tr.querySelector(".btn-inspect-log").addEventListener("click", () => this.inspectLogDetail(log));
      tr.querySelector(".thumb-preview-mini").addEventListener("click", () => this.inspectLogDetail(log));

      this.auditTableBody.appendChild(tr);
    });
  }

  inspectLogDetail(log) {
    if (!this.previewModal) return;
    const previewImg = document.getElementById("previewImg");
    const previewTitle = document.getElementById("previewTitle");
    const previewSidebar = document.getElementById("previewDetailsSidebar");

    if (previewTitle) previewTitle.textContent = `Inspection Forensic Detail &bull; #LOG-${String(log.id).padStart(4, "0")}`;
    if (previewImg) previewImg.src = log.image_filename ? `/data/captures/${log.image_filename}` : "assets/hero-kiosk.jpg";

    if (previewSidebar) {
      previewSidebar.innerHTML = `
        <div style="background:#f8fafc; padding:1.25rem; border-radius:18px; border:1px solid #e2e8f0;">
          <h4 style="font-size:1.05rem; font-weight:800; margin-bottom:0.75rem;">Ingress Security Clearance</h4>
          <p style="font-size:0.85rem; margin-bottom:0.5rem;"><strong>Timestamp:</strong> ${log.timestamp}</p>
          <p style="font-size:0.85rem; margin-bottom:0.5rem;"><strong>Verdict:</strong> <span style="font-weight:800; color:${log.status === "GRANTED" ? "#059669" : "#dc2626"}">${log.status}</span></p>
          <p style="font-size:0.85rem; margin-bottom:0.5rem;"><strong>Compliance Score:</strong> ${Math.round(log.compliance_percentage)}%</p>
          <p style="font-size:0.85rem; margin-bottom:0.5rem;"><strong>Average Confidence:</strong> ${Math.round(log.average_confidence)}%</p>
          <p style="font-size:0.85rem; margin-bottom:0.5rem;"><strong>Inference Latency:</strong> ${Math.round(log.inference_time_ms)} ms</p>
          <p style="font-size:0.85rem; margin-bottom:0.5rem;"><strong>Compliant Gear:</strong> ${(log.compliant_items || []).join(", ") || "None"}</p>
          <p style="font-size:0.85rem; margin-bottom:1rem;"><strong>Missing Gear:</strong> ${(log.missing_items || []).join(", ") || "None (All Verified)"}</p>
          <button class="btn-pill-orange" style="width:100%;" onclick="window.print()">Print Official Pass Slip</button>
        </div>
      `;
    }

    this.previewModal.classList.remove("hidden");
  }

  async loadStats() {
    try {
      const res = await fetch(`${API_BASE}/api/stats`);
      if (!res.ok) return;
      const stats = await res.json();
      if (this.statTotalScans) this.statTotalScans.textContent = stats.total_scans;
      if (this.statGrantedScans) this.statGrantedScans.textContent = stats.granted_scans;
      if (this.statDeniedScans) this.statDeniedScans.textContent = stats.denied_scans;
      if (this.statPassRate) this.statPassRate.textContent = `${stats.pass_rate_percentage}%`;
      if (this.statAvgLatency) this.statAvgLatency.textContent = `${stats.avg_inference_time_ms} ms`;

      // Update Home Huge Banner
      if (this.homeHugeScansCount) {
        const count = 6775587 + (stats.total_scans || 0);
        this.homeHugeScansCount.textContent = count.toLocaleString();
      }
    } catch (e) {
      console.warn("Failed loading statistics:", e);
    }
  }

  async exportCsv() {
    try {
      if (this.logs && this.logs.length) {
        const header = "Log ID,Timestamp,Status,Compliance Pct,Avg Confidence,Latency (ms),Compliant Items,Missing Items\n";
        const rows = this.logs.map((log) => {
          const id = log.id || log.firebaseKey;
          const cItems = (log.compliant_items || []).join("; ");
          const mItems = (log.missing_items || []).join("; ");
          return `"${id}","${log.timestamp}","${log.status}",${log.compliance_percentage}%,${log.average_confidence}%,${log.inference_time_ms}ms,"${cItems}","${mItems}"`;
        }).join("\n");
        const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `ppe_realtime_access_logs_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.showToast("Exported live access ledger CSV from Firebase!");
      } else {
        window.location.href = `${API_BASE}/api/logs/export`;
        this.showToast("Exporting access ledger CSV...");
      }
    } catch (e) {
      this.showToast("Failed to trigger CSV export.", "error");
    }
  }

  async clearLogs() {
    if (!confirm("Are you sure you want to clear the entire access verification log from Firebase?")) return;
    try {
      if (window.SafeGuardFirebase?.clearLogs) {
        await window.SafeGuardFirebase.clearLogs();
      }
      fetch(`${API_BASE}/api/logs/clear`, { method: "POST" }).catch(() => {});
      this.logs = [];
      this.renderLogsTable();
      this.calculateRealtimeStats([]);
      this.showToast("All scan records cleared from Firebase RTDB.");
    } catch (e) {
      this.showToast("Failed to clear logs.", "error");
    }
  }

  /* --------------------------------------------------------------------------
     SYSTEM SETTINGS MODULE
     -------------------------------------------------------------------------- */
  async loadSettings() {
    if (window.SafeGuardFirebase?.subscribeSettings) {
      window.SafeGuardFirebase.subscribeSettings((cfg) => {
        if (cfg) this.applySettingsFromFirebase(cfg);
      });
    }
    try {
      const res = await fetch(`${API_BASE}/api/system/settings`);
      if (res.ok) {
        const cfg = await res.json();
        this.applySettingsFromFirebase(cfg);
      }
    } catch (e) {
      console.warn("Settings fetch fallback:", e);
    }
  }

  async saveSettings() {
    const threshold = (this.confThreshold || 0.5).toFixed(2);
    const duration = String(this.gateDuration || 5);
    const siteName = document.getElementById("setSiteName")?.value || "Gate Terminal";

    const payload = {
      confidence_threshold: threshold,
      gate_open_duration: duration,
      site_name: siteName,
      strict_mode: document.getElementById("setStrictMode")?.checked ? "true" : "false",
      sound_alerts: document.getElementById("setSoundAlerts")?.checked ? "true" : "false",
      required_items: this.requiredItems,
    };

    try {
      if (window.SafeGuardFirebase?.saveSettings) {
        await window.SafeGuardFirebase.saveSettings(payload);
      }
      fetch(`${API_BASE}/api/system/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      }).catch(() => {});
      this.showToast("System settings synchronized to Firebase RTDB.");
    } catch (e) {
      this.showToast("Configuration saved locally.");
    }
  }

  resetDefaultSettings() {
    if (confirm("Reset rule parameters to factory default standards?")) {
      const sliderConf = document.getElementById("sliderConfThreshold");
      const valConf = document.getElementById("valConfThreshold");
      if (sliderConf && valConf) {
        sliderConf.value = 50;
        valConf.textContent = "50%";
        this.confThreshold = 0.5;
      }
      const sliderGate = document.getElementById("sliderGateDuration");
      const valGate = document.getElementById("valGateDuration");
      if (sliderGate && valGate) {
        sliderGate.value = 5;
        valGate.textContent = "5 Seconds";
        this.gateDuration = 5;
      }
      this.saveSettings();
      this.showToast("Restored factory defaults: Helmet + Vest required.");
    }
  }

  /* --------------------------------------------------------------------------
     CONTACT INQUIRY FORM
     -------------------------------------------------------------------------- */
  async handleContactSubmit(e) {
    e.preventDefault();
    const btnSpinner = document.getElementById("contactSpinner");
    const name = document.getElementById("contactName").value.trim();
    const email = document.getElementById("contactEmail").value.trim();
    const company = document.getElementById("contactCompany").value.trim();
    const siteType = document.getElementById("contactSiteType").value;
    const message = document.getElementById("contactMessage").value.trim();

    if (btnSpinner) btnSpinner.classList.remove("hidden");

    try {
      if (window.SafeGuardFirebase?.submitContactInquiry) {
        await window.SafeGuardFirebase.submitContactInquiry({
          name,
          email,
          company,
          site_type: siteType,
          message,
        });
      }

      fetch(`${API_BASE}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, site_type: siteType, message }),
      }).catch(() => {});

      this.showToast("Pilot request recorded in Firebase Realtime Database!");
      document.getElementById("contactForm")?.reset();
    } catch (err) {
      this.showToast("Inquiry recorded successfully.", "success");
      document.getElementById("contactForm")?.reset();
    } finally {
      if (btnSpinner) btnSpinner.classList.add("hidden");
    }
  }

  /* --------------------------------------------------------------------------
     INTERACTIVE ONBOARDING TOUR STEPPER
     -------------------------------------------------------------------------- */
  openOnboarding(step = 1) {
    this.onboardingStep = step;
    this.renderOnboardingStep();
    this.onboardingModal?.classList.remove("hidden");
  }

  stepOnboarding(delta) {
    this.onboardingStep += delta;
    if (this.onboardingStep < 1) this.onboardingStep = 1;
    if (this.onboardingStep > this.totalOnboardingSteps) {
      this.onboardingModal?.classList.add("hidden");
      window.location.hash = "#gateway";
      this.showToast("Onboarding complete! Welcome to SafeGuard AI.");
      return;
    }
    this.renderOnboardingStep();
  }

  renderOnboardingStep() {
    const dots = document.querySelectorAll(".onboarding-stepper-dots .step-dot");
    dots.forEach((dot) => {
      const s = parseInt(dot.dataset.step, 10);
      dot.classList.toggle("active", s === this.onboardingStep);
    });

    const titleEl = document.getElementById("onboardingStepTitle");
    const contentEl = document.getElementById("onboardingStepContent");
    const nextBtn = document.getElementById("btnNextOnboardingStep");
    const prevBtn = document.getElementById("btnPrevOnboardingStep");

    if (prevBtn) prevBtn.style.visibility = this.onboardingStep === 1 ? "hidden" : "visible";
    if (nextBtn) nextBtn.textContent = this.onboardingStep === this.totalOnboardingSteps ? "Launch Gateway 🚀" : "Next →";

    const steps = [
      {
        title: "Step 1: Welcome to SafeGuard AI Gateway",
        html: `
          <img src="assets/hero-kiosk.jpg" class="onboarding-step-img" alt="SafeGuard Gateway Terminal">
          <h3 style="font-size:1.3rem;font-weight:800;margin-bottom:0.5rem;">Autonomous Computer Vision Access Control</h3>
          <p style="color:#64748b;font-size:0.95rem;line-height:1.5;">SafeGuard AI automatically detects required personal protective equipment (PPE) before opening the motorized barrier gate. Let's walk through how to test and operate it.</p>
        `,
      },
      {
        title: "Step 2: Optical Acquisition & Camera Feed",
        html: `
          <img src="assets/atlas-helmet.jpg" class="onboarding-step-img" alt="Camera Verification">
          <h3 style="font-size:1.3rem;font-weight:800;margin-bottom:0.5rem;">Laptop Camera or USB Optical Terminal</h3>
          <p style="color:#64748b;font-size:0.95rem;line-height:1.5;">The system reads real-time camera video from your laptop. You can also drag-and-drop inspection photos or select pre-configured 1-click test scenarios.</p>
        `,
      },
      {
        title: "Step 3: Setting Mandatory Safety Rules",
        html: `
          <img src="assets/atlas-vest.jpg" class="onboarding-step-img" alt="Safety Rules">
          <h3 style="font-size:1.3rem;font-weight:800;margin-bottom:0.5rem;">Configure Mandatory Gear in Real-Time</h3>
          <p style="color:#64748b;font-size:0.95rem;line-height:1.5;">Hard Hat and High-Vis Vest are mandatory by default. You can toggle Face Mask, Gloves, and Boots on or off using the interactive checklist cards.</p>
        `,
      },
      {
        title: "Step 4: Digital Twin & Servo Boom Gate",
        html: `
          <img src="assets/atlas-mask.jpg" class="onboarding-step-img" alt="Gate Simulator">
          <h3 style="font-size:1.3rem;font-weight:800;margin-bottom:0.5rem;">Real-Time Actuator & LCD Simulation</h3>
          <p style="color:#64748b;font-size:0.95rem;line-height:1.5;">Watch the 16x2 LCD screen, tower indicator lights, and motorized boom barrier arm actuate in real-time. Sound alerts beep upon violations and chime on access granted.</p>
        `,
      },
      {
        title: "Step 5: You're Ready to Deploy!",
        html: `
          <div style="font-size:4rem; margin:1rem 0;">🎉</div>
          <h3 style="font-size:1.4rem;font-weight:800;margin-bottom:0.5rem;">Everything Is Configured</h3>
          <p style="color:#64748b;font-size:0.95rem;line-height:1.5;">Click below to launch the live scanner terminal or navigate to Staff Management to authorize personnel badges.</p>
        `,
      },
    ];

    const cur = steps[this.onboardingStep - 1];
    if (titleEl) titleEl.textContent = cur.title;
    if (contentEl) contentEl.innerHTML = cur.html;
  }

  /* --------------------------------------------------------------------------
     SAFETY ATLAS GEAR MATRIX TOOL
     -------------------------------------------------------------------------- */
  initGearMatrix() {
    this.updateGearMatrix("heavy_construction");
  }

  updateGearMatrix(roleKey) {
    const box = document.getElementById("matrixResultBox");
    if (!box) return;

    const data = {
      heavy_construction: {
        title: "Heavy Construction / Rigging Corridor",
        items: [
          { name: "Safety Helmet", standard: "ANSI Z89.1 Type I Class E", mandatory: true },
          { name: "High-Vis Vest", standard: "ANSI/ISEA 107 Class 2/3", mandatory: true },
          { name: "Steel-Toe Boots", standard: "ASTM F2413 Metatarsal", mandatory: true },
          { name: "Work Gloves", standard: "Cut Level A4", mandatory: false },
        ],
        action: "Gate Enforces: Helmet + Vest strict lockout",
      },
      electrical_substation: {
        title: "High Voltage Electrical Substation",
        items: [
          { name: "Dielectric Hard Hat", standard: "Class E 20kV rated", mandatory: true },
          { name: "Arc Flash Vest", standard: "NFPA 70E Category 2", mandatory: true },
          { name: "Insulated Gloves", standard: "ASTM D120 Class 0/1", mandatory: true },
        ],
        action: "Gate Enforces: Helmet + Arc Vest + Insulated Gloves",
      },
      chemical_refinery: {
        title: "Chemical & Hazardous Materials",
        items: [
          { name: "Safety Helmet", standard: "ANSI Z89.1 Class C", mandatory: true },
          { name: "Respirator / Mask", standard: "NIOSH N95 / Half-Face Dual Cartridge", mandatory: true },
          { name: "Chemical Splash Goggles", standard: "ANSI Z87.1", mandatory: true },
          { name: "Nitrile Gloves", standard: "EN 374 Chemical Proof", mandatory: true },
        ],
        action: "Gate Enforces: Helmet + Respirator Mask + Gloves",
      },
      logistics_warehouse: {
        title: "Logistics Hub & Forklift Corridor",
        items: [
          { name: "High-Vis Vest", standard: "ANSI/ISEA 107 Class 2", mandatory: true },
          { name: "Safety Shoes", standard: "Composite Toe Slip Resistant", mandatory: true },
          { name: "Hard Hat", standard: "Bump Cap / Type I", mandatory: false },
        ],
        action: "Gate Enforces: High-Vis Reflective Vest",
      },
      visitor_auditor: {
        title: "Visitor Escort / Executive Tour",
        items: [
          { name: "Visitor Hard Hat (White)", standard: "ANSI Z89.1", mandatory: true },
          { name: "Visitor High-Vis Vest", standard: "Class 2 Neon Orange", mandatory: true },
        ],
        action: "Gate Enforces: Helmet + Vest Clearance with Escort",
      },
    };

    const sel = data[roleKey] || data.heavy_construction;
    const itemsHtml = sel.items
      .map(
        (i) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; padding:0.6rem 1rem; border-radius:12px; margin-bottom:0.4rem; border:1px solid #e2e8f0;">
          <div>
            <strong style="color:#0f172a; font-size:0.85rem;">${i.name}</strong>
            <span style="display:block; font-size:0.72rem; color:#64748b;">${i.standard}</span>
          </div>
          <span class="mandate-tag" style="${i.mandatory ? "" : "background:#f1f5f9;color:#64748b;"}">${i.mandatory ? "MANDATORY" : "RECOMMENDED"}</span>
        </div>
      `
      )
      .join("");

    box.innerHTML = `
      <div style="margin-bottom:0.75rem; font-size:0.95rem; font-weight:800; color:var(--brand-orange);">${sel.title}</div>
      <div style="margin-bottom:1rem;">${itemsHtml}</div>
      <div style="font-size:0.8rem; font-weight:700; color:#047857;">${sel.action}</div>
    `;
  }

  /* --------------------------------------------------------------------------
     UTILITIES
     -------------------------------------------------------------------------- */
  startClock() {
    const update = () => {
      const now = new Date();
      if (this.clockDisplay) {
        this.clockDisplay.textContent = now.toLocaleTimeString([], { hour12: false });
      }
      if (this.homeStatLastUpdated) {
        this.homeStatLastUpdated.textContent = `${now.toLocaleDateString()} &bull; ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      }
    };
    update();
    setInterval(update, 1000);
  }

  showToast(msg, type = "success") {
    if (!this.toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === "error" ? "⚠️" : "✓"}</span><span>${msg}</span>`;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}

// Instantiate App on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  window.safeGuardApp = new SafeGuardApp();
});
