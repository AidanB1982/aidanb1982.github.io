    // =========================
    // BLACKWOOD CIRCLE ACCESS
    // Smart top-right member access link
    // Signed out: The Circle
    // Signed in: My Circle · points
    // =========================

    const CIRCLE_ACCESS_CONFIG = {
        supabaseUrl: "https://bmnlynjldlnxfvunqbqq.supabase.co",
        supabaseKey: "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0",
        membersPageUrl: "/pages/members.html",
        supabaseCdn: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
    };

    let circleClient = null;
    let circleRefreshId = 0;
    let circleAccessStarted = false;

    function initBlackwoodCircleAccess() {
        if (circleAccessStarted) return;

        circleAccessStarted = true;

        const circleLink = getOrCreateCircleAccessLink();

        renderCircleSignedOut(circleLink);
        startCircleSessionWatcher(circleLink);
    }

    function getOrCreateCircleAccessLink() {
        const existingLink = document.querySelector(".blackwood-circle-access");

        if (existingLink) {
            return existingLink;
        }

        const circleLink = document.createElement("a");
        circleLink.className = "blackwood-circle-access";
        circleLink.href = CIRCLE_ACCESS_CONFIG.membersPageUrl;
        circleLink.setAttribute("aria-label", "Open The Blackwood Circle member area");

        document.body.appendChild(circleLink);

        return circleLink;
    }

    async function startCircleSessionWatcher(circleLink) {
        try {
            await loadCircleSupabaseLibrary();

            circleClient = window.supabase.createClient(
                CIRCLE_ACCESS_CONFIG.supabaseUrl,
                CIRCLE_ACCESS_CONFIG.supabaseKey,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                }
            );

            const { data, error } = await circleClient.auth.getSession();

            if (error) {
                throw error;
            }

            await updateCircleAccessFromSession(circleLink, data.session || null);

            circleClient.auth.onAuthStateChange((_event, session) => {
                updateCircleAccessFromSession(circleLink, session || null);
            });

            window.addEventListener("focus", () => {
                refreshCircleAccess(circleLink);
            });

        } catch (error) {
            console.warn("Blackwood Circle access could not check member session:", error);
            renderCircleSignedOut(circleLink);
        }
    }

    async function refreshCircleAccess(circleLink) {
        if (!circleClient) return;

        try {
            const { data, error } = await circleClient.auth.getSession();

            if (error) {
                throw error;
            }

            await updateCircleAccessFromSession(circleLink, data.session || null);

        } catch (error) {
            console.warn("Blackwood Circle access refresh failed:", error);
        }
    }

    async function updateCircleAccessFromSession(circleLink, session) {
        const currentRefreshId = ++circleRefreshId;

        if (!session || !session.user) {
            renderCircleSignedOut(circleLink);
            return;
        }

        renderCircleLoading(circleLink);

        try {
            const { data, error } = await circleClient
                .from("member_profiles")
                .select("display_name, reader_name, points_total, member_tier")
                .eq("id", session.user.id)
                .maybeSingle();

            if (currentRefreshId !== circleRefreshId) {
                return;
            }

            if (error) {
                throw error;
            }

            renderCircleSignedIn(circleLink, data || {});

        } catch (error) {
            console.warn("Blackwood Circle profile check failed:", error);

            if (currentRefreshId === circleRefreshId) {
                renderCircleSignedIn(circleLink, {});
            }
        }
    }

    function renderCircleSignedOut(circleLink) {
        circleLink.classList.remove("is-signed-in", "is-loading");
        circleLink.href = CIRCLE_ACCESS_CONFIG.membersPageUrl;
        circleLink.setAttribute("aria-label", "Open The Blackwood Circle member area");
        circleLink.title = "The Blackwood Circle";

        circleLink.innerHTML = `
            <span class="blackwood-circle-access-mark" aria-hidden="true">◎</span>
            <span class="blackwood-circle-access-text">The Circle</span>
        `;
    }

    function renderCircleLoading(circleLink) {
        circleLink.classList.add("is-loading");
        circleLink.href = CIRCLE_ACCESS_CONFIG.membersPageUrl;
        circleLink.setAttribute("aria-label", "Opening your Blackwood Circle member record");

        circleLink.innerHTML = `
            <span class="blackwood-circle-access-mark" aria-hidden="true">◎</span>
            <span class="blackwood-circle-access-text">Checking...</span>
        `;
    }

    function renderCircleSignedIn(circleLink, profile) {
        const points = Number(profile.points_total || 0);
        const pointsLabel = points === 1 ? "1 pt" : `${points} pts`;

        circleLink.classList.remove("is-loading");
        circleLink.classList.add("is-signed-in");
        circleLink.href = CIRCLE_ACCESS_CONFIG.membersPageUrl;
        circleLink.setAttribute("aria-label", `Open your Blackwood Circle member area. ${pointsLabel}.`);
        circleLink.title = `My Circle · ${pointsLabel}`;

        circleLink.innerHTML = `
            <span class="blackwood-circle-access-mark" aria-hidden="true">◎</span>
            <span class="blackwood-circle-access-text">My Circle</span>
            <span class="blackwood-circle-access-points">${pointsLabel}</span>
        `;
    }

    function loadCircleSupabaseLibrary() {
        return new Promise((resolve, reject) => {
            if (window.supabase && typeof window.supabase.createClient === "function") {
                resolve();
                return;
            }

            const existingScript = document.querySelector("script[data-blackwood-supabase]");

            if (existingScript) {
                existingScript.addEventListener("load", () => resolve(), { once: true });
                existingScript.addEventListener("error", () => reject(new Error("Supabase could not be loaded.")), { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = CIRCLE_ACCESS_CONFIG.supabaseCdn;
            script.async = true;
            script.defer = true;
            script.dataset.blackwoodSupabase = "true";

            script.onload = () => {
                if (window.supabase && typeof window.supabase.createClient === "function") {
                    resolve();
                } else {
                    reject(new Error("Supabase loaded, but createClient was unavailable."));
                }
            };

            script.onerror = () => {
                reject(new Error("Supabase could not be loaded."));
            };

            document.head.appendChild(script);
        });
    }
