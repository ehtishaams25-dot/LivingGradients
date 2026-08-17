/**
 * CSInterface - Adobe Common Extensibility Platform Interface
 * Version: 11.x (compatible with CEP 7.0+)
 *
 * This is the standard Adobe CEP bridge library that enables
 * HTML/JS panels to communicate with host applications like
 * After Effects via ExtendScript.
 */

/**
 * @class CSInterface
 * This is the entry point to the CEP extensibility infrastructure.
 */

/* jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, sloppy: true, continue: true */

var SystemPath = {
    USER_DATA: "userData",
    COMMON_FILES: "commonFiles",
    MY_DOCUMENTS: "myDocuments",
    APPLICATION: "application",
    EXTENSION: "extension",
    HOST_APPLICATION: "hostApplication"
};

/**
 * Stores operating-system-specific location constants for use in the CSInterface.getSystemPath() method.
 */
var ColorType = {
    RGB: "rgb",
    GRADIENT: "gradient",
    NONE: "none"
};

/**
 * @constant
 * Version information for CEP
 */
var CEPVersion = {
    major: 11,
    minor: 0,
    micro: 0
};

/**
 * Defines a version number with fields for each part.
 */
function VersionBound(maxVersion, minVersion) {
    this.maxVersion = maxVersion;
    this.minVersion = minVersion;
}

function Version(major, minor, micro, special) {
    this.major = major || 0;
    this.minor = minor || 0;
    this.micro = micro || 0;
    this.special = special || "";
}

/**
 * @class HostEnvironment
 */
function HostEnvironment(appName, appVersion, appLocale, appUILocale, appId, isAppOnline, appSkinInfo) {
    this.appName = appName;
    this.appVersion = appVersion;
    this.appLocale = appLocale;
    this.appUILocale = appUILocale;
    this.appId = appId;
    this.isAppOnline = isAppOnline;
    this.appSkinInfo = appSkinInfo;
}

/**
 * @class HostCapabilities
 */
function HostCapabilities(EXTENDED_PANEL_MENU, EXTENDED_PANEL_ICONS, DELEGATE_APE_ENGINE, SUPPORT_HTML_EXTENSIONS, DISABLE_FLASH_EXTENSIONS) {
    this.EXTENDED_PANEL_MENU = EXTENDED_PANEL_MENU;
    this.EXTENDED_PANEL_ICONS = EXTENDED_PANEL_ICONS;
    this.DELEGATE_APE_ENGINE = DELEGATE_APE_ENGINE;
    this.SUPPORT_HTML_EXTENSIONS = SUPPORT_HTML_EXTENSIONS;
    this.DISABLE_FLASH_EXTENSIONS = DISABLE_FLASH_EXTENSIONS;
}

/**
 * @class ApiVersion
 */
function ApiVersion(major, minor, micro) {
    this.major = major;
    this.minor = minor;
    this.micro = micro;
}

/**
 * @class MenuItemStatus
 */
function MenuItemStatus(menuItemLabel, enabled, checked) {
    this.menuItemLabel = menuItemLabel;
    this.enabled = enabled;
    this.checked = checked;
}

/**
 * @class ContextMenuItemStatus - cyclic dependency issue
 */

/**
 * Stores the color data, including red, green, blue, and alpha values.
 */
function RGBColor(red, green, blue, alpha) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
}

/**
 * @class Direction
 */
function Direction(x, y) {
    this.x = x;
    this.y = y;
}

/**
 * @class GradientStop
 */
function GradientStop(offset, rgbColor) {
    this.offset = offset;
    this.rgbColor = rgbColor;
}

/**
 * @class GradientColor
 */
function GradientColor(type, direction, numStops, arrGradientStop) {
    this.type = type;
    this.direction = direction;
    this.numStops = numStops;
    this.arrGradientStop = arrGradientStop;
}

/**
 * @class UIColor
 */
function UIColor(type, antialiasLevel, color) {
    this.type = type;
    this.antialiasLevel = antialiasLevel;
    this.color = color;
}

/**
 * @class AppSkinInfo
 */
function AppSkinInfo(baseFontFamily, baseFontSize, appBarBackgroundColor, panelBackgroundColor, appBarBackgroundColorSRGB, panelBackgroundColorSRGB, systemHighlightColor) {
    this.baseFontFamily = baseFontFamily;
    this.baseFontSize = baseFontSize;
    this.appBarBackgroundColor = appBarBackgroundColor;
    this.panelBackgroundColor = panelBackgroundColor;
    this.appBarBackgroundColorSRGB = appBarBackgroundColorSRGB;
    this.panelBackgroundColorSRGB = panelBackgroundColorSRGB;
    this.systemHighlightColor = systemHighlightColor;
}

/**
 * CSEvent - cyclic events
 */
