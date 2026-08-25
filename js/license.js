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
    localStorage.setItem(TRIAL_START_KEY, Date.now().toString());
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

  const stored = localStorage.getItem(LICENSE_STORAGE_KEY);
  const valid = localStorage.getItem(LICENSE_VALID_KEY);
  if (stored && valid === 'true') {
    showMainPanel();
    const badge = document.querySelector('.header-badge');
    if (badge) badge.textContent = 'PRO';
    return true;
  }
  
  // Check trial
  const trialStart = localStorage.getItem(TRIAL_START_KEY);
  if (trialStart) {
    const elapsed = Date.now() - parseInt(trialStart, 10);
    if (elapsed < TRIAL_DURATION_MS) {
       const daysLeft = Math.ceil((TRIAL_DURATION_MS - elapsed) / (1000 * 60 * 60 * 24));
       showMainPanel();
       const badge = document.querySelector('.header-badge');
       if (badge) badge.textContent = `TRIAL: ${daysLeft}D`;
       return true;
    } else {
       // Trial expired
       if (trialSection) trialSection.style.display = 'none';
       showLicenseScreen();
       setStatus(licenseStatus, 'Free trial expired. Please activate.', 'error');
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
    setStatus(licenseStatus, 'Please enter a valid email.', 'error');
    return;
  }
  if (!key || key.length < 10) {
    setStatus(licenseStatus, 'Please enter a valid license key.', 'error');
    return;
  }

  activateBtn.disabled = true;
  setStatus(licenseStatus, 'Validating…', 'loading');

  try {
    const result = await validateGumroadLicense(key, email);
    if (result.success) {
      localStorage.setItem(LICENSE_STORAGE_KEY, key);
      localStorage.setItem(LICENSE_VALID_KEY, 'true');
      setStatus(licenseStatus, '✓ License activated!', 'success');
      setTimeout(showMainPanel, 800);
    } else {
      setStatus(licenseStatus, result.message || 'Invalid license key.', 'error');
    }
  } catch (err) {
    setStatus(licenseStatus, 'Network error. Check your connection.', 'error');
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
      localStorage.removeItem(LICENSE_STORAGE_KEY);
      localStorage.removeItem(LICENSE_VALID_KEY);
      licenseInput.value = "";
      setStatus(licenseStatus, "", "");
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

function setStatus(el, msg, type) {
  el.textContent = msg;
  el.className = 'license-status ' + type;
}

// Init
checkStoredLicense();
