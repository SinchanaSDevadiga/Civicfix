// =====================================================
// CIVICFIX - SMART CIVIC ISSUE REPORTING SYSTEM
// =====================================================

// =====================================================
// SUPABASE CONNECTION (one block only)
// =====================================================

const SUPABASE_URL = "https://gqupgkylfmekdmijpmwe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_S6YwWux7RKFtczigtlspjA_iTTkUKVe";

let supabaseClient = null;

if (window.supabase && typeof window.supabase.createClient === "function") {
    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );
    console.log("☁️ CivicFix Supabase connected!");
} else {
    console.error(
        "❌ Supabase library not loaded. Check the <script> tag order in index.html."
    );
}

// =====================================================
// LOAD EXISTING REPORTS (declared once)
// =====================================================

var issues = [];

try {
    issues = JSON.parse(localStorage.getItem("civicIssues")) || [];
} catch (error) {
    console.error("Could not load CivicFix reports:", error);
    issues = [];
}

let editingIssueId = null;

// =====================================================
// SMALL HELPER: make text safe before putting it in HTML
// =====================================================

function escapeHTML(value) {
    return String(value === undefined || value === null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// =====================================================
// SAVE COMPLAINT TO SUPABASE
// =====================================================

async function saveComplaintToSupabase(issue) {
    if (!supabaseClient) {
        alert("⚠️ Complaint was saved locally, but the cloud is not connected.");
        return false;
    }

    try {
        // 1. UPLOAD PHOTO TO SUPABASE STORAGE
        let photoUrl = "";
        let photoName = "";

        if (issue.photo) {
            const response = await fetch(issue.photo);
            const blob = await response.blob();

            let extension = "jpg";

            if (blob.type === "image/png") {
                extension = "png";
            } else if (blob.type === "image/jpeg") {
                extension = "jpg";
            } else if (blob.type === "image/webp") {
                extension = "webp";
            }

            photoName =
                issue.complaintId + "_" + Date.now() + "." + extension;

            const { error: uploadError } = await supabaseClient
                .storage
                .from("civicfix-photos")
                .upload(photoName, blob, {
                    contentType: blob.type,
                    upsert: false
                });

            if (uploadError) {
                console.error("❌ Photo upload error:", uploadError);
                alert("⚠️ Complaint will be saved, but photo upload failed.");
                photoName = "";
            } else {
                const { data: publicUrlData } = supabaseClient
                    .storage
                    .from("civicfix-photos")
                    .getPublicUrl(photoName);

                photoUrl = publicUrlData.publicUrl;
                console.log("📷 Photo uploaded:", photoUrl);
            }
        }

        // 2. SAVE COMPLAINT TO THE DATABASE
        // NOTE: no .select() here. Your table only allows INSERT for the
        // public, so asking Supabase to read the row back would fail.
        const ai = issue.aiVerification || {};
        let aiMatches = null;

        if (typeof window.checkAICategoryMatch === "function" && ai.result) {
            aiMatches = window.checkAICategoryMatch(ai, issue.category).matches;
        }

        const { error } = await supabaseClient
            .from("complaints")
            .insert([
                {
                    complaint_id: issue.complaintId,
                    name: issue.name,
                    category: issue.category,
                    location: issue.location,
                    description: issue.description,
                    photo_url: photoUrl,
                    photo_name: photoName,
                    status: issue.status,
                    estimated_resolution: issue.estimatedResolution,
                    created_date: issue.createdDate,
                    ai_result: ai.result || null,
                    ai_confidence:
                        typeof ai.confidence === "number" ? ai.confidence : null,
                    ai_matches: aiMatches,
                    updated_at: new Date().toISOString()
                }
            ]);

        // 3. HANDLE DATABASE ERROR
        if (error) {
            console.error("❌ Supabase save error:", error);
            alert(
                "⚠️ Complaint was saved locally, but could not be saved to the cloud.\n\n" +
                "Reason: " + (error.message || "Unknown error")
            );
            return false;
        }

        console.log("☁️ Complaint saved to Supabase:", issue.complaintId);
        return true;

    } catch (error) {
        console.error("❌ Unexpected Supabase error:", error);
        alert("⚠️ Something went wrong while saving the complaint to the cloud.");
        return false;
    }
}

// =====================================================
// 📷 COMPRESS PHOTO BEFORE SAVING
// =====================================================

window.compressPhoto = function(file, callback) {
    const reader = new FileReader();

    reader.onload = function(event) {
        const img = new Image();

        img.onload = function() {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            const maxSize = 1200;

            let width = img.width;
            let height = img.height;

            // Resize large images
            if (width > height && width > maxSize) {
                height = height * (maxSize / width);
                width = maxSize;
            } else if (height > maxSize) {
                width = width * (maxSize / height);
                height = maxSize;
            }

            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);

            // Convert to smaller JPEG
            const compressedPhoto = canvas.toDataURL("image/jpeg", 0.7);

            callback(compressedPhoto);
        };

        img.onerror = function() {
            alert("❌ Could not read the photo.");
        };

        img.src = event.target.result;
    };

    reader.onerror = function() {
        alert("❌ Could not read the photo.");
    };

    reader.readAsDataURL(file);
};

// =====================================================
// SAVE REPORTS
// =====================================================

function saveIssues() {
    try {
        localStorage.setItem("civicIssues", JSON.stringify(issues));
        return true;
    } catch (error) {
        console.error(error);
        alert(
            "❌ The report could not be saved.\n\n" +
            "The photo may be too large."
        );
        return false;
    }
}

// =====================================================
// 🤖 CIVICFIX AI PHOTO VERIFICATION
// =====================================================

window.verifyPhotoWithAI = async function(photoData, category) {
    try {
        if (!window.civicAI || !photoData) {
            return {
                result: "AI not available",
                confidence: 0
            };
        }

        const labels = [
            "a pothole or damaged road",
            "garbage or waste",
            "a broken streetlight",
            "water leakage or flooding",
            "a damaged public property",
            "a normal street or road"
        ];

        const results = await window.civicAI(photoData, labels);

        const best = results[0];

        return {
            result: best.label,
            confidence: Math.round(best.score * 100)
        };

    } catch (error) {
        console.error("AI verification error:", error);

        return {
            result: "Unable to verify",
            confidence: 0
        };
    }
};

// =====================================================
// 🤖 AI CATEGORY MISMATCH DETECTION
// =====================================================

window.checkAICategoryMatch = function(aiResult, category) {
    if (!aiResult || !aiResult.result || !category) {
        return {
            matches: true,
            message: ""
        };
    }

    const detected = aiResult.result.toLowerCase();
    const selected = category.toLowerCase();

    let matches = false;

    if (selected.includes("pothole")) {
        matches =
            detected.includes("pothole") ||
            detected.includes("damaged road");
    } else if (selected.includes("garbage") || selected.includes("waste")) {
        matches =
            detected.includes("garbage") ||
            detected.includes("waste");
    } else if (selected.includes("streetlight") || selected.includes("street light")) {
        matches =
            detected.includes("streetlight") ||
            detected.includes("broken streetlight");
    } else if (selected.includes("water")) {
        matches =
            detected.includes("water") ||
            detected.includes("flooding");
    } else if (selected.includes("property")) {
        matches = detected.includes("public property");
    } else {
        matches = true;
    }

    return {
        matches: matches,
        message: matches
            ? "✅ Category matches the AI detection."
            : "⚠️ The selected category may not match the uploaded photo."
    };
};

// =====================================================
// SHOW REPORT FORM
// =====================================================

function showForm() {
    const reportForm = document.getElementById("reportForm");

    if (!reportForm) {
        return;
    }

    reportForm.style.display = "block";
    reportForm.scrollIntoView({ behavior: "smooth" });
}

// =====================================================
// GENERATE COMPLAINT ID
// =====================================================

function generateComplaintId() {
    let id;

    do {
        const number = Math.floor(1000 + Math.random() * 9000);

        id = "CF-" + new Date().getFullYear() + "-" + number;
    } while (
        issues.some(function(issue) {
            return issue.complaintId === id;
        })
    );

    return id;
}

// =====================================================
// ESTIMATED RESOLUTION DATE
// =====================================================

function getResolutionDate() {
    const date = new Date();

    date.setDate(date.getDate() + 7);

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

// =====================================================
// UPGRADE OLD COMPLAINTS
// =====================================================

function upgradeOldComplaints() {
    let changed = false;

    issues.forEach(function(issue) {
        // Add Complaint ID if missing
        if (!issue.complaintId) {
            issue.complaintId = generateComplaintId();
            changed = true;
        }

        // Add Reported Date if missing
        if (!issue.createdDate) {
            issue.createdDate = new Date().toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
            changed = true;
        }

        // Add Estimated Resolution if missing
        if (!issue.estimatedResolution) {
            issue.estimatedResolution = getResolutionDate();
            changed = true;
        }
    });

    // Save only if something changed
    if (changed) {
        saveIssues();
    }
}

// =====================================================
// RESET EDIT MODE
// =====================================================

function resetEditMode() {
    editingIssueId = null;

    const form = document.querySelector(".report-form form");

    if (form) {
        form.reset();
    }

    const submitButton = document.getElementById("submitButton");

    if (submitButton) {
        submitButton.textContent = "🚨 Submit Report";
    }

    const cancelButton = document.getElementById("cancelEditButton");

    if (cancelButton) {
        cancelButton.style.display = "none";
    }
}

// =====================================================
// SUBMIT / UPDATE COMPLAINT
// =====================================================

function submitIssue(event) {
    if (event) {
        event.preventDefault();
    }

    // GET FORM ELEMENTS
    const nameElement = document.getElementById("name");
    const categoryElement = document.getElementById("category");
    const locationElement = document.getElementById("location");
    const descriptionElement = document.getElementById("description");
    const photoElement = document.getElementById("photo");

    // CHECK FORM
    if (
        !nameElement ||
        !categoryElement ||
        !locationElement ||
        !descriptionElement
    ) {
        alert("❌ CivicFix form could not be loaded correctly.");
        return;
    }

    // GET VALUES
    const name = nameElement.value.trim();
    const category = categoryElement.value;
    const location = locationElement.value.trim();
    const description = descriptionElement.value.trim();

    // VALIDATION
    if (name === "") {
        alert("⚠️ Please enter your name.");
        nameElement.focus();
        return;
    }

    if (category === "") {
        alert("⚠️ Please select an issue category.");
        categoryElement.focus();
        return;
    }

    if (location === "") {
        alert("⚠️ Please enter the location.");
        locationElement.focus();
        return;
    }

    if (description === "") {
        alert("⚠️ Please enter the description.");
        descriptionElement.focus();
        return;
    }

    // CHECK PHOTO (used for both new and edited complaints)
    let selectedFile = null;

    if (photoElement && photoElement.files && photoElement.files.length > 0) {
        selectedFile = photoElement.files[0];

        if (!selectedFile.type || !selectedFile.type.startsWith("image/")) {
            alert("❌ Please select an image file.");
            return;
        }

        if (selectedFile.size > 5 * 1024 * 1024) {
            alert(
                "❌ Photo is too large.\n\n" +
                "Please choose an image smaller than 5 MB."
            );
            return;
        }
    }

    // =================================================
    // UPDATE EXISTING COMPLAINT
    // =================================================

    if (editingIssueId !== null) {
        const issue = issues.find(function(item) {
            return String(item.id) === String(editingIssueId);
        });

        if (!issue) {
            alert("❌ Complaint not found.");
            resetEditMode();
            return;
        }

        // UPDATE TEXT INFORMATION
        issue.name = name;
        issue.category = category;
        issue.location = location;
        issue.description = description;

        // FINISH UPDATE
        const finishUpdate = function(newPhoto) {
            // Replace photo only when a new photo is selected
            if (newPhoto) {
                issue.photo = newPhoto;
            }

            if (!saveIssues()) {
                return;
            }

            // EXIT EDIT MODE
            resetEditMode();

            // HIDE FORM
            const reportForm = document.getElementById("reportForm");

            if (reportForm) {
                reportForm.style.display = "none";
            }

            // REFRESH
            displayIssues();
            updateCounts();

            alert("✅ Complaint updated successfully!");
        };

        if (selectedFile) {
            compressPhoto(selectedFile, function(compressedPhoto) {
                finishUpdate(compressedPhoto);
            });
        } else {
            // KEEP OLD PHOTO
            finishUpdate("");
        }

        return;
    }

    // =================================================
    // CREATE NEW COMPLAINT
    // =================================================

    const complaintId = generateComplaintId();

    const createdDate = new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });

    const estimatedResolution = getResolutionDate();

    async function createReport(photoData) {
        const newIssue = {
            id: Date.now(),
            complaintId: complaintId,
            name: name,
            category: category,
            location: location,
            description: description,
            photo: photoData || "",
            status: "Pending",
            createdDate: createdDate,
            estimatedResolution: estimatedResolution
        };

        // AI PHOTO CHECK
        const aiVerification = await verifyPhotoWithAI(photoData, category);

        newIssue.aiVerification = aiVerification;

        issues.push(newIssue);

        // SAVE LOCALLY
        if (!saveIssues()) {
            issues.pop();
            return;
        }

        // SAVE TO SUPABASE CLOUD
        const cloudSaved = await saveComplaintToSupabase(newIssue);

        // RESET FORM
        resetEditMode();

        // HIDE FORM
        const reportForm = document.getElementById("reportForm");

        if (reportForm) {
            reportForm.style.display = "none";
        }

        // REFRESH
        displayIssues();
        updateCounts();

        // SUCCESS MESSAGE (honest about the cloud result)
        alert(
            "✅ Report submitted successfully!\n\n" +
            "Complaint ID: " + complaintId + "\n\n" +
            "Estimated Resolution: " + estimatedResolution + "\n\n" +
            (cloudSaved
                ? "☁️ Saved to the cloud."
                : "💾 Saved on this device only (cloud save failed).")
        );

        // SCROLL TO TRACK SECTION
        const trackSection = document.querySelector(".track-section");

        if (trackSection) {
            trackSection.scrollIntoView({ behavior: "smooth" });
        }
    }

    if (selectedFile) {
        compressPhoto(selectedFile, function(compressedPhoto) {
            createReport(compressedPhoto);
        });
    } else {
        createReport("");
    }
}