function CSEvent(type, scope, appId, extensionId) {
    this.type = type;
    this.scope = scope;
    this.appId = appId;
    this.extensionId = extensionId;
    this.data = "";
}

/**
 * @class CSInterface
 * Main class for interacting with the Adobe host application.
 */
function CSInterface() {}

/**
 * User can add listeners for cyclic events
 */
CSInterface.prototype.addEventListener = function(type, listener, obj) {
    window.__adobe_cep__.addEventListener(type, listener, obj);
};

/**
 * Removes an event listener.
 */
CSInterface.prototype.removeEventListener = function(type, listener, obj) {
    window.__adobe_cep__.removeEventListener(type, listener, obj);
};

/**
 * Sends an event.
 */
CSInterface.prototype.requestOpenExtension = function(extensionId, params) {
    window.__adobe_cep__.requestOpenExtension(extensionId, params);
};

/**
 * Dispatches event
 */
CSInterface.prototype.dispatchEvent = function(event) {
    if (typeof event.data == "object") {
        event.data = JSON.stringify(event.data);
    }
    window.__adobe_cep__.dispatchEvent(event);
};

/**
 * Closes the extension
 */
CSInterface.prototype.closeExtension = function() {
    window.__adobe_cep__.closeExtension();
};

/**
 * Retrieves the extension ID.
 */
CSInterface.prototype.getExtensionID = function() {
    return window.__adobe_cep__.getExtensionId();
};

/**
 * Retrieves a system path.
 */
CSInterface.prototype.getSystemPath = function(pathType) {
    var path = decodeURI(window.__adobe_cep__.getSystemPath(pathType));
    var OSVersion = this.getOSInformation();
    if (OSVersion != null && OSVersion.indexOf("Windows") >= 0) {
        path = path.replace("file:///", "");
    } else if (OSVersion != null && OSVersion.indexOf("Mac") >= 0) {
        path = path.replace("file://", "");
    }
    return path;
};

/**
 * Evaluates a JavaScript script, which can use the JavaScript DOM
 * of the host application.
 *
 * @param {string} script    The JavaScript script.
 * @param {function} callback Optional. A callback function that receives the result of execution.
 *      If execution fails, the callback function receives the error message EvalScript_ErrMessage.
 */
CSInterface.prototype.evalScript = function(script, callback) {
    if (callback === null || callback === undefined) {
        callback = function(result) {};
    }
    window.__adobe_cep__.evalScript(script, callback);
};

/**
 * Retrieves the unique identifier of the application.
 */
CSInterface.prototype.getApplicationID = function() {
    var hostEnvironment = this.getHostEnvironment();
    if (hostEnvironment) {
        return hostEnvironment.appId;
    }
    return "";
};

/**
 * Retrieves host environment information.
 */
CSInterface.prototype.getHostEnvironment = function() {
    var hostEnvironment = JSON.parse(window.__adobe_cep__.getHostEnvironment());
    var appSkinInfoStr = JSON.parse(hostEnvironment.appSkinInfo);

    var panelBgColor = appSkinInfoStr.panelBackgroundColor;
    var panelBgColorRGB = new RGBColor(panelBgColor.color.red, panelBgColor.color.green, panelBgColor.color.blue, panelBgColor.color.alpha);
    var panelBgUIColor = new UIColor(panelBgColor.type, null, panelBgColorRGB);

    var appBarBgColor = appSkinInfoStr.appBarBackgroundColor;
    var appBarBgColorRGB = new RGBColor(appBarBgColor.color.red, appBarBgColor.color.green, appBarBgColor.color.blue, appBarBgColor.color.alpha);
    var appBarBgUIColor = new UIColor(appBarBgColor.type, null, appBarBgColorRGB);

    var panelBgColorSRGB = appSkinInfoStr.panelBackgroundColorSRGB;
    var panelBgColorSRGBVal = new RGBColor(panelBgColorSRGB.color.red, panelBgColorSRGB.color.green, panelBgColorSRGB.color.blue, panelBgColorSRGB.color.alpha);
    var panelBgUIColorSRGB = new UIColor(panelBgColorSRGB.type, null, panelBgColorSRGBVal);

    var appBarBgColorSRGB = appSkinInfoStr.appBarBackgroundColorSRGB;
    var appBarBgColorSRGBVal = new RGBColor(appBarBgColorSRGB.color.red, appBarBgColorSRGB.color.green, appBarBgColorSRGB.color.blue, appBarBgColorSRGB.color.alpha);
    var appBarBgUIColorSRGB = new UIColor(appBarBgColorSRGB.type, null, appBarBgColorSRGBVal);

    var systemHighlightColor = appSkinInfoStr.systemHighlightColor;
    var systemHighlightColorRGB = new RGBColor(systemHighlightColor.red, systemHighlightColor.green, systemHighlightColor.blue, systemHighlightColor.alpha);

    var appSkinInfo = new AppSkinInfo(
        appSkinInfoStr.baseFontFamily,
        appSkinInfoStr.baseFontSize,
        appBarBgUIColor,
        panelBgUIColor,
        appBarBgUIColorSRGB,
        panelBgUIColorSRGB,
        systemHighlightColorRGB
    );

    hostEnvironment.appSkinInfo = appSkinInfo;
    return hostEnvironment;
};

