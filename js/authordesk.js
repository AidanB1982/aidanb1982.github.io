(function () {
    "use strict";

    const SUPABASE_URL =
        "https://bmnlynjldlnxfvunqbqq.supabase.co";

    const SUPABASE_KEY =
        "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0";

    const client = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );

    const loadingPanel =
        document.getElementById("loading-panel");

    const accessPanel =
        document.getElementById("access-panel");

    const accessTitle =
        document.getElementById("access-title");

    const accessMessage =
        document.getElementById("access-message");

    const desk =
        document.getElementById("desk");

    const authorName =
        document.getElementById("author-name");

    const authorStatus =
        document.getElementById("author-status");

    const welcomeHeading =
        document.getElementById("welcome-heading");

    const bookCount =
        document.getElementById("book-count");

    const relationshipSummary =
        document.getElementById("relationship-summary");

    const overviewBookList =
        document.getElementById("overview-book-list");

    const booksBookList =
        document.getElementById("books-book-list");

    const productionContent =
        document.getElementById("production-content");

    const documentsRightsContent =
        document.getElementById("documents-rights-content");

    const statementCount =
        document.getElementById("statement-count");

    const paymentCount =
        document.getElementById("payment-count");

    const paymentRequestCount =
        document.getElementById("payment-request-count");

    const statementList =
        document.getElementById("statement-list");

    const paymentList =
        document.getElementById("payment-list");

    const paymentRequestList =
        document.getElementById("payment-request-list");

    const signOutButton =
        document.getElementById("sign-out-button");

    const navButtons =
        Array.from(
            document.querySelectorAll(".nav-button")
        );

    const deskSections =
        Array.from(
            document.querySelectorAll(".desk-section")
        );

    initialiseDesk();

    navButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            showSection(button.dataset.section);
        });
    });

    signOutButton.addEventListener(
        "click",
        handleSignOut
    );

    async function initialiseDesk() {
        try {
            const {
                data: sessionData,
                error: sessionError
            } = await client.auth.getSession();

            if (sessionError) {
                throw sessionError;
            }

            const session =
                sessionData.session;

            if (!session || !session.user) {
                showAccessMessage(
                    "Sign in required",
                    "You need to be signed in with an authorised Blackwood Publishing author account to open the Author Desk."
                );

                return;
            }

            const authorRecord =
                await loadAuthorRecord(
                    session.user.id
                );

            if (!authorRecord) {
                showAccessMessage(
                    "Author Desk unavailable",
                    "This account does not currently have access to an Author Desk."
                );

                return;
            }

            const [
                books,
                productionData,
                legalData,
                financeData
            ] = await Promise.all([
                loadBooks(),
                loadProductionData(),
                loadLegalData(),
                loadFinanceData()
            ]);

            renderDesk(
                authorRecord,
                books,
                productionData,
                legalData,
                financeData
            );

        } catch (error) {
            console.error(
                "Author Desk failed to initialise:",
                error
            );

            showAccessMessage(
                "Author Desk could not be opened",
                "There was a problem loading your publishing records. Please try again."
            );
        }
    }

    async function loadAuthorRecord(userId) {
        const { data, error } = await client
            .from("author_records")
            .select(
                "id,publishing_name,email,relationship_status,desk_access_enabled"
            )
            .eq("id", userId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (
            !data ||
            data.desk_access_enabled !== true
        ) {
            return null;
        }

        return data;
    }

    async function loadBooks() {
        const { data, error } = await client
            .from("book_records")
            .select(
                "id,internal_reference,title,subtitle,work_status,production_stage,acquired_on,contracted_on,created_at"
            )
            .order("id", {
                ascending: true
            });

        if (error) {
            throw error;
        }

        return Array.isArray(data)
            ? data
            : [];
    }

    async function loadProductionData() {
        const [
            productionEventsResponse,
            editionsResponse,
            actionsResponse
        ] = await Promise.all([
            client
                .from("production_events")
                .select(
                    "id,book_id,event_type,from_stage,to_stage,event_date,note,author_visible,created_at"
                )
                .order("event_date", {
                    ascending: false
                })
                .order("id", {
                    ascending: false
                }),

            client
                .from("book_editions")
                .select(
                    "id,book_id,edition_reference,edition_name,format,isbn,publication_date,status,territory,language,list_price,currency,author_visible,created_at"
                )
                .order("id", {
                    ascending: true
                }),

            client
                .from("author_actions")
                .select(
                    "id,book_id,action_type,title,description,due_at,status,author_visible,completed_at,created_at,updated_at"
                )
                .order("id", {
                    ascending: true
                })
        ]);

        if (productionEventsResponse.error) {
            throw productionEventsResponse.error;
        }

        if (editionsResponse.error) {
            throw editionsResponse.error;
        }

        if (actionsResponse.error) {
            throw actionsResponse.error;
        }

        return {
            events:
                Array.isArray(
                    productionEventsResponse.data
                )
                    ? productionEventsResponse.data
                    : [],

            editions:
                Array.isArray(
                    editionsResponse.data
                )
                    ? editionsResponse.data
                    : [],

            actions:
                Array.isArray(
                    actionsResponse.data
                )
                    ? actionsResponse.data
                    : []
        };
    }

    async function loadLegalData() {
        const [
            documentsResponse,
            agreementsResponse,
            rightsResponse,
            rightsEventsResponse
        ] = await Promise.all([
            client
                .from("documents")
                .select(
                    "id,author_id,book_id,edition_id,document_type,title,version,storage_bucket,storage_path,mime_type,author_visible,requires_signature,signed_at,issued_at,supersedes_document_id,created_at,updated_at"
                )
                .order("id", {
                    ascending: true
                }),

            client
                .from("agreements")
                .select(
                    "id,author_id,book_id,agreement_type,agreement_reference,title,agreement_date,effective_date,expiry_date,status,signed_document_id,summary_author,author_visible,created_at,updated_at"
                )
                .order("id", {
                    ascending: true
                }),

            client
                .from("rights")
                .select(
                    "id,agreement_id,author_id,book_id,rights_reference,right_type,format_scope,territory,language,exclusivity,effective_date,expiry_date,status,summary_author,author_visible,created_at,updated_at"
                )
                .order("id", {
                    ascending: true
                }),

            client
                .from("rights_events")
                .select(
                    "id,right_id,event_type,event_date,description_author,author_visible,document_id,created_at"
                )
                .order("event_date", {
                    ascending: false
                })
                .order("id", {
                    ascending: false
                })
        ]);

        if (documentsResponse.error) {
            throw documentsResponse.error;
        }

        if (agreementsResponse.error) {
            throw agreementsResponse.error;
        }

        if (rightsResponse.error) {
            throw rightsResponse.error;
        }

        if (rightsEventsResponse.error) {
            throw rightsEventsResponse.error;
        }

        return {
            documents:
                Array.isArray(
                    documentsResponse.data
                )
                    ? documentsResponse.data
                    : [],

            agreements:
                Array.isArray(
                    agreementsResponse.data
                )
                    ? agreementsResponse.data
                    : [],

            rights:
                Array.isArray(
                    rightsResponse.data
                )
                    ? rightsResponse.data
                    : [],

            rightsEvents:
                Array.isArray(
                    rightsEventsResponse.data
                )
                    ? rightsEventsResponse.data
                    : []
        };
    }

    async function loadFinanceData() {
        const [
            statementsResponse,
            statementLinesResponse,
            paymentsResponse,
            paymentAllocationsResponse,
            paymentRequestsResponse,
            advancesResponse
        ] = await Promise.all([
            client
                .from("royalty_statements")
                .select(
                    "id,author_id,statement_reference,period_start,period_end,issue_date,currency,total_royalty_amount,total_adjustments,total_advance_applied,amount_payable,status,author_visible,supersedes_statement_id,created_at,updated_at"
                )
                .order("issue_date", {
                    ascending: false,
                    nullsFirst: false
                })
                .order("id", {
                    ascending: false
                }),

            client
                .from("royalty_statement_lines")
                .select(
                    "id,statement_id,line_number,line_type,royalty_entry_id,royalty_adjustment_id,advance_id,description,amount,created_at"
                )
                .order("statement_id", {
                    ascending: true
                })
                .order("line_number", {
                    ascending: true
                }),

            client
                .from("payments")
                .select(
                    "id,author_id,payment_reference,currency,amount,status,requested_at,approved_at,processing_at,paid_at,failed_at,cancelled_at,payment_method_reference,author_visible,created_at,updated_at"
                )
                .order("created_at", {
                    ascending: false
                })
                .order("id", {
                    ascending: false
                }),

            client
                .from("payment_allocations")
                .select(
                    "id,payment_id,statement_id,amount,created_at"
                )
                .order("id", {
                    ascending: true
                }),

            client
                .from("payment_requests")
                .select(
                    "id,author_id,request_reference,requested_amount,currency,status,requested_at,reviewed_at,fulfilled_at,payment_id,created_at,updated_at"
                )
                .order("requested_at", {
                    ascending: false
                })
                .order("id", {
                    ascending: false
                }),

            client
                .from("advances")
                .select(
                    "id,agreement_id,author_id,book_id,advance_reference,currency,total_amount,status,agreed_date,summary_author,author_visible,created_at,updated_at"
                )
                .order("id", {
                    ascending: true
                })
        ]);

        if (statementsResponse.error) {
            throw statementsResponse.error;
        }

        if (statementLinesResponse.error) {
            throw statementLinesResponse.error;
        }

        if (paymentsResponse.error) {
            throw paymentsResponse.error;
        }

        if (paymentAllocationsResponse.error) {
            throw paymentAllocationsResponse.error;
        }

        if (paymentRequestsResponse.error) {
            throw paymentRequestsResponse.error;
        }

        if (advancesResponse.error) {
            throw advancesResponse.error;
        }

        return {
            statements:
                Array.isArray(
                    statementsResponse.data
                )
                    ? statementsResponse.data
                    : [],

            statementLines:
                Array.isArray(
                    statementLinesResponse.data
                )
                    ? statementLinesResponse.data
                    : [],

            payments:
                Array.isArray(
                    paymentsResponse.data
                )
                    ? paymentsResponse.data
                    : [],

            paymentAllocations:
                Array.isArray(
                    paymentAllocationsResponse.data
                )
                    ? paymentAllocationsResponse.data
                    : [],

            paymentRequests:
                Array.isArray(
                    paymentRequestsResponse.data
                )
                    ? paymentRequestsResponse.data
                    : [],

            advances:
                Array.isArray(
                    advancesResponse.data
                )
                    ? advancesResponse.data
                    : []
        };
    }

    function renderDesk(
        authorRecord,
        books,
        productionData,
        legalData,
        financeData
    ) {
        loadingPanel.hidden = true;
        accessPanel.hidden = true;
        desk.hidden = false;

        const displayName =
            authorRecord.publishing_name ||
            "Blackwood Author";

        authorName.textContent =
            displayName;

        authorStatus.textContent =
            formatLabel(
                authorRecord.relationship_status
            );

        welcomeHeading.textContent =
            "Welcome, " + displayName;

        bookCount.textContent =
            String(books.length);

        relationshipSummary.textContent =
            formatLabel(
                authorRecord.relationship_status
            );

        renderBookList(
            overviewBookList,
            books
        );

        renderBookList(
            booksBookList,
            books
        );

        renderProduction(
            books,
            productionData
        );

        renderDocumentsAndRights(
            books,
            legalData
        );

        renderFinance(
            financeData
        );
    }

    function renderBookList(
        container,
        books
    ) {
        container.replaceChildren();

        if (books.length === 0) {
            container.appendChild(
                createEmptyState(
                    "No Book Records are currently available in your Author Desk."
                )
            );

            return;
        }

        books.forEach(function (book) {
            container.appendChild(
                createBookCard(book)
            );
        });
    }

    function createBookCard(book) {
        const card =
            document.createElement("article");

        card.className =
            "book-card";

        const top =
            document.createElement("div");

        top.className =
            "book-card-top";

        const titleGroup =
            document.createElement("div");

        const title =
            document.createElement("h3");

        title.className =
            "book-title";

        title.textContent =
            book.title ||
            "Untitled Book Record";

        titleGroup.appendChild(title);

        if (book.subtitle) {
            const subtitle =
                document.createElement("p");

            subtitle.className =
                "book-subtitle";

            subtitle.textContent =
                book.subtitle;

            titleGroup.appendChild(
                subtitle
            );
        }

        top.appendChild(
            titleGroup
        );

        top.appendChild(
            createStatusBadge(
                formatLabel(
                    book.production_stage
                )
            )
        );

        const meta =
            document.createElement("div");

        meta.className =
            "book-meta";

        meta.appendChild(
            createMetaItem(
                "Book Record",
                book.internal_reference
            )
        );

        meta.appendChild(
            createMetaItem(
                "Work Status",
                formatLabel(
                    book.work_status
                )
            )
        );

        meta.appendChild(
            createMetaItem(
                "Production Stage",
                formatLabel(
                    book.production_stage
                )
            )
        );

        card.appendChild(top);
        card.appendChild(meta);

        return card;
    }

    function renderProduction(
        books,
        productionData
    ) {
        productionContent.replaceChildren();

        if (books.length === 0) {
            productionContent.appendChild(
                createEmptyState(
                    "No production records are currently available in your Author Desk."
                )
            );

            return;
        }

        books.forEach(function (book) {
            const bookEvents =
                productionData.events.filter(
                    function (event) {
                        return (
                            event.book_id ===
                            book.id
                        );
                    }
                );

            const bookEditions =
                productionData.editions.filter(
                    function (edition) {
                        return (
                            edition.book_id ===
                            book.id
                        );
                    }
                );

            const bookActions =
                productionData.actions.filter(
                    function (action) {
                        return (
                            action.book_id ===
                            book.id
                        );
                    }
                );

            productionContent.appendChild(
                createProductionBook(
                    book,
                    bookEvents,
                    bookEditions,
                    bookActions
                )
            );
        });
    }

    function createProductionBook(
        book,
        events,
        editions,
        actions
    ) {
        const wrapper =
            document.createElement("div");

        wrapper.className =
            "production-book";

        const heading =
            document.createElement("div");

        heading.className =
            "production-book-heading";

        const title =
            document.createElement("h3");

        title.textContent =
            book.title ||
            "Untitled Book Record";

        const reference =
            document.createElement("p");

        reference.className =
            "production-reference";

        reference.textContent =
            book.internal_reference ||
            "Book Record";

        heading.appendChild(title);
        heading.appendChild(reference);
        wrapper.appendChild(heading);

        const summary =
            document.createElement("div");

        summary.className =
            "production-summary";

        summary.appendChild(
            createSummaryRecord(
                "Current Stage",
                formatLabel(
                    book.production_stage
                ),
                "production-summary-card"
            )
        );

        summary.appendChild(
            createSummaryRecord(
                "Work Status",
                formatLabel(
                    book.work_status
                ),
                "production-summary-card"
            )
        );

        wrapper.appendChild(summary);

        wrapper.appendChild(
            createActionsPanel(
                actions
            )
        );

        wrapper.appendChild(
            createEditionsPanel(
                editions
            )
        );

        wrapper.appendChild(
            createProductionHistoryPanel(
                events
            )
        );

        return wrapper;
    }

    function createActionsPanel(actions) {
        const panel =
            createContentPanel(
                "Author Actions",
                "Current actions and information recorded for you during production."
            );

        if (actions.length === 0) {
            panel.appendChild(
                createEmptyState(
                    "No author actions are currently recorded."
                )
            );

            return panel;
        }

        const list =
            document.createElement("div");

        list.className =
            "action-list";

        actions.forEach(function (action) {
            const card =
                document.createElement("article");

            card.className =
                "action-card";

            const top =
                document.createElement("div");

            top.className =
                "action-card-top";

            const title =
                document.createElement("h4");

            title.className =
                "record-title";

            title.textContent =
                action.title ||
                formatLabel(
                    action.action_type
                );

            top.appendChild(title);

            top.appendChild(
                createStatusBadge(
                    formatLabel(
                        action.status
                    )
                )
            );

            card.appendChild(top);

            if (action.description) {
                const description =
                    document.createElement("p");

                description.className =
                    "record-description";

                description.textContent =
                    action.description;

                card.appendChild(
                    description
                );
            }

            const meta =
                document.createElement("div");

            meta.className =
                "record-meta";

            if (action.due_at) {
                meta.appendChild(
                    createInlineMeta(
                        "Due",
                        formatDate(
                            action.due_at
                        )
                    )
                );
            }

            if (action.completed_at) {
                meta.appendChild(
                    createInlineMeta(
                        "Completed",
                        formatDate(
                            action.completed_at
                        )
                    )
                );
            }

            if (
                meta.childElementCount > 0
            ) {
                card.appendChild(meta);
            }

            list.appendChild(card);
        });

        panel.appendChild(list);

        return panel;
    }

    function createEditionsPanel(editions) {
        const panel =
            createContentPanel(
                "Editions",
                "Edition records currently associated with this Book Record."
            );

        if (editions.length === 0) {
            panel.appendChild(
                createEmptyState(
                    "No author-visible editions are currently recorded."
                )
            );

            return panel;
        }

        const list =
            document.createElement("div");

        list.className =
            "edition-list";

        editions.forEach(
            function (edition) {
                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "edition-card";

                const top =
                    document.createElement(
                        "div"
                    );

                top.className =
                    "edition-card-top";

                const title =
                    document.createElement(
                        "h4"
                    );

                title.className =
                    "record-title";

                title.textContent =
                    edition.edition_name ||
                    formatLabel(
                        edition.format
                    );

                top.appendChild(title);

                top.appendChild(
                    createStatusBadge(
                        formatLabel(
                            edition.status
                        )
                    )
                );

                card.appendChild(top);

                const meta =
                    document.createElement(
                        "div"
                    );

                meta.className =
                    "record-meta";

                meta.appendChild(
                    createInlineMeta(
                        "Format",
                        formatLabel(
                            edition.format
                        )
                    )
                );

                if (
                    edition.publication_date
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Publication",
                            formatDate(
                                edition.publication_date
                            )
                        )
                    );
                }

                if (edition.isbn) {
                    meta.appendChild(
                        createInlineMeta(
                            "ISBN",
                            edition.isbn
                        )
                    );
                }

                if (
                    edition.list_price !==
                        null &&
                    edition.list_price !==
                        undefined &&
                    edition.currency
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "List price",
                            formatMoney(
                                edition.list_price,
                                edition.currency
                            )
                        )
                    );
                }

                if (
                    edition.edition_reference
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Edition Record",
                            edition.edition_reference
                        )
                    );
                }

                card.appendChild(meta);
                list.appendChild(card);
            }
        );

        panel.appendChild(list);

        return panel;
    }

    function createProductionHistoryPanel(
        events
    ) {
        const panel =
            createContentPanel(
                "Production History",
                "Author-visible milestones recorded against this Book Record."
            );

        if (events.length === 0) {
            panel.appendChild(
                createEmptyState(
                    "No author-visible production history is currently recorded."
                )
            );

            return panel;
        }

        const timeline =
            document.createElement("div");

        timeline.className =
            "timeline";

        events.forEach(function (event) {
            const item =
                document.createElement(
                    "article"
                );

            item.className =
                "timeline-item";

            const date =
                document.createElement("p");

            date.className =
                "timeline-date";

            date.textContent =
                formatDate(
                    event.event_date
                );

            const title =
                document.createElement("h4");

            title.className =
                "timeline-title";

            title.textContent =
                event.to_stage
                    ? formatLabel(
                        event.to_stage
                    )
                    : formatLabel(
                        event.event_type
                    );

            item.appendChild(date);
            item.appendChild(title);

            if (
                event.from_stage &&
                event.to_stage
            ) {
                const transition =
                    document.createElement(
                        "p"
                    );

                transition.className =
                    "record-description";

                transition.textContent =
                    formatLabel(
                        event.from_stage
                    ) +
                    " → " +
                    formatLabel(
                        event.to_stage
                    );

                item.appendChild(
                    transition
                );
            }

            if (event.note) {
                const note =
                    document.createElement(
                        "p"
                    );

                note.className =
                    "timeline-note";

                note.textContent =
                    event.note;

                item.appendChild(note);
            }

            timeline.appendChild(item);
        });

        panel.appendChild(timeline);

        return panel;
    }

    function renderDocumentsAndRights(
        books,
        legalData
    ) {
        documentsRightsContent.replaceChildren();

        const accountDocuments =
            legalData.documents.filter(
                function (documentRecord) {
                    return (
                        documentRecord.book_id ===
                        null
                    );
                }
            );

        const accountAgreements =
            legalData.agreements.filter(
                function (agreement) {
                    return (
                        agreement.book_id ===
                        null
                    );
                }
            );

        const accountRights =
            legalData.rights.filter(
                function (right) {
                    return (
                        right.book_id ===
                        null
                    );
                }
            );

        if (
            accountDocuments.length > 0 ||
            accountAgreements.length > 0 ||
            accountRights.length > 0
        ) {
            documentsRightsContent.appendChild(
                createLegalRecordGroup(
                    "General publishing records",
                    "Author-visible records associated with your publishing relationship rather than one particular Book Record.",
                    accountDocuments,
                    accountAgreements,
                    accountRights,
                    legalData.rightsEvents
                )
            );
        }

        if (books.length === 0) {
            if (
                accountDocuments.length === 0 &&
                accountAgreements.length === 0 &&
                accountRights.length === 0
            ) {
                documentsRightsContent.appendChild(
                    createEmptyState(
                        "No author-visible documents, agreements or rights records are currently available."
                    )
                );
            }

            return;
        }

        books.forEach(function (book) {
            const documents =
                legalData.documents.filter(
                    function (
                        documentRecord
                    ) {
                        return (
                            documentRecord.book_id ===
                            book.id
                        );
                    }
                );

            const agreements =
                legalData.agreements.filter(
                    function (agreement) {
                        return (
                            agreement.book_id ===
                            book.id
                        );
                    }
                );

            const rights =
                legalData.rights.filter(
                    function (right) {
                        return (
                            right.book_id ===
                            book.id
                        );
                    }
                );

            documentsRightsContent.appendChild(
                createLegalBook(
                    book,
                    documents,
                    agreements,
                    rights,
                    legalData.rightsEvents
                )
            );
        });
    }

    function createLegalBook(
        book,
        documents,
        agreements,
        rights,
        rightsEvents
    ) {
        const wrapper =
            document.createElement("div");

        wrapper.className =
            "legal-book";

        const heading =
            document.createElement("div");

        heading.className =
            "legal-book-heading";

        const title =
            document.createElement("h3");

        title.textContent =
            book.title ||
            "Untitled Book Record";

        const reference =
            document.createElement("p");

        reference.className =
            "legal-reference";

        reference.textContent =
            book.internal_reference ||
            "Book Record";

        heading.appendChild(title);
        heading.appendChild(reference);
        wrapper.appendChild(heading);

        const summary =
            document.createElement("div");

        summary.className =
            "legal-summary";

        summary.appendChild(
            createSummaryRecord(
                "Documents",
                String(
                    documents.length
                ),
                "legal-summary-card"
            )
        );

        summary.appendChild(
            createSummaryRecord(
                "Rights Records",
                String(
                    rights.length
                ),
                "legal-summary-card"
            )
        );

        wrapper.appendChild(summary);

        wrapper.appendChild(
            createDocumentsPanel(
                documents
            )
        );

        wrapper.appendChild(
            createAgreementsPanel(
                agreements
            )
        );

        wrapper.appendChild(
            createRightsPanel(
                rights,
                rightsEvents
            )
        );

        return wrapper;
    }

    function createLegalRecordGroup(
        title,
        intro,
        documents,
        agreements,
        rights,
        rightsEvents
    ) {
        const wrapper =
            document.createElement("div");

        wrapper.className =
            "legal-book";

        const heading =
            document.createElement("div");

        heading.className =
            "legal-book-heading";

        const headingTitle =
            document.createElement("h3");

        headingTitle.textContent =
            title;

        const headingIntro =
            document.createElement("p");

        headingIntro.className =
            "panel-intro";

        headingIntro.textContent =
            intro;

        heading.appendChild(
            headingTitle
        );

        heading.appendChild(
            headingIntro
        );

        wrapper.appendChild(heading);

        wrapper.appendChild(
            createDocumentsPanel(
                documents
            )
        );

        wrapper.appendChild(
            createAgreementsPanel(
                agreements
            )
        );

        wrapper.appendChild(
            createRightsPanel(
                rights,
                rightsEvents
            )
        );

        return wrapper;
    }

    function createDocumentsPanel(
        documents
    ) {
        const panel =
            createContentPanel(
                "Documents",
                "Author-visible publishing documents associated with this record."
            );

        if (documents.length === 0) {
            panel.appendChild(
                createEmptyState(
                    "No author-visible documents are currently recorded."
                )
            );

            return panel;
        }

        const list =
            document.createElement("div");

        list.className =
            "record-list";

        documents.forEach(
            function (documentRecord) {
                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "record-card";

                const top =
                    document.createElement(
                        "div"
                    );

                top.className =
                    "record-card-top";

                const title =
                    document.createElement(
                        "h4"
                    );

                title.className =
                    "record-title";

                title.textContent =
                    documentRecord.title ||
                    formatLabel(
                        documentRecord.document_type
                    );

                top.appendChild(title);

                if (
                    documentRecord.requires_signature
                ) {
                    top.appendChild(
                        createStatusBadge(
                            documentRecord.signed_at
                                ? "Signed"
                                : "Signature Required"
                        )
                    );
                }

                card.appendChild(top);

                const meta =
                    document.createElement(
                        "div"
                    );

                meta.className =
                    "record-meta";

                meta.appendChild(
                    createInlineMeta(
                        "Type",
                        formatLabel(
                            documentRecord.document_type
                        )
                    )
                );

                if (
                    documentRecord.version
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Version",
                            documentRecord.version
                        )
                    );
                }

                if (
                    documentRecord.issued_at
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Issued",
                            formatDate(
                                documentRecord.issued_at
                            )
                        )
                    );
                }

                if (
                    documentRecord.signed_at
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Signed",
                            formatDate(
                                documentRecord.signed_at
                            )
                        )
                    );
                }

                card.appendChild(meta);
                list.appendChild(card);
            }
        );

        panel.appendChild(list);

        return panel;
    }

    function createAgreementsPanel(
        agreements
    ) {
        const panel =
            createContentPanel(
                "Agreements",
                "Author-visible agreements forming part of the publishing record."
            );

        if (agreements.length === 0) {
            panel.appendChild(
                createEmptyState(
                    "No author-visible agreements are currently recorded."
                )
            );

            return panel;
        }

        const list =
            document.createElement("div");

        list.className =
            "record-list";

        agreements.forEach(
            function (agreement) {
                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "record-card";

                const top =
                    document.createElement(
                        "div"
                    );

                top.className =
                    "record-card-top";

                const title =
                    document.createElement(
                        "h4"
                    );

                title.className =
                    "record-title";

                title.textContent =
                    agreement.title ||
                    formatLabel(
                        agreement.agreement_type
                    );

                top.appendChild(title);

                top.appendChild(
                    createStatusBadge(
                        formatLabel(
                            agreement.status
                        )
                    )
                );

                card.appendChild(top);

                if (
                    agreement.summary_author
                ) {
                    const description =
                        document.createElement(
                            "p"
                        );

                    description.className =
                        "record-description";

                    description.textContent =
                        agreement.summary_author;

                    card.appendChild(
                        description
                    );
                }

                const meta =
                    document.createElement(
                        "div"
                    );

                meta.className =
                    "record-meta";

                meta.appendChild(
                    createInlineMeta(
                        "Agreement Record",
                        agreement.agreement_reference
                    )
                );

                meta.appendChild(
                    createInlineMeta(
                        "Type",
                        formatLabel(
                            agreement.agreement_type
                        )
                    )
                );

                if (
                    agreement.agreement_date
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Agreement date",
                            formatDate(
                                agreement.agreement_date
                            )
                        )
                    );
                }

                if (
                    agreement.effective_date
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Effective",
                            formatDate(
                                agreement.effective_date
                            )
                        )
                    );
                }

                if (
                    agreement.expiry_date
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Expiry",
                            formatDate(
                                agreement.expiry_date
                            )
                        )
                    );
                }

                card.appendChild(meta);
                list.appendChild(card);
            }
        );

        panel.appendChild(list);

        return panel;
    }

    function createRightsPanel(
        rights,
        rightsEvents
    ) {
        const panel =
            createContentPanel(
                "Rights",
                "Rights recorded as held by Blackwood under the relevant publishing agreement."
            );

        if (rights.length === 0) {
            panel.appendChild(
                createEmptyState(
                    "No author-visible rights records are currently recorded."
                )
            );

            return panel;
        }

        const list =
            document.createElement("div");

        list.className =
            "record-list";

        rights.forEach(function (right) {
            const card =
                document.createElement(
                    "article"
                );

            card.className =
                "record-card";

            const top =
                document.createElement(
                    "div"
                );

            top.className =
                "record-card-top";

            const title =
                document.createElement(
                    "h4"
                );

            title.className =
                "record-title";

            title.textContent =
                formatLabel(
                    right.right_type
                );

            top.appendChild(title);

            top.appendChild(
                createStatusBadge(
                    formatLabel(
                        right.status
                    )
                )
            );

            card.appendChild(top);

            if (
                right.summary_author
            ) {
                const description =
                    document.createElement(
                        "p"
                    );

                description.className =
                    "record-description";

                description.textContent =
                    right.summary_author;

                card.appendChild(
                    description
                );
            }

            const meta =
                document.createElement(
                    "div"
                );

            meta.className =
                "record-meta";

            meta.appendChild(
                createInlineMeta(
                    "Rights Record",
                    right.rights_reference
                )
            );

            if (right.format_scope) {
                meta.appendChild(
                    createInlineMeta(
                        "Format",
                        formatLabel(
                            right.format_scope
                        )
                    )
                );
            }

            meta.appendChild(
                createInlineMeta(
                    "Territory",
                    right.territory
                )
            );

            meta.appendChild(
                createInlineMeta(
                    "Language",
                    right.language
                )
            );

            meta.appendChild(
                createInlineMeta(
                    "Exclusivity",
                    formatLabel(
                        right.exclusivity
                    )
                )
            );

            if (
                right.effective_date
            ) {
                meta.appendChild(
                    createInlineMeta(
                        "Effective",
                        formatDate(
                            right.effective_date
                        )
                    )
                );
            }

            if (
                right.expiry_date
            ) {
                meta.appendChild(
                    createInlineMeta(
                        "Expiry",
                        formatDate(
                            right.expiry_date
                        )
                    )
                );
            }

            card.appendChild(meta);

            const events =
                rightsEvents.filter(
                    function (event) {
                        return (
                            event.right_id ===
                            right.id
                        );
                    }
                );

            if (events.length > 0) {
                const history =
                    document.createElement(
                        "div"
                    );

                history.className =
                    "timeline";

                events.forEach(
                    function (event) {
                        const item =
                            document.createElement(
                                "div"
                            );

                        item.className =
                            "timeline-item";

                        const date =
                            document.createElement(
                                "p"
                            );

                        date.className =
                            "timeline-date";

                        date.textContent =
                            formatDate(
                                event.event_date
                            );

                        const eventTitle =
                            document.createElement(
                                "h5"
                            );

                        eventTitle.className =
                            "timeline-title";

                        eventTitle.textContent =
                            formatLabel(
                                event.event_type
                            );

                        item.appendChild(
                            date
                        );

                        item.appendChild(
                            eventTitle
                        );

                        if (
                            event.description_author
                        ) {
                            const note =
                                document.createElement(
                                    "p"
                                );

                            note.className =
                                "timeline-note";

                            note.textContent =
                                event.description_author;

                            item.appendChild(
                                note
                            );
                        }

                        history.appendChild(
                            item
                        );
                    }
                );

                card.appendChild(
                    history
                );
            }

            list.appendChild(card);
        });

        panel.appendChild(list);

        return panel;
    }

    function renderFinance(financeData) {
        statementCount.textContent =
            String(
                financeData.statements.length
            );

        paymentCount.textContent =
            String(
                financeData.payments.length
            );

        paymentRequestCount.textContent =
            String(
                financeData.paymentRequests.length
            );

        renderFinanceAccountSummary(
            financeData
        );

        renderStatements(
            financeData.statements,
            financeData.statementLines
        );

        renderPayments(
            financeData.payments,
            financeData.paymentAllocations,
            financeData.statements
        );

        renderPaymentRequests(
            financeData.paymentRequests
        );
    }

    function renderFinanceAccountSummary(
        financeData
    ) {
        const existingSummary =
            document.getElementById(
                "finance-account-summary"
            );

        if (existingSummary) {
            existingSummary.remove();
        }

        const statements =
            financeData.statements.filter(
                function (statement) {
                    return (
                        statement.status ===
                        "issued"
                    );
                }
            );

        const currencies =
            getFinanceCurrencies(
                statements,
                financeData.payments,
                financeData.paymentRequests,
                financeData.advances
            );

        if (currencies.length === 0) {
            return;
        }

        const summaryPanel =
            createContentPanel(
                "Account Summary",
                "A current summary of royalties, advances and payments recorded against your author account."
            );

        summaryPanel.id =
            "finance-account-summary";

        const summaryList =
            document.createElement("div");

        summaryList.className =
            "finance-account-summary";

        currencies.forEach(
            function (currency) {
                const figures =
                    calculateFinanceSummary(
                        currency,
                        financeData
                    );

                const currencyBlock =
                    document.createElement(
                        "div"
                    );

                currencyBlock.className =
                    "finance-account-currency";

                if (
                    currencies.length > 1
                ) {
                    const currencyHeading =
                        document.createElement(
                            "h4"
                        );

                    currencyHeading.className =
                        "record-title";

                    currencyHeading.textContent =
                        currency;

                    currencyBlock.appendChild(
                        currencyHeading
                    );
                }

                const grid =
                    document.createElement(
                        "div"
                    );

                grid.className =
                    "finance-summary-grid";

                grid.appendChild(
                    createFinanceSummaryCard(
                        "Royalties Earned",
                        formatMoney(
                            figures.royaltiesEarned,
                            currency
                        ),
                        "Royalties recorded on issued statements before advance recoupment."
                    )
                );

                grid.appendChild(
                    createFinanceSummaryCard(
                        "Advance Remaining",
                        formatMoney(
                            figures.advanceRemaining,
                            currency
                        ),
                        figures.advanceRemaining > 0
                            ? "Royalties continue to reduce the unrecouped advance balance."
                            : "No unrecouped advance balance is currently recorded."
                    )
                );

                grid.appendChild(
                    createFinanceSummaryCard(
                        "Balance Due",
                        formatMoney(
                            figures.balanceDue,
                            currency
                        ),
                        figures.advanceRemaining > 0
                            ? "No royalty payment is due while royalties are being applied against the advance."
                            : "Issued payable royalties not already reserved or allocated to a live payment."
                    )
                );

                grid.appendChild(
                    createFinanceSummaryCard(
                        "Pending Payment",
                        formatMoney(
                            figures.pendingPayment,
                            currency
                        ),
                        "Payment value currently requested, approved or processing."
                    )
                );

                grid.appendChild(
                    createFinanceSummaryCard(
                        "Total Payments",
                        formatMoney(
                            figures.totalPayments,
                            currency
                        ),
                        "Payments recorded as paid."
                    )
                );

                currencyBlock.appendChild(
                    grid
                );

                currencyBlock.appendChild(
                    createPaymentRequestPanel(
                        currency,
                        figures
                    )
                );

                summaryList.appendChild(
                    currencyBlock
                );
            }
        );

        summaryPanel.appendChild(
            summaryList
        );

        const statementsPanel =
            statementList.closest(
                ".content-panel"
            );

        if (
            statementsPanel &&
            statementsPanel.parentNode
        ) {
            statementsPanel.parentNode.insertBefore(
                summaryPanel,
                statementsPanel
            );
        }
    }

    function createPaymentRequestPanel(
        currency,
        figures
    ) {
        const panel =
            document.createElement("div");

        panel.className =
            "payment-request-control";

        const heading =
            document.createElement("h4");

        heading.className =
            "record-title";

        heading.textContent =
            "Request Payment";

        panel.appendChild(heading);

        const description =
            document.createElement("p");

        description.className =
            "record-description";

        if (figures.advanceRemaining > 0) {
            description.textContent =
                "Payment requests are not available while royalties are being applied against an unrecouped advance.";

            panel.appendChild(
                description
            );

            return panel;
        }

        if (figures.balanceDue <= 0) {
            description.textContent =
                "There is currently no balance available to request.";

            panel.appendChild(
                description
            );

            return panel;
        }

        description.textContent =
            "You can request up to " +
            formatMoney(
                figures.balanceDue,
                currency
            ) +
            ".";

        panel.appendChild(
            description
        );

        const form =
            document.createElement("form");

        form.className =
            "payment-request-form";

        const field =
            document.createElement("div");

        field.className =
            "payment-request-field";

        const label =
            document.createElement("label");

        const inputId =
            "payment-request-" +
            currency.toLowerCase();

        label.setAttribute(
            "for",
            inputId
        );

        label.textContent =
            "Amount";

        const input =
            document.createElement("input");

        input.id =
            inputId;

        input.name =
            "amount";

        input.type =
            "number";

        input.min =
            "0.01";

        input.max =
            figures.balanceDue.toFixed(2);

        input.step =
            "0.01";

        input.value =
            figures.balanceDue.toFixed(2);

        input.required =
            true;

        input.inputMode =
            "decimal";

        field.appendChild(label);
        field.appendChild(input);

        const button =
            document.createElement("button");

        button.type =
            "submit";

        button.className =
            "payment-request-button";

        button.textContent =
            "Submit payment request";

        const message =
            document.createElement("p");

        message.className =
            "payment-request-message";

        message.hidden =
            true;

        form.appendChild(field);
        form.appendChild(button);
        form.appendChild(message);

        form.addEventListener(
            "submit",
            function (event) {
                handlePaymentRequestSubmit(
                    event,
                    currency,
                    figures.balanceDue,
                    input,
                    button,
                    message
                );
            }
        );

        panel.appendChild(form);

        return panel;
    }

    async function handlePaymentRequestSubmit(
        event,
        currency,
        maximumAmount,
        input,
        button,
        message
    ) {
        event.preventDefault();

        const requestedAmount =
            Number(input.value);

        clearPaymentRequestMessage(
            message
        );

        if (
            !Number.isFinite(
                requestedAmount
            ) ||
            requestedAmount <= 0
        ) {
            showPaymentRequestMessage(
                message,
                "Enter a payment amount greater than zero.",
                true
            );

            return;
        }

        if (
            requestedAmount >
            maximumAmount
        ) {
            showPaymentRequestMessage(
                message,
                "The requested amount cannot exceed the current balance due.",
                true
            );

            return;
        }

        input.disabled =
            true;

        button.disabled =
            true;

        button.textContent =
            "Submitting…";

        try {
            const {
                error
            } = await client.rpc(
                "create_payment_request",
                {
                    p_requested_amount:
                        requestedAmount,
                    p_currency:
                        currency
                }
            );

            if (error) {
                throw error;
            }

            showPaymentRequestMessage(
                message,
                "Payment request submitted successfully.",
                false
            );

            const financeData =
                await loadFinanceData();

            renderFinance(
                financeData
            );

        } catch (error) {
            console.error(
                "Payment request failed:",
                error
            );

            input.disabled =
                false;

            button.disabled =
                false;

            button.textContent =
                "Submit payment request";

            showPaymentRequestMessage(
                message,
                getPaymentRequestErrorMessage(
                    error
                ),
                true
            );
        }
    }

    async function handlePaymentRequestCancel(
        requestId,
        button,
        message
    ) {
        clearPaymentRequestMessage(
            message
        );

        button.disabled =
            true;

        button.textContent =
            "Cancelling…";

        try {
            const { error } =
                await client.rpc(
                    "cancel_payment_request",
                    {
                        p_request_id:
                            requestId
                    }
                );
            if (error) {
                throw error;
            }

            const financeData =
                await loadFinanceData();

            renderFinance(
                financeData
            );

        } catch (error) {
            console.error(
                "Payment request cancellation failed:",
                error
            );

            button.disabled =
                false;

            button.textContent =
                "Cancel request";

            showPaymentRequestMessage(
                message,
                getPaymentRequestCancelErrorMessage(
                    error
                ),
                true
            );
        }
    }

    function getPaymentRequestCancelErrorMessage(
        error
    ) {
        const rawMessage =
            error &&
            error.message
                ? String(
                    error.message
                )
                : "";

        const lowerMessage =
            rawMessage.toLowerCase();

        if (
            lowerMessage.includes(
                "requested"
            ) ||
            lowerMessage.includes(
                "cancel"
            )
        ) {
            return "This payment request can no longer be cancelled. Please refresh your Author Desk.";
        }

        if (
            lowerMessage.includes(
                "desk"
            ) ||
            lowerMessage.includes(
                "author"
            ) ||
            lowerMessage.includes(
                "authenticated"
            )
        ) {
            return "Your Author Desk could not authorise this cancellation. Please sign in again and retry.";
        }

        return "The payment request could not be cancelled. No changes have been made.";
    }

    function getPaymentRequestErrorMessage(
        error
    ) {
        const rawMessage =
            error &&
            error.message
                ? String(
                    error.message
                )
                : "";

        const lowerMessage =
            rawMessage.toLowerCase();

        if (
            lowerMessage.includes(
                "available"
            ) ||
            lowerMessage.includes(
                "balance"
            ) ||
            lowerMessage.includes(
                "exceed"
            )
        ) {
            return "That amount is no longer available to request. Please refresh your Author Desk and try again.";
        }

        if (
            lowerMessage.includes(
                "desk"
            ) ||
            lowerMessage.includes(
                "author"
            ) ||
            lowerMessage.includes(
                "authenticated"
            )
        ) {
            return "Your Author Desk could not authorise this payment request. Please sign in again and retry.";
        }

        return "The payment request could not be submitted. No payment request has been created.";
    }

    function showPaymentRequestMessage(
        element,
        text,
        isError
    ) {
        element.textContent =
            text;

        element.hidden =
            false;

        element.classList.toggle(
            "error",
            isError
        );

        element.classList.toggle(
            "success",
            !isError
        );
    }

    function clearPaymentRequestMessage(
        element
    ) {
        element.textContent =
            "";

        element.hidden =
            true;

        element.classList.remove(
            "error",
            "success"
        );
    }

    function calculateFinanceSummary(
        currency,
        financeData
    ) {
        const issuedStatements =
            financeData.statements.filter(
                function (statement) {
                    return (
                        statement.status ===
                            "issued" &&
                        normaliseCurrency(
                            statement.currency
                        ) === currency
                    );
                }
            );

        const activeAdvances =
            financeData.advances.filter(
                function (advance) {
                    return (
                        normaliseCurrency(
                            advance.currency
                        ) === currency &&
                        advance.status !==
                            "cancelled" &&
                        advance.status !==
                            "superseded"
                    );
                }
            );

        const royaltiesEarned =
            sumValues(
                issuedStatements,
                "total_royalty_amount"
            );

        const totalAdvanceAmount =
            sumValues(
                activeAdvances,
                "total_amount"
            );

        const advanceApplied =
            sumValues(
                issuedStatements,
                "total_advance_applied"
            );

        const advanceRemaining =
            Math.max(
                0,
                totalAdvanceAmount -
                    advanceApplied
            );

        const grossPayable =
            sumValues(
                issuedStatements,
                "amount_payable"
            );

        const livePaymentIds =
            new Set(
                financeData.payments
                    .filter(
                        function (payment) {
                            return (
                                normaliseCurrency(
                                    payment.currency
                                ) ===
                                    currency &&
                                (
                                    payment.status ===
                                        "approved" ||
                                    payment.status ===
                                        "processing" ||
                                    payment.status ===
                                        "paid"
                                )
                            );
                        }
                    )
                    .map(
                        function (payment) {
                            return (
                                payment.id
                            );
                        }
                    )
            );

        const issuedStatementIds =
            new Set(
                issuedStatements.map(
                    function (
                        statement
                    ) {
                        return (
                            statement.id
                        );
                    }
                )
            );

        const allocatedAmount =
            financeData
                .paymentAllocations
                .filter(
                    function (
                        allocation
                    ) {
                        return (
                            livePaymentIds.has(
                                allocation.payment_id
                            ) &&
                            issuedStatementIds.has(
                                allocation.statement_id
                            )
                        );
                    }
                )
                .reduce(
                    function (
                        total,
                        allocation
                    ) {
                        return (
                            total +
                            toNumber(
                                allocation.amount
                            )
                        );
                    },
                    0
                );

        const reservedRequests =
            financeData
                .paymentRequests
                .filter(
                    function (request) {
                        return (
                            normaliseCurrency(
                                request.currency
                            ) ===
                                currency &&
                            (
                                request.status ===
                                    "requested" ||
                                request.status ===
                                    "approved"
                            )
                        );
                    }
                );

        const reservedRequestAmount =
            sumValues(
                reservedRequests,
                "requested_amount"
            );

        const pendingPayments =
            financeData.payments.filter(
                function (payment) {
                    return (
                        normaliseCurrency(
                            payment.currency
                        ) === currency &&
                        (
                            payment.status ===
                                "approved" ||
                            payment.status ===
                                "processing"
                        )
                    );
                }
            );

        const pendingPaymentAmount =
            sumValues(
                pendingPayments,
                "amount"
            );

        const paidPayments =
            financeData.payments.filter(
                function (payment) {
                    return (
                        normaliseCurrency(
                            payment.currency
                        ) === currency &&
                        payment.status ===
                            "paid"
                    );
                }
            );

        const totalPayments =
            sumValues(
                paidPayments,
                "amount"
            );

        const pendingPayment =
            pendingPaymentAmount +
            reservedRequestAmount;

        const balanceDue =
            advanceRemaining > 0
                ? 0
                : Math.max(
                    0,
                    grossPayable -
                        allocatedAmount -
                        reservedRequestAmount
                );

        return {
            royaltiesEarned:
                royaltiesEarned,

            advanceRemaining:
                advanceRemaining,

            balanceDue:
                balanceDue,

            pendingPayment:
                pendingPayment,

            totalPayments:
                totalPayments
        };
    }

    function getFinanceCurrencies(
        statements,
        payments,
        paymentRequests,
        advances
    ) {
        const currencies =
            new Set();

        statements.forEach(
            function (statement) {
                addCurrency(
                    currencies,
                    statement.currency
                );
            }
        );

        payments.forEach(
            function (payment) {
                addCurrency(
                    currencies,
                    payment.currency
                );
            }
        );

        paymentRequests.forEach(
            function (request) {
                addCurrency(
                    currencies,
                    request.currency
                );
            }
        );

        advances.forEach(
            function (advance) {
                addCurrency(
                    currencies,
                    advance.currency
                );
            }
        );

        return Array.from(
            currencies
        ).sort();
    }

    function addCurrency(
        currencies,
        currency
    ) {
        const normalised =
            normaliseCurrency(
                currency
            );

        if (normalised) {
            currencies.add(
                normalised
            );
        }
    }

    function normaliseCurrency(
        currency
    ) {
        if (!currency) {
            return "";
        }

        return String(currency)
            .trim()
            .toUpperCase();
    }

    function sumValues(
        records,
        property
    ) {
        return records.reduce(
            function (
                total,
                record
            ) {
                return (
                    total +
                    toNumber(
                        record[property]
                    )
                );
            },
            0
        );
    }

    function toNumber(value) {
        const number =
            Number(value);

        return Number.isFinite(
            number
        )
            ? number
            : 0;
    }

    function createFinanceSummaryCard(
        label,
        value,
        description
    ) {
        const card =
            document.createElement(
                "article"
            );

        card.className =
            "finance-summary-card";

        const labelElement =
            document.createElement(
                "p"
            );

        labelElement.className =
            "summary-label";

        labelElement.textContent =
            label;

        const valueElement =
            document.createElement(
                "p"
            );

        valueElement.className =
            "summary-value";

        valueElement.textContent =
            value;

        const descriptionElement =
            document.createElement(
                "p"
            );

        descriptionElement.className =
            "finance-summary-description";

        descriptionElement.textContent =
            description;

        card.appendChild(
            labelElement
        );

        card.appendChild(
            valueElement
        );

        card.appendChild(
            descriptionElement
        );

        return card;
    }

    function renderStatements(
        statements,
        statementLines
    ) {
        statementList.replaceChildren();

        if (statements.length === 0) {
            statementList.appendChild(
                createEmptyState(
                    "No issued royalty statements are currently available."
                )
            );

            return;
        }

        statements.forEach(
            function (statement) {
                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "record-card";

                const top =
                    document.createElement(
                        "div"
                    );

                top.className =
                    "record-card-top";

                const title =
                    document.createElement(
                        "h4"
                    );

                title.className =
                    "record-title";

                title.textContent =
                    statement.statement_reference ||
                    "Royalty Statement";

                top.appendChild(title);

                top.appendChild(
                    createStatusBadge(
                        formatLabel(
                            statement.status
                        )
                    )
                );

                card.appendChild(top);

                const meta =
                    document.createElement(
                        "div"
                    );

                meta.className =
                    "record-meta";

                if (
                    statement.period_start &&
                    statement.period_end
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Period",
                            formatDate(
                                statement.period_start
                            ) +
                            " – " +
                            formatDate(
                                statement.period_end
                            )
                        )
                    );
                }

                if (
                    statement.issue_date
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Issued",
                            formatDate(
                                statement.issue_date
                            )
                        )
                    );
                }

                meta.appendChild(
                    createInlineMeta(
                        "Royalties",
                        formatMoney(
                            statement.total_royalty_amount,
                            statement.currency
                        )
                    )
                );

                meta.appendChild(
                    createInlineMeta(
                        "Adjustments",
                        formatMoney(
                            statement.total_adjustments,
                            statement.currency
                        )
                    )
                );

                meta.appendChild(
                    createInlineMeta(
                        "Advance applied",
                        formatMoney(
                            statement.total_advance_applied,
                            statement.currency
                        )
                    )
                );

                meta.appendChild(
                    createInlineMeta(
                        "Amount payable",
                        formatMoney(
                            statement.amount_payable,
                            statement.currency
                        )
                    )
                );

                card.appendChild(meta);

                const lines =
                    statementLines.filter(
                        function (line) {
                            return (
                                line.statement_id ===
                                statement.id
                            );
                        }
                    );

                if (
                    lines.length > 0
                ) {
                    const lineList =
                        document.createElement(
                            "div"
                        );

                    lineList.className =
                        "record-list";

                    lines.forEach(
                        function (line) {
                            const lineCard =
                                document.createElement(
                                    "div"
                                );

                            lineCard.className =
                                "record-card";

                            const lineTop =
                                document.createElement(
                                    "div"
                                );

                            lineTop.className =
                                "record-card-top";

                            const lineTitle =
                                document.createElement(
                                    "h5"
                                );

                            lineTitle.className =
                                "record-title";

                            lineTitle.textContent =
                                line.description ||
                                "Statement line " +
                                    String(
                                        line.line_number
                                    );

                            lineTop.appendChild(
                                lineTitle
                            );

                            lineTop.appendChild(
                                createStatusBadge(
                                    formatLabel(
                                        line.line_type
                                    )
                                )
                            );

                            lineCard.appendChild(
                                lineTop
                            );

                            const lineMeta =
                                document.createElement(
                                    "div"
                                );

                            lineMeta.className =
                                "record-meta";

                            lineMeta.appendChild(
                                createInlineMeta(
                                    "Amount",
                                    formatMoney(
                                        line.amount,
                                        statement.currency
                                    )
                                )
                            );

                            lineCard.appendChild(
                                lineMeta
                            );

                            lineList.appendChild(
                                lineCard
                            );
                        }
                    );

                    card.appendChild(
                        lineList
                    );
                }

                statementList.appendChild(
                    card
                );
            }
        );
    }

    function renderPayments(
        payments,
        paymentAllocations,
        statements
    ) {
        paymentList.replaceChildren();

        if (payments.length === 0) {
            paymentList.appendChild(
                createEmptyState(
                    "No payments are currently recorded."
                )
            );

            return;
        }

        payments.forEach(
            function (payment) {
                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "record-card";

                const top =
                    document.createElement(
                        "div"
                    );

                top.className =
                    "record-card-top";

                const title =
                    document.createElement(
                        "h4"
                    );

                title.className =
                    "record-title";

                title.textContent =
                    payment.payment_reference ||
                    "Payment";

                top.appendChild(title);

                top.appendChild(
                    createStatusBadge(
                        formatLabel(
                            payment.status
                        )
                    )
                );

                card.appendChild(top);

                const meta =
                    document.createElement(
                        "div"
                    );

                meta.className =
                    "record-meta";

                meta.appendChild(
                    createInlineMeta(
                        "Amount",
                        formatMoney(
                            payment.amount,
                            payment.currency
                        )
                    )
                );

                if (
                    payment.requested_at
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Requested",
                            formatDate(
                                payment.requested_at
                            )
                        )
                    );
                }

                if (
                    payment.approved_at
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Approved",
                            formatDate(
                                payment.approved_at
                            )
                        )
                    );
                }

                if (
                    payment.processing_at
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Processing",
                            formatDate(
                                payment.processing_at
                            )
                        )
                    );
                }

                if (
                    payment.paid_at
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Paid",
                            formatDate(
                                payment.paid_at
                            )
                        )
                    );
                }

                if (
                    payment.failed_at
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Failed",
                            formatDate(
                                payment.failed_at
                            )
                        )
                    );
                }

                if (
                    payment.cancelled_at
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Cancelled",
                            formatDate(
                                payment.cancelled_at
                            )
                        )
                    );
                }

                card.appendChild(meta);

                const allocations =
                    paymentAllocations.filter(
                        function (
                            allocation
                        ) {
                            return (
                                allocation.payment_id ===
                                payment.id
                            );
                        }
                    );

                if (
                    allocations.length > 0
                ) {
                    const allocationList =
                        document.createElement(
                            "div"
                        );

                    allocationList.className =
                        "record-list";

                    allocations.forEach(
                        function (
                            allocation
                        ) {
                            const allocationCard =
                                document.createElement(
                                    "div"
                                );

                            allocationCard.className =
                                "record-card";

                            const statement =
                                statements.find(
                                    function (
                                        statementRecord
                                    ) {
                                        return (
                                            statementRecord.id ===
                                            allocation.statement_id
                                        );
                                    }
                                );

                            const allocationTitle =
                                document.createElement(
                                    "h5"
                                );

                            allocationTitle.className =
                                "record-title";

                            allocationTitle.textContent =
                                statement &&
                                statement.statement_reference
                                    ? statement.statement_reference
                                    : "Statement allocation";

                            allocationCard.appendChild(
                                allocationTitle
                            );

                            const allocationMeta =
                                document.createElement(
                                    "div"
                                );

                            allocationMeta.className =
                                "record-meta";

                            allocationMeta.appendChild(
                                createInlineMeta(
                                    "Allocated",
                                    formatMoney(
                                        allocation.amount,
                                        payment.currency
                                    )
                                )
                            );

                            allocationCard.appendChild(
                                allocationMeta
                            );

                            allocationList.appendChild(
                                allocationCard
                            );
                        }
                    );

                    card.appendChild(
                        allocationList
                    );
                }

                paymentList.appendChild(
                    card
                );
            }
        );
    }

    function renderPaymentRequests(
        paymentRequests
    ) {
        paymentRequestList.replaceChildren();

        if (
            paymentRequests.length === 0
        ) {
            paymentRequestList.appendChild(
                createEmptyState(
                    "No payment requests are currently recorded."
                )
            );

            return;
        }

        paymentRequests.forEach(
            function (request) {
                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "record-card";

                const top =
                    document.createElement(
                        "div"
                    );

                top.className =
                    "record-card-top";

                const title =
                    document.createElement(
                        "h4"
                    );

                title.className =
                    "record-title";

                title.textContent =
                    request.request_reference ||
                    "Payment Request";

                top.appendChild(title);

                top.appendChild(
                    createStatusBadge(
                        formatLabel(
                            request.status
                        )
                    )
                );

                card.appendChild(top);

                const meta =
                    document.createElement(
                        "div"
                    );

                meta.className =
                    "record-meta";

                meta.appendChild(
                    createInlineMeta(
                        "Amount",
                        formatMoney(
                            request.requested_amount,
                            request.currency
                        )
                    )
                );

                if (
                    request.requested_at
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Requested",
                            formatDate(
                                request.requested_at
                            )
                        )
                    );
                }

                if (
                    request.reviewed_at
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Reviewed",
                            formatDate(
                                request.reviewed_at
                            )
                        )
                    );
                }

                if (
                    request.fulfilled_at
                ) {
                    meta.appendChild(
                        createInlineMeta(
                            "Fulfilled",
                            formatDate(
                                request.fulfilled_at
                            )
                        )
                    );
                }

                card.appendChild(meta);

                if (
                    request.status ===
                    "requested"
                ) {
                    const actions =
                        document.createElement(
                            "div"
                        );

                    actions.className =
                        "payment-request-actions";

                    const cancelButton =
                        document.createElement(
                            "button"
                        );

                    cancelButton.type =
                        "button";

                    cancelButton.className =
                        "payment-request-button";

                    cancelButton.textContent =
                        "Cancel request";

                    const message =
                        document.createElement(
                            "p"
                        );

                    message.className =
                        "payment-request-message";

                    message.hidden =
                        true;

                    cancelButton.addEventListener(
                        "click",
                        function () {
                            handlePaymentRequestCancel(
                                request.id,
                                cancelButton,
                                message
                            );
                        }
                    );

                    actions.appendChild(
                        cancelButton
                    );

                    actions.appendChild(
                        message
                    );

                    card.appendChild(
                        actions
                    );
                }

                paymentRequestList.appendChild(
                    card
                );
            }
        );
    }

    function createSummaryRecord(
        label,
        value,
        className
    ) {
        const card =
            document.createElement(
                "article"
            );

        card.className =
            className;

        const labelElement =
            document.createElement(
                "p"
            );

        labelElement.className =
            "summary-label";

        labelElement.textContent =
            label;

        const valueElement =
            document.createElement(
                "p"
            );

        valueElement.className =
            "summary-value";

        valueElement.textContent =
            value ||
            "Not recorded";

        card.appendChild(
            labelElement
        );

        card.appendChild(
            valueElement
        );

        return card;
    }

    function createContentPanel(
        title,
        intro
    ) {
        const panel =
            document.createElement(
                "section"
            );

        panel.className =
            "content-panel";

        const heading =
            document.createElement(
                "h3"
            );

        heading.textContent =
            title;

        panel.appendChild(
            heading
        );

        if (intro) {
            const paragraph =
                document.createElement(
                    "p"
                );

            paragraph.className =
                "panel-intro";

            paragraph.textContent =
                intro;

            panel.appendChild(
                paragraph
            );
        }

        return panel;
    }

    function createEmptyState(
        message
    ) {
        const emptyState =
            document.createElement(
                "div"
            );

        emptyState.className =
            "empty-state";

        emptyState.textContent =
            message;

        return emptyState;
    }

    function createStatusBadge(
        value
    ) {
        const badge =
            document.createElement(
                "span"
            );

        badge.className =
            "status-badge";

        badge.textContent =
            value ||
            "Not recorded";

        return badge;
    }

    function createMetaItem(
        label,
        value
    ) {
        const wrapper =
            document.createElement(
                "div"
            );

        const labelElement =
            document.createElement(
                "span"
            );

        labelElement.className =
            "meta-label";

        labelElement.textContent =
            label;

        const valueElement =
            document.createElement(
                "span"
            );

        valueElement.className =
            "meta-value";

        valueElement.textContent =
            value ||
            "Not recorded";

        wrapper.appendChild(
            labelElement
        );

        wrapper.appendChild(
            valueElement
        );

        return wrapper;
    }

    function createInlineMeta(
        label,
        value
    ) {
        const wrapper =
            document.createElement(
                "span"
            );

        const strong =
            document.createElement(
                "strong"
            );

        strong.textContent =
            label + ": ";

        wrapper.appendChild(
            strong
        );

        wrapper.appendChild(
            document.createTextNode(
                value ||
                "Not recorded"
            )
        );

        return wrapper;
    }

    function showSection(
        sectionName
    ) {
        navButtons.forEach(
            function (button) {
                button.classList.toggle(
                    "active",
                    button.dataset.section ===
                        sectionName
                );
            }
        );

        deskSections.forEach(
            function (section) {
                section.classList.toggle(
                    "active",
                    section.id ===
                        "section-" +
                            sectionName
                );
            }
        );
    }

    async function handleSignOut() {
        signOutButton.disabled =
            true;

        signOutButton.textContent =
            "Signing out…";

        try {
            const { error } =
                await client.auth.signOut();

            if (error) {
                throw error;
            }

            desk.hidden =
                true;

            showAccessMessage(
                "Signed out",
                "You have been signed out of the Author Desk."
            );

        } catch (error) {
            console.error(
                "Author Desk sign-out failed:",
                error
            );

            signOutButton.disabled =
                false;

            signOutButton.textContent =
                "Sign out";
        }
    }

    function showAccessMessage(
        title,
        message
    ) {
        loadingPanel.hidden =
            true;

        desk.hidden =
            true;

        accessTitle.textContent =
            title;

        accessMessage.textContent =
            message;

        accessPanel.hidden =
            false;
    }

    function formatLabel(value) {
        if (!value) {
            return "Not recorded";
        }

        return String(value)
            .replace(
                /_/g,
                " "
            )
            .replace(
                /\b\w/g,
                function (
                    character
                ) {
                    return character.toUpperCase();
                }
            );
    }

    function formatDate(value) {
        if (!value) {
            return "Not recorded";
        }

        const raw =
            String(value);

        const date =
            /^\d{4}-\d{2}-\d{2}$/.test(
                raw
            )
                ? new Date(
                    raw +
                    "T12:00:00"
                )
                : new Date(raw);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return raw;
        }

        return new Intl.DateTimeFormat(
            "en-GB",
            {
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        ).format(date);
    }

    function formatMoney(
        value,
        currency
    ) {
        const amount =
            Number(value);

        if (
            !Number.isFinite(
                amount
            ) ||
            !currency
        ) {
            return String(value);
        }

        try {
            return new Intl.NumberFormat(
                "en-GB",
                {
                    style:
                        "currency",
                    currency:
                        currency
                }
            ).format(amount);

        } catch (error) {
            return (
                currency +
                " " +
                amount.toFixed(2)
            );
        }
    }

})();
