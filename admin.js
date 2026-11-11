// =====================================================
// SUPABASE CONNECTION
// =====================================================

const SUPABASE_URL =
    "https://gqupgkylfmekdmijpmwe.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_Va0rgIE6AcMDmuiuKDcqUw_cLzzSNZa";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

console.log("☁️ Admin Supabase connected!");
/* =========================================
   CIVICFIX ADMIN DASHBOARD
   ========================================= */


/* ---------- LOGIN PROTECTION ---------- */

if (
    sessionStorage.getItem("adminLoggedIn") !== "true"
) {
    window.location.href = "admin-login.html";
}


/* ---------- LOAD ISSUES ---------- */

let issues =
    JSON.parse(
        localStorage.getItem("civicIssues")
    ) || [];
    // =====================================================
// LOAD COMPLAINTS FROM SUPABASE
// =====================================================

async function loadComplaintsFromSupabase() {

    const { data, error } = await supabaseClient
        .from("complaints")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("❌ Admin Supabase error:", error);
        return;
    }

    console.log("☁️ Complaints loaded from Supabase:", data);

    issues = data.map(function (item) {
        return {
            id: item.id,
            complaintId: item.complaint_id,
            name: item.name,
            category: item.category,
            location: item.location,
            description: item.description,
            photo: item.photo_url,
            status: item.status,
            estimatedResolution: item.estimated_resolution,
            createdDate: item.created_date,
            updatedAt: item.updated_at
        };
    });

}

/* =========================================
   UPDATE ADMIN DASHBOARD
   ========================================= */



    /*
       Reload latest data from Local Storage
    */

   function updateAdminDashboard() {

    const total =
        issues.length;

    const pending =
        issues.filter(function(issue) {
            return issue.status === "Pending";
        }).length;

    const progress =
        issues.filter(function(issue) {
            return issue.status === "In Progress";
        }).length;

    const resolved =
        issues.filter(function(issue) {
            return issue.status === "Resolved";
        }).length;


    


    

           

    


    document.getElementById(
        "adminReported"
    ).textContent = total;


    document.getElementById(
        "adminPending"
    ).textContent = pending;


    document.getElementById(
        "adminProgress"
    ).textContent = progress;


    document.getElementById(
        "adminResolved"
    ).textContent = resolved;
}


/* =========================================
   CATEGORY STATISTICS
   ========================================= */

function showCategoryStats() {

    const categories = [
        "Pothole",
        "Garbage",
        "Streetlight",
        "Road Damage",
        "Water Leakage",
        "Other"
    ];


    const categoryStats =
        document.getElementById(
            "categoryStats"
        );


    categoryStats.innerHTML = "";


    categories.forEach(
        function(category) {

            const count =
                issues.filter(
                    function(issue) {

                        return issue.category ===
                            category;

                    }
                ).length;


            const box =
                document.createElement(
                    "div"
                );


            box.className =
                "category-item";


            box.innerHTML = `

                <h3>
                    🏷️ ${category}
                </h3>

                <p>
                    ${count}
                </p>

            `;


            categoryStats.appendChild(box);

        }
    );
}


/* =========================================
   ISSUE DISTRIBUTION CHART
   ========================================= */

function showIssueChart() {

    const chart =
        document.getElementById(
            "issueChart"
        );


    chart.innerHTML = "";


    const categories = [
        "Pothole",
        "Garbage",
        "Streetlight",
        "Road Damage",
        "Water Leakage",
        "Other"
    ];


    const counts =
        categories.map(
            function(category) {

                return issues.filter(
                    function(issue) {

                        return issue.category ===
                            category;

                    }
                ).length;

            }
        );


    const maxCount =
        Math.max(...counts, 1);


    categories.forEach(
        function(category, index) {

            const count =
                counts[index];


            const percentage =
                (count / maxCount) * 100;


            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "chart-row";


            row.innerHTML = `

                <div class="chart-label">

                    <span>
                        🏷️ ${category}
                    </span>

                    <span>
                        ${count}
                    </span>

                </div>


                <div class="chart-bar-container">

                    <div
                        class="chart-bar"
                        style="width: ${percentage}%"
                    >
                    </div>

                </div>

            `;


            chart.appendChild(row);

        }
    );
}


/* =========================================
   DISPLAY ALL ISSUES
   ========================================= */

