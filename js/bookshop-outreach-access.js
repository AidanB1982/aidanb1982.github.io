
"use strict";

// ==========================================
// BLACKWOOD PUBLISHING
// BOOKSHOP OUTREACH ACCESS CONTROLLER
//
// Uses the existing Blackwood Supabase project
// and member_profiles.is_admin permission.
//
// Loads the outreach application only after
// administrator verification succeeds.
//
// IMPORTANT:
// GitHub Pages files are publicly accessible.
// This controller gates the browser interface;
// it is not a substitute for server-side
// authorisation or Supabase RLS.
// ==========================================

(function () {
    const SUPABASE_URL =
        "https://bmnlynjldlnxfvunqbqq.supabase.co";

    const SUPABASE_PUBLISHABLE_KEY =
        "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0";

    const SUPABASE_CDN =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

    const OUTREACH_SCRIPT_URL =
        "/js/bookshop-outreach.js?v=14";

    const MEMBERS_URL =
        "/pages/members.html";

    const ACCESS_SCREEN_ID =
        "bookshop-access-screen";

    const ADMIN_CONTENT_ID =
        "bookshop-admin-content";

    const ACCESS_TITLE_ID =
        "bookshop-access-title";

    const ACCESS_MESSAGE_ID =
        "bookshop-access-message";

    let supabaseClient = null;

    // Allow the Bookshop Outreach application to use
    // the existing authenticated Supabase connection.
    //
    // This only exposes the public browser client,
    // never the Supabase service-role key or
    // Microsoft Graph credentials.
    //
    // Administrator permission is also checked
    // independently inside the Edge Function.

    window.blackwoodBookshopAuth = Object.freeze({
        getClient: function () {
            if (
                !administratorApproved ||
                !supabaseClient
            ) {
                throw new Error(
                    "Bookshop administrator access is not verified."
                );
            }

            return supabaseClient;
        },

        isAdministrator: function () {
            return administratorApproved === true;
        }
    });

    let accessCheckVersion = 0;

    let outreachScriptPromise = null;

    let outreachLoaded = false;

    let administratorApproved = false;

    let verificationInProgress = false;

    // ==========================================
    // PAGE INITIALISATION
    // ==========================================

    window.addEventListener("load", async function () {
        const accessScreen =
            document.getElementById(ACCESS_SCREEN_ID);

        const adminContent =
            document.getElementById(ADMIN_CONTENT_ID);

        if (!accessScreen || !adminContent) {
            console.error(
                "Bookshop Outreach: Required access elements are missing."
            );

            return;
        }

        lockWorkspace();

        showAccessMessage(
            "Verifying Access",
            "Checking your Archivist administrator credentials…"
        );

        try {
            if (typeof window.loadHeader === "function") {
                await window.loadHeader("simple");
            }
        } catch (error) {
            console.warn(
                "Bookshop Outreach: Shared header could not be loaded.",
                error
            );
        }

        await initializeAdminAccess();
    });

    // ==========================================
    // SUPABASE LIBRARY
    // ==========================================

    function loadSupabaseLibrary() {
        return new Promise(function (resolve, reject) {
            if (
                window.supabase &&
                typeof window.supabase.createClient === "function"
            ) {
                resolve();

                return;
            }

            const existingScript =
                document.querySelector(
                    'script[data-bookshop-supabase="true"]'
                );

            if (existingScript) {
                existingScript.addEventListener(
                    "load",
                    function () {
                        if (
                            window.supabase &&
                            typeof window.supabase.createClient === "function"
                        ) {
                            resolve();
                        } else {
                            reject(
                                new Error(
                                    "Supabase loaded without createClient."
                                )
                            );
                        }
                    },
                    { once: true }
                );

                existingScript.addEventListener(
                    "error",
                    function () {
                        reject(
                            new Error(
                                "The Supabase library could not be loaded."
                            )
                        );
                    },
                    { once: true }
                );

                return;
            }

            const script =
                document.createElement("script");

            script.src = SUPABASE_CDN;

            script.async = true;

            script.dataset.bookshopSupabase = "true";

            script.onload = function () {
                if (
                    window.supabase &&
                    typeof window.supabase.createClient === "function"
                ) {
                    resolve();
                } else {
                    reject(
                        new Error(
                            "Supabase loaded without createClient."
                        )
                    );
                }
            };

            script.onerror = function () {
                reject(
                    new Error(
                        "The Supabase library could not be loaded."
                    )
                );
            };

            document.head.appendChild(script);
        });
    }

    // ==========================================
    // AUTHENTICATION INITIALISATION
    // ==========================================

    async function initializeAdminAccess() {
        showAccessMessage(
            "Verifying Access",
            "Connecting to Blackwood administrator verification…"
        );

        try {
            await loadSupabaseLibrary();

            if (
                !window.supabase ||
                typeof window.supabase.createClient !== "function"
            ) {
                throw new Error(
                    "Supabase authentication is unavailable."
                );
            }

            supabaseClient =
                window.supabase.createClient(
                    SUPABASE_URL,
                    SUPABASE_PUBLISHABLE_KEY,
                    {
                        auth: {
                            persistSession: true,
                            autoRefreshToken: true,
                            detectSessionInUrl: true
                        }
                    }
                );

            // Keep the callback synchronous.
            // Schedule verification outside the
            // Supabase authentication callback.
            supabaseClient.auth.onAuthStateChange(
                function (event) {
                    if (event === "SIGNED_OUT") {
                        accessCheckVersion += 1;

                        administratorApproved = false;

                        lockWorkspace();

                        showAccessMessage(
                            "Sign In Required",
                            "Your Archivist session has ended. Please sign in again through The Archivists."
                        );

                        return;
                    }

                    if (
                        event === "SIGNED_IN" ||
                        event === "TOKEN_REFRESHED" ||
                        event === "USER_UPDATED"
                    ) {
                        window.setTimeout(
                            function () {
                                void verifyAdminAccess();
                            },
                            0
                        );
                    }
                }
            );

            await verifyAdminAccess();

        } catch (error) {
            console.error(
                "Bookshop Outreach: Authentication setup failed.",
                error
            );

            administratorApproved = false;

            lockWorkspace();

            showAccessMessage(
                "Access Unavailable",
                "We could not verify your administrator credentials. Please return to The Archivists and try again."
            );
        }
    }

    // ==========================================
    // ADMINISTRATOR VERIFICATION
    // ==========================================

    async function verifyAdminAccess() {
        const checkVersion =
            ++accessCheckVersion;

        verificationInProgress = true;

        administratorApproved = false;

        lockWorkspace();

        showAccessMessage(
            "Verifying Access",
            "Checking your Blackwood Publishing administrator permission…"
        );

        if (!supabaseClient) {
            verificationInProgress = false;

            showAccessMessage(
                "Access Unavailable",
                "The administrator connection is not ready."
            );

            return;
        }

        try {
            // Validate the user against Supabase Auth.
            const userResult =
                await supabaseClient.auth.getUser();

            if (checkVersion !== accessCheckVersion) {
                return;
            }

            if (
                userResult.error ||
                !userResult.data ||
                !userResult.data.user
            ) {
                showAccessMessage(
                    "Sign In Required",
                    "Please sign in to The Archivists before opening Bookshop Outreach."
                );

                return;
            }

            const user =
                userResult.data.user;

            // Check the existing Blackwood
            // administrator permission.
            const profileResult =
                await supabaseClient
                    .from("member_profiles")
                    .select("is_admin")
                    .eq("id", user.id)
                    .maybeSingle();

            if (checkVersion !== accessCheckVersion) {
                return;
            }

            if (profileResult.error) {
                console.error(
                    "Bookshop Outreach: Administrator profile lookup failed.",
                    profileResult.error
                );

                showAccessMessage(
                    "Access Unavailable",
                    "Your administrator permission could not be verified. Please try again later."
                );

                return;
            }

            const profile =
                profileResult.data;

            const isAdmin =
                Boolean(
                    profile &&
                    (
                        profile.is_admin === true ||
                        String(
                            profile.is_admin
                        ).toLowerCase() === "true"
                    )
                );

            if (!isAdmin) {
                showAccessMessage(
                    "Access Denied",
                    "This workspace is reserved for Blackwood Publishing management."
                );

                return;
            }

            // Administrator verification succeeded.
            administratorApproved = true;

            showAccessMessage(
                "Opening Management Desk",
                "Administrator verified. Preparing Bookshop Outreach…"
            );

            await loadOutreachApplication();

            if (
                checkVersion !== accessCheckVersion ||
                !administratorApproved
            ) {
                return;
            }

            unlockWorkspace();

        } catch (error) {
            if (checkVersion !== accessCheckVersion) {
                return;
            }

            console.error(
                "Bookshop Outreach: Administrator verification failed.",
                error
            );

            administratorApproved = false;

            lockWorkspace();

            showAccessMessage(
                "Access Unavailable",
                "We could not verify your administrator access. Please return to The Archivists and try again."
            );

        } finally {
            if (checkVersion === accessCheckVersion) {
                verificationInProgress = false;
            }
        }
    }

    // ==========================================
    // LOAD OUTREACH APPLICATION
    // ==========================================

    function loadOutreachApplication() {
        if (outreachLoaded) {
            return Promise.resolve();
        }

        if (outreachScriptPromise) {
            return outreachScriptPromise;
        }

        outreachScriptPromise =
            new Promise(function (resolve, reject) {
                const script =
                    document.createElement("script");

                script.src =
                    OUTREACH_SCRIPT_URL;

                script.async = true;

                script.dataset.bookshopOutreach = "true";

                script.onload = function () {
                    outreachLoaded = true;

                    resolve();
                };

                script.onerror = function () {
                    reject(
                        new Error(
                            "The Bookshop Outreach application could not be loaded."
                        )
                    );
                };

                document.body.appendChild(script);
            });

        outreachScriptPromise =
            outreachScriptPromise.catch(
                function (error) {
                    outreachScriptPromise = null;

                    throw error;
                }
            );

        return outreachScriptPromise;
    }

    // ==========================================
    // WORKSPACE VISIBILITY
    // ==========================================

    function lockWorkspace() {
        const accessScreen =
            document.getElementById(ACCESS_SCREEN_ID);

        const adminContent =
            document.getElementById(ADMIN_CONTENT_ID);

        if (adminContent) {
            adminContent.hidden = true;

            adminContent.setAttribute(
                "aria-hidden",
                "true"
            );
        }

        if (accessScreen) {
            accessScreen.hidden = false;
        }
    }

    function unlockWorkspace() {
        if (!administratorApproved) {
            return;
        }

        const accessScreen =
            document.getElementById(ACCESS_SCREEN_ID);

        const adminContent =
            document.getElementById(ADMIN_CONTENT_ID);

        if (!accessScreen || !adminContent) {
            return;
        }

        adminContent.hidden = false;

        adminContent.removeAttribute(
            "aria-hidden"
        );

        accessScreen.hidden = true;

        // Leaflet may have initialised while its
        // container was hidden. Trigger a resize
        // after revealing the workspace.
        window.requestAnimationFrame(
            function () {
                window.dispatchEvent(
                    new Event("resize")
                );
            }
        );
    }

    // ==========================================
    // ACCESS SCREEN MESSAGES
    // ==========================================

    function showAccessMessage(title, message) {
        const titleElement =
            document.getElementById(ACCESS_TITLE_ID);

        const messageElement =
            document.getElementById(ACCESS_MESSAGE_ID);

        if (titleElement) {
            titleElement.textContent = title;
        }

        if (messageElement) {
            messageElement.textContent = message;
        }
    }

    // ==========================================
    // RECHECK ACCESS WHEN RETURNING TO PAGE
    // ==========================================

    document.addEventListener(
        "visibilitychange",
        function () {
            if (
                document.visibilityState === "visible" &&
                supabaseClient &&
                !verificationInProgress
            ) {
                void verifyAdminAccess();
            }
        }
    );

    window.addEventListener(
        "pageshow",
        function (event) {
            if (
                event.persisted &&
                supabaseClient &&
                !verificationInProgress
            ) {
                void verifyAdminAccess();
            }
        }
    );

})();
