/* ============================================
   LICENSE.JS - Gumroad paid activation
   ============================================ */

/* This guard is intentionally explicit. tools/build.ps1 refuses a release
   while it is true, so the paid activation path cannot be bypassed by mistake. */
const LG_DEV_BYPASS_LICENSE = false;

const GUMROAD_PRODUCT_PERMALINK = 'livinggradients';
const LICENSE_STORAGE_KEY = 'lg_license_key';
const LICENSE_VALID_KEY = 'lg_license_valid';
const LICENSE_FILE = 'license.json';

function licenseStoreAvailable() {
  return typeof LGStore !== 'undefined' &&
         typeof LGStore.available === 'function' && LGStore.available() &&
         LGStore.paths && !!LGStore.paths.root;
}

function licensePath() {
  return LGStore.join(LGStore.paths.root, LICENSE_FILE);
}

/* Older records can contain retired fields. Read only the paid activation
   state so an update neither revives nor depends on obsolete license data. */
function normaliseLicenseRecord(rec) {
  rec = rec || {};
  return { key: String(rec.key || ''), valid: rec.valid === true };
}

function readLicenseRecord() {
  if (licenseStoreAvailable()) {
    try {
      const onDisk = LGStore.readJson(licensePath(), null);
      if (onDisk) return normaliseLicenseRecord(onDisk);
    } catch (e) { /* fall through to the legacy paid-key migration */ }
  }

  const legacy = {
    key: localStorage.getItem(LICENSE_STORAGE_KEY) || '',
    valid: localStorage.getItem(LICENSE_VALID_KEY) === 'true'
  };

  if (licenseStoreAvailable() && legacy.key && writeLicenseRecord(legacy)) {
    try {
      localStorage.removeItem(LICENSE_STORAGE_KEY);
      localStorage.removeItem(LICENSE_VALID_KEY);
    } catch (e) { }
  }
  return legacy;
}

function writeLicenseRecord(rec) {
  const clean = normaliseLicenseRecord(rec);
  if (licenseStoreAvailable()) {
    try {
      LGStore.ensureTree();
      LGStore.writeJson(licensePath(), clean);
      return true;
    } catch (e) { /* fall through to the browser-development fallback */ }
  }
  try {
    if (clean.key) localStorage.setItem(LICENSE_STORAGE_KEY, clean.key);
    else localStorage.removeItem(LICENSE_STORAGE_KEY);
    localStorage.setItem(LICENSE_VALID_KEY, clean.valid ? 'true' : 'false');
  } catch (e) { }
  return false;
}

const licenseScreen = document.getElementById('license-screen');
const mainScreen = document.getElementById('main-screen');
const emailInput = document.getElementById('email-input');
const licenseInput = document.getElementById('license-input');
const activateBtn = document.getElementById('activate-btn');
const licenseStatus = document.getElementById('license-status');
const deactivateBtn = document.getElementById('deactivate-btn');
const getLicenseLink = document.getElementById('get-license-link');

if (getLicenseLink) {
  getLicenseLink.addEventListener('click', function (e) {
    e.preventDefault();
    const url = 'https://ehtishaam.gumroad.com/l/' + GUMROAD_PRODUCT_PERMALINK;
    if (lgHostReady()) new CSInterface().openURLInDefaultBrowser(url);
    else window.open(url, '_blank');
  });
}

if (licenseInput) {
  licenseInput.addEventListener('input', function () {
    const raw = this.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const groups = raw.match(/.{1,8}/g);
    this.value = groups ? groups.join('-').substring(0, 39) : raw;
  });
}

function setLicenseStatus(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className = 'license-status ' + (type || '');
}

function showLicenseScreen() {
  if (licenseScreen) licenseScreen.classList.add('active');
  if (mainScreen) mainScreen.style.display = 'none';
}

function showMainPanel() {
  if (licenseScreen) licenseScreen.classList.remove('active');
  if (mainScreen) mainScreen.style.display = 'flex';
}

function checkStoredLicense() {
  const badge = document.querySelector('.header-badge');
  if (LG_DEV_BYPASS_LICENSE) {
    showMainPanel();
    if (badge) badge.textContent = 'DEV MODE';
    return true;
  }
  const rec = readLicenseRecord();
  if (rec.key && rec.valid) {
    showMainPanel();
    if (badge) badge.textContent = 'PRO';
    return true;
  }
  showLicenseScreen();
  return false;
}

if (activateBtn) {
  activateBtn.addEventListener('click', async function () {
    const email = emailInput ? emailInput.value.trim() : '';
    const key = licenseInput ? licenseInput.value.trim() : '';
    if (!email || !email.includes('@')) {
      setLicenseStatus(licenseStatus, 'Please enter a valid email.', 'error');
      return;
    }
    if (!key || key.length < 10) {
      setLicenseStatus(licenseStatus, 'Please enter a valid license key.', 'error');
      return;
    }

    activateBtn.disabled = true;
    setLicenseStatus(licenseStatus, 'Validating...', 'loading');
    try {
      const result = await validateGumroadLicense(key, email);
      if (result.success) {
        if (!writeLicenseRecord({ key: key, valid: true }) && typeof LGUI !== 'undefined') {
          LGUI.toast('Activated, but the panel could not write to its data folder. Check Settings > Diagnostics.', 'error');
        }
        setLicenseStatus(licenseStatus, 'License activated.', 'success');
        setTimeout(showMainPanel, 500);
      } else {
        setLicenseStatus(licenseStatus, result.message || 'Invalid license key.', 'error');
      }
    } catch (err) {
      setLicenseStatus(licenseStatus, 'Network error. Check your connection.', 'error');
    }
    activateBtn.disabled = false;
  });
}

if (deactivateBtn) {
  deactivateBtn.addEventListener('click', function () {
    LGUI.confirm('Deactivate this license?', {
      title: 'Manage license',
      detail: 'You will need your key again to reactivate. Your presets are untouched.',
      confirmLabel: 'Deactivate'
    }).then(function (yes) {
      if (!yes) return;
      writeLicenseRecord({ key: '', valid: false });
      try {
        localStorage.removeItem(LICENSE_STORAGE_KEY);
        localStorage.removeItem(LICENSE_VALID_KEY);
      } catch (e) { }
      if (licenseInput) licenseInput.value = '';
      setLicenseStatus(licenseStatus, '', '');
      showLicenseScreen();
    });
  });
}

async function validateGumroadLicense(licenseKey, userEmail) {
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
  if (!response.ok) return { success: false, message: 'Server error. Try again.' };
  if (!data.success) return { success: false, message: data.message || 'License not found.' };
  const purchase = data.purchase;
  if (purchase && (purchase.refunded || purchase.chargebacked)) {
    return { success: false, message: 'This license has been refunded.' };
  }
  if (purchase && purchase.email && purchase.email.toLowerCase() !== userEmail.toLowerCase()) {
    return { success: false, message: 'Email does not match the purchase.' };
  }
  return { success: true };
}

checkStoredLicense();