// =====================================================
// EDIT COMPLAINT
// =====================================================

function editIssue(id) {
    console.log("Edit button clicked:", id);

    const issue = issues.find(function(item) {
        return String(item.id) === String(id);
    });

    if (!issue) {
        alert("❌ Complaint not found.");
        return;
    }

    // SAVE EDITING ID
    editingIssueId = issue.id;

    // LOAD NAME
    const nameElement = document.getElementById("name");

    if (nameElement) {
        nameElement.value = issue.name || "";
    }

    // LOAD CATEGORY
    const categoryElement = document.getElementById("category");

    if (categoryElement) {
        categoryElement.value = issue.category || "";
    }

    // LOAD LOCATION
    const locationElement = document.getElementById("location");

    if (locationElement) {
        locationElement.value = issue.location || "";
    }

    // LOAD DESCRIPTION
    const descriptionElement = document.getElementById("description");

    if (descriptionElement) {
        descriptionElement.value = issue.description || "";
    }

    // SHOW FORM
    const reportForm = document.getElementById("reportForm");

    if (reportForm) {
        reportForm.style.display = "block";
        reportForm.scrollIntoView({ behavior: "smooth" });
    }

    // CHANGE SUBMIT BUTTON
    const submitButton = document.getElementById("submitButton");

    if (submitButton) {
        submitButton.textContent = "💾 Update Complaint";
    }

    // SHOW CANCEL BUTTON
    const cancelButton = document.getElementById("cancelEditButton");

    if (cancelButton) {
        cancelButton.style.display = "inline-block";
    }

    console.log("Editing complaint:", issue);
}

