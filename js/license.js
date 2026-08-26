/* ============================================
   LICENSE.JS — Gumroad License Validation
   ============================================ */

/* ── DEVELOPMENT BYPASS ──────────────────────────────────────────────

   Set true to skip the licence check while working on the panel.

   This used to be an unconditional `showMainPanel(); return true;` sitting at
   the top of checkStoredLicense(), with the real check stranded as unreachable
   code below it. That is the version of this that ships by accident: it does
   not look like a switch, so nobody thinks to turn it off, and everything
   underneath it is dead code that stops getting read.

   As a named flag it is one line to flip — and tools/build.ps1 refuses to
   package a release while it is true, so the accident cannot happen. */
const LG_DEV_BYPASS_LICENSE = false;

const GUMROAD_PRODUCT_PERMALINK = 'livinggradients'; // Your Gumroad product permalink
const LICENSE_STORAGE_KEY = 'lg_license_key';
const LICENSE_VALID_KEY = 'lg_license_valid';
const TRIAL_START_KEY = 'lg_trial_start';
const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

/* ── WHERE THE ACTIVATION LIVES ──────────────────────────────────────

   On disk, in the panel's own data folder. Not in localStorage.

   localStorage in a CEP panel is the extension's browser cache. Clearing that
   cache is the standard fix for a panel that opens blank — it is in this
   project's own README, and it is the first thing anyone is told to try. Doing
   it used to deactivate a product the customer had paid for and wipe the free
   trial, and the customer would have no idea why. That is exactly the bug that
   moved the presets out of localStorage in the first place; the licence was
   left behind.

   Its own file rather than settings.json, so resetting settings cannot
   deactivate anyone.

   Anything already in localStorage is migrated on first run and then removed,
   so nobody has to reactivate. localStorage stays as the fallback for when the
   data folder is unavailable — which in practice means a plain browser, where
   the panel is developed. */

const LICENSE_FILE = 'license.json';

/* available() is a function — it asks whether a filesystem backend actually
   answered — so it has to be called. Reading it as a property is always truthy,
   which would report the data folder as usable on a machine where it is not and
   send an activation into a write that silently fails. */
function licenseStoreAvailable() {
  return typeof LGStore !== 'undefined' &&
         typeof LGStore.available === 'function' && LGStore.available() &&
         LGStore.paths && !!LGStore.paths.root;
}

function licensePath() {
  return LGStore.join(LGStore.paths.root, LICENSE_FILE);
}

function readLicenseRecord() {
  if (licenseStoreAvailable()) {
    try {
      const rec = LGStore.readJson(licensePath(), null);
      if (rec) return rec;
    } catch (e) { /* fall through to the migration below */ }
  }

  /* Nothing on disk. Either this is the first run after the move, or the data
     folder is not writable. Either way localStorage is where to look. */
  const legacy = {
    key: localStorage.getItem(LICENSE_STORAGE_KEY) || '',
    valid: localStorage.getItem(LICENSE_VALID_KEY) === 'true',
    trialStart: parseInt(localStorage.getItem(TRIAL_START_KEY) || '0', 10) || 0
  };

  if (licenseStoreAvailable() && (legacy.key || legacy.trialStart)) {
    /* Migrate once, then clear the old copy so there is exactly one source of
       truth. If the write fails, the localStorage entries are left alone — a
       failed migration must never be able to lose somebody's activation. */
    if (writeLicenseRecord(legacy)) {
      try {
        localStorage.removeItem(LICENSE_STORAGE_KEY);
        localStorage.removeItem(LICENSE_VALID_KEY);
        localStorage.removeItem(TRIAL_START_KEY);
      } catch (e) { }
    }
  }

  return legacy;
}

function writeLicenseRecord(rec) {
  if (licenseStoreAvailable()) {
    try {
      LGStore.ensureTree();
      LGStore.writeJson(licensePath(), rec);
      return true;
    } catch (e) { /* fall through */ }
  }
  /* No data folder. Better a licence that survives until the next cache clear
     than one that does not survive a restart. */
  try {
    if (rec.key) localStorage.setItem(LICENSE_STORAGE_KEY, rec.key);
    else localStorage.removeItem(LICENSE_STORAGE_KEY);
    localStorage.setItem(LICENSE_VALID_KEY, rec.valid ? 'true' : 'false');
    if (rec.trialStart) localStorage.setItem(TRIAL_START_KEY, String(rec.trialStart));
  } catch (e) { }
  return false;
}

const licenseScreen = document.getElementById('license-screen');
const mainScreen = document.getElementById('main-screen');
const emailInput = document.getElementById('email-input');
const licenseInput = document.getElementById('license-input');
const activateBtn = document.getElementById('activate-btn');
const trialBtn = document.getElementById('trial-btn');
const trialSection = document.getElementById('trial-section');
const licenseStatus = document.getElementById('license-status');
const deactivateBtn = document.getElementById('deactivate-btn');
const getLicenseLink = document.getElementById('get-license-link');

// Open Gumroad in browser
if (getLicenseLink) {
  getLicenseLink.addEventListener('click', function(e) {
    e.preventDefault();
    if (lgHostReady()) {
      var cs = new CSInterface();
      cs.openURLInDefaultBrowser('https://digivero.gumroad.com/l/' + GUMROAD_PRODUCT_PERMALINK);
    } else {
      window.open('https://digivero.gumroad.com/l/' + GUMROAD_PRODUCT_PERMALINK, '_blank');
    }
  });
}

// Start Trial
if (trialBtn) {
  trialBtn.addEventListener('click', function() {
    const rec = readLicenseRecord();
    rec.trialStart = Date.now();
    writeLicenseRecord(rec);
    checkStoredLicense();
  });
}