function displayAdminIssues() {

    const issueList =
        document.getElementById(
            "adminIssueList"
        );


    issueList.innerHTML = "";


    if (issues.length === 0) {

        issueList.innerHTML =
            "<p>No issues reported yet.</p>";

        return;
    }


    /*
       Show newest reports first
    */

    const sortedIssues =
        [...issues].reverse();


    sortedIssues.forEach(
        function(issue) {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "admin-issue-card";


            /* =========================
               MAP
               ========================= */

            let mapURL;


            const locationText =
                issue.location || "";


            const locationMatch =
                locationText.match(
                    /Latitude:\s*(-?\d+(?:\.\d+)?),\s*Longitude:\s*(-?\d+(?:\.\d+)?)/
                );


            if (locationMatch) {

                const latitude =
                    locationMatch[1];

                const longitude =
                    locationMatch[2];


                mapURL =
                    `https://www.google.com/maps?q=${latitude},${longitude}`;

            } else {

                mapURL =
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationText)}`;
            }


            /* =========================
               STATUS
               ========================= */

            let statusClass =
                "";


            if (issue.status === "Pending") {

                statusClass =
                    "status-pending";
            }

            else if (
                issue.status === "In Progress"
            ) {

                statusClass =
                    "status-progress";
            }

            else if (
                issue.status === "Resolved"
            ) {

                statusClass =
                    "status-resolved";
            }


            /* =========================
               CARD
               ========================= */

            card.innerHTML = `

                <div class="complaint-id">
                    🆔 ${
                        issue.complaintId ||
                        "Older Report"
                    }
                </div>


                <h3>
                    🏷️ ${issue.category}
                </h3>


                <p>
                    <strong>
                        👤 Reporter:
                    </strong>

                    ${issue.name}
                </p>


                <p>
                    <strong>
                        📍 Location:
                    </strong>

                    ${issue.location}
                </p>


                <button
                    type="button"
                    class="map-button"
                    onclick="openMap('${mapURL}')"
                >
                    🗺️ View on Map
                </button>


                <p>
                    <strong>
                        📝 Description:
                    </strong>

                    ${issue.description}
                </p>


                <p>
                    <strong>
                        📅 Reported:
                    </strong>

                    ${
                        issue.createdDate ||
                        "Older Report"
                    }
                </p>


                <p>
                    <strong>
                        📅 Estimated Resolution:
                    </strong>

                    ${
                        issue.estimatedResolution
                        ?
                        `<span class="deadline">
                            ${issue.estimatedResolution}
                        </span>`
                        :
                        "Not available for older report"
                    }

                </p>


                <p>
                    <strong>
                        📌 Status:
                    </strong>

                    <span class="status ${statusClass}">
                        ${issue.status}
                    </span>


                    <select
                        class="status-select"
                        onchange="changeAdminStatus(
                            ${issue.id},
                            this.value
                        )"
                    >

                        <option
                            value="Pending"
                            ${
                                issue.status === "Pending"
                                ? "selected"
                                : ""
                            }
                        >
                            Pending
                        </option>


                        <option
                            value="In Progress"
                            ${
                                issue.status === "In Progress"
                                ? "selected"
                                : ""
                            }
                        >
                            In Progress
                        </option>


                        <option
                            value="Resolved"
                            ${
                                issue.status === "Resolved"
                                ? "selected"
                                : ""
                            }
                        >
                            Resolved
                        </option>

                    </select>

                </p>


                ${
                    issue.photo
                    ?
                    `

                    <p>
                        <strong>
                            📷 Evidence Photo:
                        </strong>
                    </p>


                    <img
                        src="${issue.photo}"
                        class="admin-photo"
                        alt="Civic issue photo"
                        onclick="openPhoto('${issue.photo}')"
                    >

                    `
                    :
                    ""
                }

            `;


            issueList.appendChild(card);

        }
    );
}


/* =========================================
   CHANGE ADMIN STATUS
   ========================================= */

async function changeAdminStatus(
    id,
    newStatus
) {

    const issue =
        issues.find(function(issue) {
            return issue.id === id;
        });

    if (!issue) {
        return;
    }

    const { error } = await supabaseClient
        .from("complaints")
        .update({
            status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq("id", id);

    if (error) {
        console.error(
            "❌ Status update failed:",
            error
        );

        alert(
            "❌ Could not update complaint status in Supabase."
        );

        return;
    }

    issue.status = newStatus;

    updateAdminDashboard();
    showCategoryStats();
    showIssueChart();
    displayAdminIssues();

    console.log(
        "✅ Status updated in Supabase:",
        issue.complaintId,
        newStatus
    );
}

    
            



/* =========================================
   OPEN MAP
   ========================================= */

function openMap(mapURL) {

    window.open(
        mapURL,
        "_blank"
    );
}


/* =========================================
   OPEN PHOTO
   ========================================= */

function openPhoto(photo) {

    const newWindow =
        window.open();


    if (!newWindow) {

        alert(
            "Please allow pop-ups to view the photo."
        );

        return;
    }


    newWindow.document.write(`

        <html>

        <head>

            <title>
                CivicFix - Issue Photo
            </title>

        </head>


        <body style="
            margin:0;
            background:#111;
            display:flex;
            justify-content:center;
            align-items:center;
            height:100vh;
        ">

            <img
                src="${photo}"
                style="
                    max-width:95%;
                    max-height:95%;
                    object-fit:contain;
                "
            >

        </body>

        </html>

    `);
}


/* =========================================
   ADMIN LOGOUT
   ========================================= */

function adminLogout() {

    sessionStorage.removeItem(
        "adminLoggedIn"
    );


    window.location.href =
        "admin-login.html";
}


/* =========================================
   LOAD DASHBOARD
   ========================================= */
console.log("🚀 ADMIN DASHBOARD STARTED");
loadComplaintsFromSupabase().then(function() {
    updateAdminDashboard();
    showCategoryStats();
    showIssueChart();
    displayAdminIssues();
});