// =====================================================
// CANCEL EDIT
// =====================================================

function cancelEdit() {
    resetEditMode();

    const reportForm = document.getElementById("reportForm");

    if (reportForm) {
        reportForm.style.display = "none";
    }
}

// =====================================================
// SEARCH AND FILTER
// =====================================================

function filterIssues() {
    const searchElement = document.getElementById("searchInput");
    const statusElement = document.getElementById("statusFilter");

    const searchText = searchElement
        ? searchElement.value.toLowerCase().trim()
        : "";

    const selectedStatus = statusElement ? statusElement.value : "All";

    const filtered = issues.filter(function(issue) {
        const name = String(issue.name || "").toLowerCase();
        const category = String(issue.category || "").toLowerCase();
        const location = String(issue.location || "").toLowerCase();
        const description = String(issue.description || "").toLowerCase();
        const complaintId = String(issue.complaintId || "").toLowerCase();

        const matchesSearch =
            name.includes(searchText) ||
            category.includes(searchText) ||
            location.includes(searchText) ||
            description.includes(searchText) ||
            complaintId.includes(searchText);

        const matchesStatus =
            selectedStatus === "All" ||
            issue.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    displayIssues(filtered);
}

// =====================================================
// DISPLAY REPORTS
// =====================================================

function displayIssues(list = issues) {
    const issueList = document.getElementById("issueList");

    if (!issueList) {
        return;
    }

    issueList.innerHTML = "";

    if (list.length === 0) {
        issueList.innerHTML = "<p>No matching issues found.</p>";
        updateCounts();
        return;
    }

    list.forEach(function(issue) {
        const card = document.createElement("div");

        card.className = "issue-card";

        const complaintId = issue.complaintId || "Not Available";
        const reportedDate = issue.createdDate || "Not Available";
        const resolution = issue.estimatedResolution || "Not Available";

        // =============================================
        // GOOGLE MAP
        // =============================================

        const location = String(issue.location || "");

        let mapURL;

        const match = location.match(
            /Latitude:\s*(-?\d+(?:\.\d+)?),\s*Longitude:\s*(-?\d+(?:\.\d+)?)/
        );

        if (match) {
            mapURL =
                "https://www.google.com/maps?q=" +
                match[1] + "," + match[2];
        } else {
            mapURL =
                "https://www.google.com/maps/search/?api=1&query=" +
                encodeURIComponent(location);
        }

        // =============================================
        // PHOTO
        // =============================================

        let photoHTML = "";

        if (issue.photo) {
            photoHTML = `
                <p>
                    <strong>📷 Evidence Photo:</strong>
                </p>
                <img
                    src="${issue.photo}"
                    class="issue-photo"
                    alt="Civic issue photo"
                >
                <p class="photo-hint">
                    Click the photo to view it
                </p>
            `;
        }

        // =============================================
        // STATUS CLASS
        // =============================================

        let statusClass = "status-pending";

        if (issue.status === "In Progress") {
            statusClass = "status-progress";
        } else if (issue.status === "Resolved") {
            statusClass = "status-resolved";
        }

        // =============================================
        // AI BLOCK
        // =============================================

        const aiHTML = issue.aiVerification
            ? `
                <div class="ai-verification">
                    <p><strong>🤖 AI Photo Verification</strong></p>
                    <p>🔍 Detected: ${escapeHTML(issue.aiVerification.result)}</p>
                    <p>📊 Confidence: ${escapeHTML(issue.aiVerification.confidence)}%</p>
                </div>
            `
            : "";

        // =============================================
        // COMPLAINT CARD
        // =============================================

        card.innerHTML = `
            <h3>🏷️ ${escapeHTML(issue.category || "Issue")}</h3>

            <p class="complaint-id">
                <strong>🆔 Complaint ID:</strong>
                ${escapeHTML(complaintId)}
            </p>

            <p>
                <strong>👤 Reported by:</strong>
                ${escapeHTML(issue.name || "")}
            </p>

            <p>
                <strong>📍 Location:</strong>
                ${escapeHTML(location)}
            </p>

            <button
                type="button"
                class="map-button"
                onclick="openMap('${mapURL}')"
            >
                🗺️ View on Map
            </button>

            <p>
                <strong>📝 Description:</strong>
                ${escapeHTML(issue.description || "")}
            </p>

            <p>
                <strong>📅 Reported:</strong>
                ${escapeHTML(reportedDate)}
            </p>

            <p class="deadline">
                <strong>⏰ Estimated Resolution:</strong>
                ${escapeHTML(resolution)}
            </p>

            <p>
                <strong>📌 Status:</strong>
                <span class="status ${statusClass}">
                    ${escapeHTML(issue.status || "Pending")}
                </span>
            </p>

            <p>
                <strong>🔄 Update Status:</strong>
                <select
                    class="status-select"
                    onchange="changeStatus(${issue.id}, this.value)"
                >
                    <option value="Pending" ${issue.status === "Pending" ? "selected" : ""}>
                        Pending
                    </option>
                    <option value="In Progress" ${issue.status === "In Progress" ? "selected" : ""}>
                        In Progress
                    </option>
                    <option value="Resolved" ${issue.status === "Resolved" ? "selected" : ""}>
                        Resolved
                    </option>
                </select>
            </p>

            <button
                type="button"
                class="edit-button"
                onclick="editIssue(${issue.id})"
            >
                ✏️ Edit Complaint
            </button>

            ${aiHTML}

            ${photoHTML}
        `;

        // =============================================
        // PHOTO CLICK
        // =============================================

        const image = card.querySelector(".issue-photo");

        if (image) {
            image.onclick = function() {
                openPhoto(issue.photo);
            };
        }

        issueList.appendChild(card);
    });

    updateCounts();
}

// =====================================================
// TRACK COMPLAINT
// =====================================================

function trackComplaint() {
    const input = document.getElementById("trackingId");
    const result = document.getElementById("trackingResult");

    if (!input || !result) {
        return;
    }

    const entered = input.value.trim().toUpperCase();

    if (entered === "") {
        result.innerHTML = "<p>⚠️ Please enter your Complaint ID.</p>";
        return;
    }

    const issue = issues.find(function(item) {
        return (
            item.complaintId &&
            item.complaintId.toUpperCase() === entered
        );
    });

    if (!issue) {
        result.innerHTML = `
            <div class="track-card">
                <h3>❌ Complaint Not Found</h3>
                <p>Please check your Complaint ID and try again.</p>
            </div>
        `;
        return;
    }

    result.innerHTML = `
        <div class="track-card">
            <h3>📋 Complaint Details</h3>

            <p>
                <strong>🆔 Complaint ID:</strong>
                ${escapeHTML(issue.complaintId)}
            </p>

            <p>
                <strong>🏷️ Category:</strong>
                ${escapeHTML(issue.category)}
            </p>

            <p>
                <strong>📍 Location:</strong>
                ${escapeHTML(issue.location)}
            </p>

            <p>
                <strong>📌 Current Status:</strong>
                ${escapeHTML(issue.status)}
            </p>

            <p>
                <strong>📅 Reported:</strong>
                ${escapeHTML(issue.createdDate || "Not Available")}
            </p>

            <p>
                <strong>⏰ Estimated Resolution:</strong>
                ${escapeHTML(issue.estimatedResolution || "Not Available")}
            </p>
        </div>
    `;
}

// =====================================================
// OPEN GOOGLE MAPS
// =====================================================

function openMap(url) {
    window.open(url, "_blank");
}

// =====================================================
// CHANGE STATUS
// =====================================================

function changeStatus(id, newStatus) {
    const issue = issues.find(function(item) {
        return String(item.id) === String(id);
    });

    if (!issue) {
        return;
    }

    issue.status = newStatus;

    if (saveIssues()) {
        displayIssues();
        updateCounts();
    }
}

// =====================================================
// OPEN PHOTO
// =====================================================

function openPhoto(photo) {
    const newWindow = window.open();

    if (!newWindow) {
        alert("Please allow pop-ups to view the photo.");
        return;
    }

    newWindow.document.write(`
        <html>
        <head>
            <title>CivicFix - Issue Photo</title>
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

// =====================================================
// UPDATE DASHBOARD COUNTS
// =====================================================

function updateCounts() {
    const reportedCount = document.getElementById("reportedCount");
    const pendingCount = document.getElementById("pendingCount");
    const progressCount = document.getElementById("progressCount");
    const resolvedCount = document.getElementById("resolvedCount");

    const reported = issues.length;

    const pending = issues.filter(function(issue) {
        return issue.status === "Pending";
    }).length;

    const progress = issues.filter(function(issue) {
        return issue.status === "In Progress";
    }).length;

    const resolved = issues.filter(function(issue) {
        return issue.status === "Resolved";
    }).length;

    if (reportedCount) {
        reportedCount.textContent = reported;
    }

    if (pendingCount) {
        pendingCount.textContent = pending;
    }

    if (progressCount) {
        progressCount.textContent = progress;
    }

    if (resolvedCount) {
        resolvedCount.textContent = resolved;
    }
}

// =====================================================
// GET CURRENT LOCATION
// =====================================================

function getLocation() {
    const locationInput = document.getElementById("location");
    const message = document.getElementById("locationMessage");

    if (!navigator.geolocation) {
        if (message) {
            message.textContent = "❌ Location is not supported.";
        }
        return;
    }

    if (message) {
        message.textContent = "📍 Getting your location...";
    }

    navigator.geolocation.getCurrentPosition(
        function(position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            if (locationInput) {
                locationInput.value =
                    "Latitude: " + latitude.toFixed(6) +
                    ", Longitude: " + longitude.toFixed(6);
            }

            if (message) {
                message.textContent = "✅ Location detected successfully!";
            }
        },
        function() {
            if (message) {
                message.textContent =
                    "❌ Unable to get location. Please enter it manually.";
            }
        }
    );
}

// =====================================================
// INITIAL LOAD
// =====================================================

// Upgrade old reports first
upgradeOldComplaints();

// Then display reports
displayIssues();

// Update dashboard
updateCounts();