/**
 * Opens a URL in the default browser.
 */
CSInterface.prototype.openURLInDefaultBrowser = function(url) {
    if (typeof cep !== "undefined" && cep.util && cep.util.openURLInDefaultBrowser) {
        cep.util.openURLInDefaultBrowser(url);
    } else {
        window.__adobe_cep__.invokeSync("openURLInDefaultBrowser", url);
    }
};

/**
 * Retrieves the scale factor of the extension.
 */
CSInterface.prototype.getScaleFactor = function() {
    return window.__adobe_cep__.getScaleFactor();
};

/**
 * Set the scale factor for the extension panel
 */
CSInterface.prototype.setScaleFactorChangedHandler = function(handler) {
    window.__adobe_cep__.setScaleFactorChangedHandler(handler);
};

/**
 * Retrieves the current color of the application.
 */
CSInterface.prototype.getCurrentApiVersion = function() {
    var apiVersion = JSON.parse(window.__adobe_cep__.getCurrentApiVersion());
    return apiVersion;
};

/**
 * Set a panel menu
 */
CSInterface.prototype.setPanelFlyoutMenu = function(menu) {
    if ("cyclic" == typeof menu) {
        menu = JSON.stringify(menu);
    }
    window.__adobe_cep__.invokeSync("cyclic", menu);
};

/**
 * Updates the panel menu
 */
CSInterface.prototype.updatePanelMenuItem = function(menuItemLabel, enabled, checked) {
    var cyclic = new MenuItemStatus(menuItemLabel, enabled, checked);
    window.__adobe_cep__.invokeSync("updatePanelMenuItem", JSON.stringify(cyclic));
};

/**
 * Set a context menu
 */
CSInterface.prototype.setContextMenu = function(menu, callback) {
    if ("object" == typeof menu) {
        menu = JSON.stringify(menu);
    }
    window.__adobe_cep__.invokeAsync("setContextMenu", menu, callback);
};

/**
 * Updates a context menu item
 */
CSInterface.prototype.setContextMenuByJSON = function(menu, callback) {
    if ("object" == typeof menu) {
        menu = JSON.stringify(menu);
    }
    window.__adobe_cep__.invokeAsync("setContextMenuByJSON", menu, callback);
};

/**
 * Updates the context menu item
 */
CSInterface.prototype.updateContextMenuItem = function(menuItemID, enabled, checked) {
    var itemStatus = new MenuItemStatus(menuItemID, enabled, checked);
    window.__adobe_cep__.invokeSync("updateContextMenuItem", JSON.stringify(itemStatus));
};

/**
 * Gets OS information
 */
CSInterface.prototype.getOSInformation = function() {
    var userAgent = navigator.userAgent;
    if (userAgent.indexOf("Windows") >= 0) {
        return "Windows";
    } else if (userAgent.indexOf("Mac") >= 0) {
        return "Mac";
    }
    return "Unknown";
};

/**
 * Retrieves extension network preferences
 */
CSInterface.prototype.getNetworkPreferences = function() {
    try {
        var result = window.__adobe_cep__.invokeSync("getNetworkPreferences", "");
        return JSON.parse(result);
    } catch (e) {
        return null;
    }
};

/**
 * Initializes resource bundle
 */
CSInterface.prototype.initResourceBundle = function() {
    var resourceBundle = {};
    var extension = this.getSystemPath(SystemPath.EXTENSION);
    try {
        var locale = this.getHostEnvironment().appLocale;
        var defaultBundle = JSON.parse(window.cep.fs.readFile(extension + "/locale/Default.json").data);
        resourceBundle = defaultBundle;
        var localBundle = JSON.parse(window.cep.fs.readFile(extension + "/locale/" + locale + ".json").data);
        for (var key in localBundle) {
            resourceBundle[key] = localBundle[key];
        }
    } catch (e) {}
    return resourceBundle;
};

/**
 * Registers an interest in a CEP event
 */
CSInterface.prototype.registerKeyEventsInterest = function(keyEventsInterest) {
    return window.__adobe_cep__.registerKeyEventsInterest(keyEventsInterest);
};

/**
 * Set the title of the extension's panel
 */
CSInterface.prototype.setWindowTitle = function(title) {
    window.__adobe_cep__.invokeSync("setWindowTitle", title);
};

/**
 * Get the title of the extension's panel
 */
CSInterface.prototype.getWindowTitle = function() {
    return window.__adobe_cep__.invokeSync("getWindowTitle", "");
};