// Format license key input
licenseInput.addEventListener('input', function() {
  let val = this.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  let formatted = val.match(/.{1,8}/g);
  if (formatted) {
    this.value = formatted.join('-').substring(0, 39);
  } else {
    this.value = val;
  }
});

// Check stored license on load
function checkStoredLicense() {
  if (LG_DEV_BYPASS_LICENSE) {
    showMainPanel();
    const badge = document.querySelector('.header-badge');
    if (badge) badge.textContent = 'DEV MODE';
    return true;
  }

  const rec = readLicenseRecord();

  if (rec.key && rec.valid) {
    showMainPanel();
    const badge = document.querySelector('.header-badge');
    if (badge) badge.textContent = 'PRO';
    return true;
  }

  // Check trial
  if (rec.trialStart) {
    const elapsed = Date.now() - rec.trialStart;
    /* A clock that has gone backwards — a machine set to the wrong date, or a
       record copied from another one — used to read as a trial with negative
       elapsed time, which is a trial that never ends. */
    if (elapsed >= 0 && elapsed < TRIAL_DURATION_MS) {
       const daysLeft = Math.ceil((TRIAL_DURATION_MS - elapsed) / (1000 * 60 * 60 * 24));
       showMainPanel();
       const badge = document.querySelector('.header-badge');
       if (badge) badge.textContent = `TRIAL: ${daysLeft}D`;
       return true;
    } else {
       // Trial expired
       if (trialSection) trialSection.style.display = 'none';
       showLicenseScreen();
       setLicenseStatus(licenseStatus, 'Free trial expired. Please activate.', 'error');
       return false;
    }
  }

  showLicenseScreen();
  return false;
}

function showLicenseScreen() {
  licenseScreen.classList.add('active');
  mainScreen.style.display = 'none';
}

function showMainPanel() {
  licenseScreen.classList.remove('active');
  mainScreen.style.display = 'flex';
}

// Activate
activateBtn.addEventListener('click', async function() {
  const email = emailInput ? emailInput.value.trim() : '';
  const key = licenseInput.value.trim();
  
  if (!email || !email.includes('@')) {
    setLicenseStatus(licenseStatus, 'Please enter a valid email.', 'error');
    return;
  }
  if (!key || key.length < 10) {
    setLicenseStatus(licenseStatus, 'Please enter a valid license key.', 'error');
    return;
  }

  activateBtn.disabled = true;
  setLicenseStatus(licenseStatus, 'Validating…', 'loading');

  try {
    const result = await validateGumroadLicense(key, email);
    if (result.success) {
      const rec = readLicenseRecord();
      rec.key = key;
      rec.valid = true;
      if (!writeLicenseRecord(rec)) {
        /* Say so rather than let it look permanent. Without the data folder the
           activation lives in the extension's browser cache, and clearing that
           cache is the standard fix for a blank panel. */
        LGUI.toast('Activated, but the panel could not write to its data folder, ' +
                   'so this may not survive a cache clear. Check Settings > Diagnostics.',
                   'error');
      }
      setLicenseStatus(licenseStatus, '✓ License activated!', 'success');
      setTimeout(showMainPanel, 800);
    } else {
      setLicenseStatus(licenseStatus, result.message || 'Invalid license key.', 'error');
    }
  } catch (err) {
    setLicenseStatus(licenseStatus, 'Network error. Check your connection.', 'error');
  }

  activateBtn.disabled = false;
});

// Deactivate
if (deactivateBtn) {
  deactivateBtn.addEventListener('click', function() {
    LGUI.confirm("Deactivate this license?", {
      title: "Manage license",
      detail: "You will need your key again to reactivate. Your presets are untouched — they live outside the extension.",
      confirmLabel: "Deactivate"
    }).then(function (yes) {
      if (!yes) return;
      /* The trial start is deliberately kept. Deactivating and reactivating
         is not a way to get another three days. */
      const rec = readLicenseRecord();
      writeLicenseRecord({ key: '', valid: false, trialStart: rec.trialStart || 0 });
      try {
        localStorage.removeItem(LICENSE_STORAGE_KEY);
        localStorage.removeItem(LICENSE_VALID_KEY);
      } catch (e) { }
      licenseInput.value = "";
      setLicenseStatus(licenseStatus, "", "");
      showLicenseScreen();
    });
  });
}

async function validateGumroadLicense(licenseKey, userEmail) {
  // Gumroad License API v2
  const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      product_permalink: GUMROAD_PRODUCT_PERMALINK,
      license_key: licenseKey,
      increment_uses_count: 'false'
    })
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, message: 'Server error. Try again.' };
  }

  if (data.success) {
    // Optional: check if refunded or chargebacked
    const purchase = data.purchase;
    if (purchase && (purchase.refunded || purchase.chargebacked)) {
      return { success: false, message: 'This license has been refunded.' };
    }
    
    // Verify email matches the purchase
    if (purchase && purchase.email && purchase.email.toLowerCase() !== userEmail.toLowerCase()) {
      return { success: false, message: 'Email does not match the purchase.' };
    }

    return { success: true };
  } else {
    return { success: false, message: data.message || 'License not found.' };
  }
}

/* NOT setStatus. js/main.js defines a global function of that name too, and
   both files share one scope — main.js loads second, so its version silently
   replaced this one for every caller here. The two happen to be close enough
   that nothing broke, which is the only reason it went unnoticed. */
function setLicenseStatus(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className = 'license-status ' + (type || '');
}

// Init
checkStoredLicense();
