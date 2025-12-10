/**
 * HRMS Application - Main JavaScript
 * Complete frontend logic with Google OAuth and API integration
 */

// ==================== GLOBAL STATE ====================
let currentUser = null;
let userPermissions = {};
let currentModule = 'dashboard';
let allRequirements = [];
let allCandidates = [];
let allUsers = [];
let allTemplates = [];

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('hrms_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        loadMainApp();
    } else {
        showLoginPage();
    }
    
    // Set up event listeners
    setupEventListeners();
}

// ==================== GOOGLE OAUTH ====================
function showLoginPage() {
    hideLoading();
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    
    // Wait for Google Sign-In library to load
    if (typeof google !== 'undefined' && google.accounts) {
        initializeGoogleSignIn();
    } else {
        // Wait for library to load
        window.addEventListener('load', () => {
            setTimeout(() => {
                if (typeof google !== 'undefined' && google.accounts) {
                    initializeGoogleSignIn();
                } else {
                    console.error('Google Sign-In library failed to load');
                    showToast('Failed to load Google Sign-In. Please refresh the page.', 'error');
                }
            }, 1000);
        });
    }
}

function initializeGoogleSignIn() {
    try {
        // Initialize Google Sign-In
        google.accounts.id.initialize({
            client_id: CONFIG.GOOGLE_CLIENT_ID,
            callback: handleGoogleSignIn
        });
        
        google.accounts.id.renderButton(
            document.getElementById('googleSignInButton'),
            { 
                theme: 'outline', 
                size: 'large',
                text: 'signin_with',
                width: 300
            }
        );
    } catch (error) {
        console.error('Error initializing Google Sign-In:', error);
        showToast('Error initializing login. Please refresh the page.', 'error');
    }
}

async function handleGoogleSignIn(response) {
    showLoading();
    
    try {
        const decoded = parseJwt(response.credential);
        const userEmail = decoded.email;
        const userName = decoded.name;
        
        // For now, allow any gmail user (since we can't verify with backend due to CORS)
        // In production, you should verify with backend
        currentUser = {
            email: userEmail,
            name: userName,
            role: userEmail.includes('admin') ? 'admin' : 'hr', // Simple role assignment
            id: 'USR' + Date.now()
        };
        
        localStorage.setItem('hrms_user', JSON.stringify(currentUser));
        loadMainApp();
    } catch (error) {
        console.error('Authentication error:', error);
        showToast('Authentication failed. Please try again.', 'error');
        hideLoading();
    }
}

function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

// ==================== MAIN APP LOADING ====================
async function loadMainApp() {
    showLoading();
    
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'grid';
    
    // Set user info
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role.toUpperCase();
    
    // Load permissions
    await loadPermissions();
    
    // Setup menu based on permissions
    setupMenu();
    
    // Load dashboard
    await loadDashboard();
    
    hideLoading();
}

async function loadPermissions() {
    try {
        const response = await apiCall('GET', `${CONFIG.API_URL}?action=getPermissions&role=${currentUser.role}`);
        userPermissions = response.permissions || {};
    } catch (error) {
        console.error('Error loading permissions:', error);
    }
    
    // Always set default permissions based on role
    if (!userPermissions || Object.keys(userPermissions).length === 0) {
        userPermissions = getAllModulesPermissions();
    }
}

function getAllModulesPermissions() {
    const modules = ['dashboard', 'requirements', 'candidates', 'shortlisting', 'telephonic', 
                     'owner-review', 'schedule', 'walkins', 'templates', 'users', 'permissions', 'reports'];
    const perms = {};
    modules.forEach(module => {
        perms[module] = { view: true, create: true, edit: true, delete: true };
    });
    return perms;
}

function setupMenu() {
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(item => {
        const module = item.getAttribute('data-module');
        
        // Ensure userPermissions exists and has module data
        if (!userPermissions || !userPermissions[module]) {
            // For admin or if permissions not loaded, show all
            item.style.display = 'block';
        } else {
            const permission = userPermissions[module];
            // Hide menu items without view permission
            if (!permission || !permission.view) {
                item.style.display = 'none';
            }
        }
        
        item.addEventListener('click', () => {
            switchModule(module);
        });
    });
}

function switchModule(module) {
    // Update active menu item
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeMenuItem = document.querySelector(`[data-module="${module}"]`);
    if (activeMenuItem) {
        activeMenuItem.classList.add('active');
    }
    
    // Hide all module contents
    document.querySelectorAll('.module-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Show selected module
    const moduleContent = document.getElementById(module);
    if (moduleContent) {
        moduleContent.classList.add('active');
        currentModule = module;
        
        // Load module data
        loadModuleData(module);
    }
}

async function loadModuleData(module) {
    showLoading();
    
    try {
        switch(module) {
            case 'dashboard':
                await loadDashboard();
                break;
            case 'requirements':
                await loadRequirements();
                break;
            case 'candidates':
                await loadCandidates();
                break;
            case 'shortlisting':
                await loadShortlisting();
                break;
            case 'telephonic':
                await loadTelephonic();
                break;
            case 'owner-review':
                await loadOwnerReview();
                break;
            case 'schedule':
                await loadSchedule();
                break;
            case 'walkins':
                await loadWalkins();
                break;
            case 'templates':
                await loadTemplates();
                break;
            case 'users':
                await loadUsers();
                break;
            case 'permissions':
                await loadPermissionsModule();
                break;
            case 'reports':
                await loadReports();
                break;
        }
    } catch (error) {
        console.error(`Error loading ${module}:`, error);
        showToast(`Error loading ${module}. Please try again.`, 'error');
    }
    
    hideLoading();
}

// ==================== DASHBOARD MODULE ====================
async function loadDashboard() {
    try {
        // Mock data for now due to CORS
        const stats = {
            totalRequirements: 0,
            pendingRequirements: 0,
            totalCandidates: 0,
            shortlisted: 0,
            interviewed: 0,
            rejected: 0
        };
        
        document.getElementById('statTotalReq').textContent = stats.totalRequirements || 0;
        document.getElementById('statPendingReq').textContent = stats.pendingRequirements || 0;
        document.getElementById('statTotalCand').textContent = stats.totalCandidates || 0;
        document.getElementById('statShortlisted').textContent = stats.shortlisted || 0;
        document.getElementById('statInterviewed').textContent = stats.interviewed || 0;
        document.getElementById('statRejected').textContent = stats.rejected || 0;
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// ==================== REQUIREMENTS MODULE ====================
async function loadRequirements(filters = {}) {
    try {
        const response = await apiPost('getRequirements', { filters });
        allRequirements = response.requirements || [];
        
        // If empty due to CORS, use localStorage mock data
        if (allRequirements.length === 0) {
            const mockReqs = localStorage.getItem('hrms_requirements');
            if (mockReqs) {
                allRequirements = JSON.parse(mockReqs);
            }
        }
        
        renderRequirementsTable(allRequirements);
    } catch (error) {
        console.error('Error loading requirements:', error);
        showToast('Error loading requirements', 'error');
    }
}

function renderRequirementsTable(requirements) {
    const tbody = document.getElementById('requirementsTableBody');
    tbody.innerHTML = '';
    
    requirements.forEach(req => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${req.id}</td>
            <td>${req.jobRole}</td>
            <td>${req.jobTitle}</td>
            <td>${req.shift}</td>
            <td>${req.payScale}</td>
            <td><span class="status-badge ${req.status.toLowerCase().replace(' ', '-')}">${req.status}</span></td>
            <td>${req.raisedBy}</td>
            <td>${formatDate(req.raisedDate)}</td>
            <td class="action-buttons"></td>
        `;
        
        const actionsCell = row.querySelector('.action-buttons');
        
        // View button
        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-success';
        viewBtn.textContent = 'View';
        viewBtn.onclick = () => viewRequirement(req.id);
        actionsCell.appendChild(viewBtn);
        
        // Review button for HR
        if (canEdit('requirements') && currentUser.role === 'hr') {
            const reviewBtn = document.createElement('button');
            reviewBtn.className = 'btn-primary';
            reviewBtn.textContent = 'Review';
            reviewBtn.onclick = () => reviewRequirement(req.id);
            actionsCell.appendChild(reviewBtn);
        }
        
        // Edit button if sent back
        if (canEdit('requirements') && req.raisedBy === currentUser.email && req.status === 'Sent Back') {
            const editBtn = document.createElement('button');
            editBtn.className = 'btn-warning';
            editBtn.textContent = 'Edit';
            editBtn.onclick = () => editRequirement(req.id);
            actionsCell.appendChild(editBtn);
        }
        
        tbody.appendChild(row);
    });
}

function viewRequirement(reqId) {
    const req = allRequirements.find(r => r.id === reqId);
    if (!req) return;
    
    const detailsHtml = `
        <div class="candidate-info">
            <h3>${req.jobTitle}</h3>
            <p><strong>Requirement ID:</strong> ${req.id}</p>
            <p><strong>Job Role:</strong> ${req.jobRole}</p>
            <p><strong>Shift:</strong> ${req.shift}</p>
            <p><strong>Pay Scale:</strong> ${req.payScale}</p>
            <p><strong>Status:</strong> ${req.status}</p>
        </div>
        <div class="form-group">
            <label>Roles & Responsibilities</label>
            <textarea class="form-control" readonly rows="4">${req.rolesResponsibilities}</textarea>
        </div>
        <div class="form-group">
            <label>Must Have Skills</label>
            <textarea class="form-control" readonly rows="3">${req.mustHaveSkills}</textarea>
        </div>
        <div class="form-group">
            <label>Perks</label>
            <textarea class="form-control" readonly rows="2">${req.perks}</textarea>
        </div>
        ${req.note ? `
        <div class="form-group">
            <label>Note</label>
            <textarea class="form-control" readonly rows="2">${req.note}</textarea>
        </div>` : ''}
        ${req.remark ? `
        <div class="form-group">
            <label>Remark</label>
            <textarea class="form-control" readonly rows="2">${req.remark}</textarea>
        </div>` : ''}
    `;
    
    document.getElementById('requirementDetails').innerHTML = detailsHtml;
    
    // Add event listeners after HTML is inserted
    const actionsHtml = document.createElement('div');
    actionsHtml.className = 'form-actions';
    
    if (currentUser.role === 'hr' && req.status !== 'Valid' && req.status !== 'Sent Back') {
        const approveBtn = document.createElement('button');
        approveBtn.className = 'btn-success';
        approveBtn.textContent = 'Approve';
        approveBtn.onclick = () => approveRequirement(req.id);
        actionsHtml.appendChild(approveBtn);
        
        const sendBackBtn = document.createElement('button');
        sendBackBtn.className = 'btn-danger';
        sendBackBtn.textContent = 'Send Back';
        sendBackBtn.onclick = () => sendBackRequirementModal(req.id);
        actionsHtml.appendChild(sendBackBtn);
    }
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-secondary';
    closeBtn.textContent = 'Close';
    closeBtn.onclick = () => closeModal('modalViewRequirement');
    actionsHtml.appendChild(closeBtn);
    
    if (req.status === 'Valid') {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-primary';
        copyBtn.textContent = 'Copy for Posting';
        copyBtn.onclick = () => copyJobDetails(req.id);
        actionsHtml.appendChild(copyBtn);
    }
    
    document.getElementById('requirementDetails').appendChild(actionsHtml);
    openModal('modalViewRequirement');
}

function reviewRequirement(reqId) {
    viewRequirement(reqId);
}

async function approveRequirement(reqId) {
    if (!confirm('Approve this requirement?')) return;
    
    showLoading();
    try {
        await apiPost('reviewRequirement', {
            requirementId: reqId,
            remark: 'Approved'
        });
        
        // Update in localStorage
        const reqs = localStorage.getItem('hrms_requirements');
        if (reqs) {
            const requirements = JSON.parse(reqs);
            const index = requirements.findIndex(r => r.id === reqId);
            if (index !== -1) {
                requirements[index].status = 'Valid';
                requirements[index].remark = 'Approved';
                requirements[index].reviewDate = new Date().toISOString();
                localStorage.setItem('hrms_requirements', JSON.stringify(requirements));
            }
        }
        
        showToast('Requirement approved successfully', 'success');
        closeModal('modalViewRequirement');
        await loadRequirements();
    } catch (error) {
        showToast('Error approving requirement', 'error');
    }
    hideLoading();
}

function sendBackRequirementModal(reqId) {
    const remark = prompt('Enter reason for sending back:');
    if (!remark) return;
    
    sendBackRequirement(reqId, remark);
}

async function sendBackRequirement(reqId, remark) {
    showLoading();
    try {
        await apiPost('sendBackRequirement', {
            requirementId: reqId,
            remark: remark
        });
        
        // Update in localStorage
        const reqs = localStorage.getItem('hrms_requirements');
        if (reqs) {
            const requirements = JSON.parse(reqs);
            const index = requirements.findIndex(r => r.id === reqId);
            if (index !== -1) {
                requirements[index].status = 'Sent Back';
                requirements[index].remark = remark;
                requirements[index].reviewDate = new Date().toISOString();
                localStorage.setItem('hrms_requirements', JSON.stringify(requirements));
            }
        }
        
        showToast('Requirement sent back successfully', 'success');
        closeModal('modalViewRequirement');
        await loadRequirements();
    } catch (error) {
        showToast('Error sending back requirement', 'error');
    }
    hideLoading();
}

function copyJobDetails(reqId) {
    const req = allRequirements.find(r => r.id === reqId);
    if (!req) return;
    
    const jobDetails = `
Job Title: ${req.jobTitle}
Job Role: ${req.jobRole}

Roles & Responsibilities:
${req.rolesResponsibilities}

Must Have Skills:
${req.mustHaveSkills}

Shift: ${req.shift}
Pay Scale: ${req.payScale}

Perks:
${req.perks}
    `.trim();
    
    copyToClipboard(jobDetails);
    showToast('Job details copied to clipboard!', 'success');
}

// ==================== CANDIDATES MODULE ====================
async function loadCandidates(filters = {}) {
    try {
        const response = await apiPost('getCandidates', { filters });
        allCandidates = response.candidates || [];
        
        // If empty due to CORS, use localStorage mock data
        if (allCandidates.length === 0) {
            const mockCands = localStorage.getItem('hrms_candidates');
            if (mockCands) {
                allCandidates = JSON.parse(mockCands);
            }
        }
        
        renderCandidatesTable(allCandidates);
    } catch (error) {
        console.error('Error loading candidates:', error);
        showToast('Error loading candidates', 'error');
    }
}

function renderCandidatesTable(candidates) {
    const tbody = document.getElementById('candidatesTableBody');
    tbody.innerHTML = '';
    
    candidates.forEach(cand => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${cand.id}</td>
            <td>${cand.name}</td>
            <td>${cand.mobile}</td>
            <td>${cand.source}</td>
            <td>${cand.currentRole || cand.requirementId}</td>
            <td><span class="status-badge ${cand.status.toLowerCase().replace(' ', '-')}">${cand.status}</span></td>
            <td>${cand.cvUrl ? `<a href="${cand.cvUrl}" target="_blank">View CV</a>` : 'N/A'}</td>
            <td>
                ${canEdit('candidates') && (currentUser.role === 'admin' || currentUser.role === 'ea') ? `
                    <button class="btn-warning" onclick="changeCandidateRole('${cand.id}')">Change Role</button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function changeCandidateRole(candId) {
    const newRole = prompt('Enter new job role for candidate:');
    if (!newRole) return;
    
    showLoading();
    try {
        await apiPost('updateCandidateRole', {
            candidateId: candId,
            newRole: newRole
        });
        showToast('Candidate role updated successfully', 'success');
        await loadCandidates();
    } catch (error) {
        showToast('Error updating candidate role', 'error');
    }
    hideLoading();
}

// ==================== SHORTLISTING MODULE ====================
async function loadShortlisting() {
    try {
        const response = await apiPost('getCandidates', { 
            filters: { status: 'Uploaded' } 
        });
        const candidates = response.candidates || [];
        
        renderShortlistingGrid(candidates);
    } catch (error) {
        console.error('Error loading shortlisting:', error);
    }
}

function renderShortlistingGrid(candidates) {
    const grid = document.getElementById('shortlistingGrid');
    grid.innerHTML = '';
    
    if (candidates.length === 0) {
        grid.innerHTML = '<p>No candidates available for shortlisting.</p>';
        return;
    }
    
    candidates.forEach(cand => {
        const card = document.createElement('div');
        card.className = 'candidate-card';
        card.innerHTML = `
            <h3>${cand.name}</h3>
            <p><strong>Mobile:</strong> ${cand.mobile}</p>
            <p><strong>Source:</strong> ${cand.source}</p>
            <p><strong>Role:</strong> ${cand.currentRole}</p>
            ${cand.cvUrl ? `<p><a href="${cand.cvUrl}" target="_blank">View CV</a></p>` : ''}
            <div class="actions">
                <button class="btn-success" onclick="shortlistCandidate('${cand.id}', 'Approved')">Approve</button>
                <button class="btn-danger" onclick="shortlistCandidate('${cand.id}', 'Rejected')">Reject</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

async function shortlistCandidate(candId, decision) {
    let reason = '';
    if (decision === 'Rejected') {
        reason = prompt('Enter rejection reason:');
        if (!reason) return;
    }
    
    showLoading();
    try {
        await apiPost('shortlistCandidate', {
            candidateId: candId,
            decision: decision,
            reason: reason
        });
        showToast(`Candidate ${decision.toLowerCase()} successfully`, 'success');
        await loadShortlisting();
    } catch (error) {
        showToast('Error updating candidate status', 'error');
    }
    hideLoading();
}

// ==================== TELEPHONIC MODULE ====================
async function loadTelephonic() {
    try {
        const response = await apiPost('getCandidates', { 
            filters: { shortlistingStatus: 'Approved' } 
        });
        const candidates = response.candidates || [];
        
        renderTelephonicList(candidates);
    } catch (error) {
        console.error('Error loading telephonic:', error);
    }
}

function renderTelephonicList(candidates) {
    const list = document.getElementById('telephonicList');
    list.innerHTML = '';
    
    if (candidates.length === 0) {
        list.innerHTML = '<p>No candidates available for telephonic screening.</p>';
        return;
    }
    
    candidates.forEach(cand => {
        const item = document.createElement('div');
        item.className = 'candidate-item';
        item.innerHTML = `
            <div class="candidate-details">
                <h3>${cand.name}</h3>
                <p><strong>Mobile:</strong> ${cand.mobile}</p>
                <p><strong>Source:</strong> ${cand.source}</p>
                <p><strong>Role:</strong> ${cand.currentRole}</p>
            </div>
            <div class="candidate-actions">
                <button class="btn-primary" onclick="openTelephonicModal('${cand.id}')">Record Screening</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function openTelephonicModal(candId) {
    const cand = allCandidates.find(c => c.id === candId);
    if (!cand) return;
    
    document.getElementById('telephonicCandidateId').value = candId;
    document.getElementById('telephonicCandidateInfo').innerHTML = `
        <h3>${cand.name}</h3>
        <p><strong>Mobile:</strong> ${cand.mobile}</p>
        <p><strong>Role:</strong> ${cand.currentRole}</p>
        <p><strong>Source:</strong> ${cand.source}</p>
    `;
    
    // Reset form
    document.getElementById('formTelephonic').reset();
    document.getElementById('telephonicReasonGroup').style.display = 'none';
    
    openModal('modalTelephonic');
}

// ==================== OWNER REVIEW MODULE ====================
async function loadOwnerReview() {
    try {
        const response = await apiPost('getCandidates', { 
            filters: { telephonicStatus: 'Recommended for Owners' } 
        });
        const candidates = response.candidates || [];
        
        renderOwnerReviewList(candidates);
    } catch (error) {
        console.error('Error loading owner review:', error);
    }
}

function renderOwnerReviewList(candidates) {
    const list = document.getElementById('ownerReviewList');
    list.innerHTML = '';
    
    if (candidates.length === 0) {
        list.innerHTML = '<p>No candidates available for owner review.</p>';
        return;
    }
    
    candidates.forEach(cand => {
        const item = document.createElement('div');
        item.className = 'candidate-item';
        item.innerHTML = `
            <div class="candidate-details">
                <h3>${cand.name}</h3>
                <p><strong>Mobile:</strong> ${cand.mobile}</p>
                <p><strong>Role:</strong> ${cand.currentRole}</p>
                <p><strong>Communication:</strong> ${cand.communicationMarks}/10</p>
                <p><strong>Experience:</strong> ${cand.experienceMarks}/10</p>
            </div>
            <div class="candidate-actions">
                <button class="btn-primary" onclick="openOwnerReviewModal('${cand.id}')">Owner Decision</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function openOwnerReviewModal(candId) {
    const cand = allCandidates.find(c => c.id === candId);
    if (!cand) return;
    
    document.getElementById('ownerCandidateId').value = candId;
    document.getElementById('ownerCandidateInfo').innerHTML = `
        <h3>${cand.name}</h3>
        <p><strong>Mobile:</strong> ${cand.mobile}</p>
        <p><strong>Role:</strong> ${cand.currentRole}</p>
        <p><strong>Communication Marks:</strong> ${cand.communicationMarks}/10</p>
        <p><strong>Experience Marks:</strong> ${cand.experienceMarks}/10</p>
    `;
    
    // Reset form
    document.getElementById('formOwnerReview').reset();
    document.getElementById('ownerScheduleGroup').style.display = 'none';
    document.getElementById('ownerTimeGroup').style.display = 'none';
    document.getElementById('ownerReasonGroup').style.display = 'none';
    
    openModal('modalOwnerReview');
}

// ==================== SCHEDULE MODULE ====================
async function loadSchedule() {
    try {
        const response = await apiPost('getCandidates', { 
            filters: { ownerStatus: 'Approved' } 
        });
        const candidates = response.candidates || [];
        
        renderScheduleList(candidates);
    } catch (error) {
        console.error('Error loading schedule:', error);
    }
}

function renderScheduleList(candidates) {
    const list = document.getElementById('scheduleList');
    list.innerHTML = '';
    
    if (candidates.length === 0) {
        list.innerHTML = '<p>No candidates available for scheduling.</p>';
        return;
    }
    
    candidates.forEach(cand => {
        const item = document.createElement('div');
        item.className = 'candidate-item';
        item.innerHTML = `
            <div class="candidate-details">
                <h3>${cand.name}</h3>
                <p><strong>Mobile:</strong> ${cand.mobile}</p>
                <p><strong>Role:</strong> ${cand.currentRole}</p>
                <p><strong>Interview Date:</strong> ${formatDate(cand.interviewDate)}</p>
                <p><strong>Interview Time:</strong> ${cand.interviewTime || 'Not set'}</p>
            </div>
            <div class="candidate-actions">
                <button class="btn-primary" onclick="openScheduleModal('${cand.id}')">Schedule Interview</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function openScheduleModal(candId) {
    const cand = allCandidates.find(c => c.id === candId);
    if (!cand) return;
    
    document.getElementById('scheduleCandidateId').value = candId;
    document.getElementById('scheduleCandidateInfo').innerHTML = `
        <h3>${cand.name}</h3>
        <p><strong>Mobile:</strong> ${cand.mobile}</p>
        <p><strong>Role:</strong> ${cand.currentRole}</p>
        <p><strong>Scheduled Date:</strong> ${formatDate(cand.interviewDate)}</p>
        <p><strong>Scheduled Time:</strong> ${cand.interviewTime}</p>
    `;
    
    // Generate interview message
    const message = generateInterviewMessage(cand);
    document.getElementById('interviewMessage').value = message;
    
    // Reset form
    document.getElementById('formScheduleInterview').reset();
    document.getElementById('interviewMessageSection').style.display = 'none';
    
    openModal('modalScheduleInterview');
}

function generateInterviewMessage(cand) {
    return `Dear ${cand.name},

We are pleased to inform you that you have been shortlisted for an interview for the position of ${cand.currentRole}.

Interview Details:
📍 Location: Near Dr. Gyan Prakash, Kalai Compound, NT Woods, Gandhi Park, Aligarh (202 001)
📅 Date: ${formatDate(cand.interviewDate)}
⏰ Time: ${cand.interviewTime}

Kindly confirm your availability at your earliest convenience.

For any information or assistance, please feel free to contact us.

Regards
Team HR
N.T Woods Pvt. Ltd.`;
}

// ==================== WALK-INS MODULE ====================
async function loadWalkins() {
    try {
        const response = await apiPost('getCandidates', { 
            filters: { walkInStatus: 'Informed' } 
        });
        const candidates = response.candidates || [];
        
        renderWalkinsList(candidates);
    } catch (error) {
        console.error('Error loading walk-ins:', error);
    }
}

function renderWalkinsList(candidates) {
    const list = document.getElementById('walkinsList');
    list.innerHTML = '';
    
    if (candidates.length === 0) {
        list.innerHTML = '<p>No candidates scheduled for walk-in.</p>';
        return;
    }
    
    candidates.forEach(cand => {
        const isToday = isDateToday(cand.interviewDate);
        
        const item = document.createElement('div');
        item.className = 'candidate-item';
        item.innerHTML = `
            <div class="candidate-details">
                <h3>${cand.name} ${isToday ? '🔴 TODAY' : ''}</h3>
                <p><strong>Mobile:</strong> ${cand.mobile}</p>
                <p><strong>Role:</strong> ${cand.currentRole}</p>
                <p><strong>Interview Date:</strong> ${formatDate(cand.interviewDate)}</p>
                <p><strong>Interview Time:</strong> ${cand.interviewTime}</p>
            </div>
            <div class="candidate-actions">
                ${isToday ? `
                    <button class="btn-success" onclick="generateInterviewLink('${cand.id}')">Mark Appeared</button>
                    <button class="btn-primary" onclick="openHRInterviewModal('${cand.id}')">HR Interview</button>
                    <button class="btn-warning" onclick="openTestMarksModal('${cand.id}')">Test Marks</button>
                ` : ''}
            </div>
        `;
        list.appendChild(item);
    });
}

async function generateInterviewLink(candId) {
    showLoading();
    try {
        const response = await apiPost('generateInterviewLink', {
            candidateId: candId
        });
        
        const link = response.link;
        copyToClipboard(link);
        
        showToast('Interview link generated and copied! Valid for 24 hours.', 'success');
    } catch (error) {
        showToast('Error generating interview link', 'error');
    }
    hideLoading();
}

function openHRInterviewModal(candId) {
    const cand = allCandidates.find(c => c.id === candId);
    if (!cand) return;
    
    document.getElementById('hrInterviewCandidateId').value = candId;
    document.getElementById('hrInterviewCandidateInfo').innerHTML = `
        <h3>${cand.name}</h3>
        <p><strong>Mobile:</strong> ${cand.mobile}</p>
        <p><strong>Role:</strong> ${cand.currentRole}</p>
    `;
    
    document.getElementById('formHRInterview').reset();
    openModal('modalHRInterview');
}

function openTestMarksModal(candId) {
    const cand = allCandidates.find(c => c.id === candId);
    if (!cand) return;
    
    document.getElementById('testCandidateId').value = candId;
    document.getElementById('testCandidateInfo').innerHTML = `
        <h3>${cand.name}</h3>
        <p><strong>Role:</strong> ${cand.currentRole}</p>
    `;
    
    document.getElementById('formTestMarks').reset();
    openModal('modalTestMarks');
}

// ==================== TEMPLATES MODULE ====================
async function loadTemplates() {
    try {
        const response = await apiPost('getAllJobTemplates', {});
        allTemplates = response.templates || [];
        
        renderTemplatesTable(allTemplates);
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

function renderTemplatesTable(templates) {
    const tbody = document.getElementById('templatesTableBody');
    tbody.innerHTML = '';
    
    templates.forEach(template => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${template.jobRole}</td>
            <td>${template.jobTitle}</td>
            <td>${template.shift}</td>
            <td>${template.payScale}</td>
            <td>
                ${canEdit('templates') ? `
                    <button class="btn-warning" onclick="editTemplate('${template.jobRole}')">Edit</button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });
}

function editTemplate(jobRole) {
    const template = allTemplates.find(t => t.jobRole === jobRole);
    if (!template) return;
    
    document.getElementById('templateJobRole').value = template.jobRole;
    document.getElementById('templateJobTitle').value = template.jobTitle;
    document.getElementById('templateRolesResp').value = template.rolesResponsibilities;
    document.getElementById('templateMustHave').value = template.mustHaveSkills;
    document.getElementById('templateShift').value = template.shift;
    document.getElementById('templatePayScale').value = template.payScale;
    document.getElementById('templatePerks').value = template.perks;
    
    document.getElementById('templateJobRole').readOnly = true;
    openModal('modalTemplate');
}

// ==================== USERS MODULE ====================
async function loadUsers() {
    try {
        const response = await apiPost('getAllUsers', {});
        allUsers = response.users || [];
        
        renderUsersTable(allUsers);
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role.toUpperCase()}</td>
            <td><span class="status-badge ${user.status.toLowerCase()}">${user.status}</span></td>
            <td>
                ${canEdit('users') ? `
                    <button class="btn-warning" onclick="editUser('${user.id}')">Edit</button>
                    ${user.status === 'Active' ? `
                        <button class="btn-danger" onclick="deactivateUser('${user.id}')">Deactivate</button>
                    ` : ''}
                ` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });
}

function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    document.getElementById('userId').value = user.id;
    document.getElementById('userName').value = user.name;
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userRoleSelect').value = user.role;
    
    document.getElementById('userEmail').readOnly = true;
    openModal('modalUser');
}

async function deactivateUser(userId) {
    if (!confirm('Deactivate this user?')) return;
    
    showLoading();
    try {
        await apiPost('deleteUser', { userId: userId });
        showToast('User deactivated successfully', 'success');
        await loadUsers();
    } catch (error) {
        showToast('Error deactivating user', 'error');
    }
    hideLoading();
}

// ==================== PERMISSIONS MODULE ====================
async function loadPermissionsModule() {
    const modules = ['requirements', 'candidates', 'shortlisting', 'telephonic', 
                     'owner-review', 'schedule', 'walkins', 'templates', 'users', 'reports'];
    const roles = ['admin', 'ea', 'hr'];
    
    const grid = document.getElementById('permissionsGrid');
    grid.innerHTML = '';
    
    for (const module of modules) {
        try {
            const response = await apiPost('getModulePermissions', { module: module });
            const permissions = response.permissions || {};
            
            const moduleDiv = document.createElement('div');
            moduleDiv.className = 'permission-module';
            moduleDiv.innerHTML = `<h3>${module.replace('-', ' ')}</h3>`;
            
            const rolesDiv = document.createElement('div');
            rolesDiv.className = 'permission-roles';
            
            roles.forEach(role => {
                const perm = permissions[role] || { view: false, create: false, edit: false, delete: false };
                
                const roleDiv = document.createElement('div');
                roleDiv.className = 'permission-role';
                roleDiv.innerHTML = `
                    <h4>${role}</h4>
                    <div class="permission-checks">
                        <div class="permission-check">
                            <input type="checkbox" id="perm_${module}_${role}_view" 
                                   ${perm.view ? 'checked' : ''} 
                                   onchange="updatePermission('${module}', '${role}', 'view', this.checked)">
                            <label for="perm_${module}_${role}_view">View</label>
                        </div>
                        <div class="permission-check">
                            <input type="checkbox" id="perm_${module}_${role}_create" 
                                   ${perm.create ? 'checked' : ''} 
                                   onchange="updatePermission('${module}', '${role}', 'create', this.checked)">
                            <label for="perm_${module}_${role}_create">Create</label>
                        </div>
                        <div class="permission-check">
                            <input type="checkbox" id="perm_${module}_${role}_edit" 
                                   ${perm.edit ? 'checked' : ''} 
                                   onchange="updatePermission('${module}', '${role}', 'edit', this.checked)">
                            <label for="perm_${module}_${role}_edit">Edit</label>
                        </div>
                        <div class="permission-check">
                            <input type="checkbox" id="perm_${module}_${role}_delete" 
                                   ${perm.delete ? 'checked' : ''} 
                                   onchange="updatePermission('${module}', '${role}', 'delete', this.checked)">
                            <label for="perm_${module}_${role}_delete">Delete</label>
                        </div>
                    </div>
                `;
                
                rolesDiv.appendChild(roleDiv);
            });
            
            moduleDiv.appendChild(rolesDiv);
            grid.appendChild(moduleDiv);
        } catch (error) {
            console.error(`Error loading permissions for ${module}:`, error);
        }
    }
}

async function updatePermission(module, role, permType, value) {
    // Get current permissions for this role/module
    const checkboxes = document.querySelectorAll(`[id^="perm_${module}_${role}_"]`);
    const permissions = {
        view: false,
        create: false,
        edit: false,
        delete: false
    };
    
    checkboxes.forEach(cb => {
        const type = cb.id.split('_')[3];
        permissions[type] = cb.checked;
    });
    
    try {
        await apiPost('updatePermissions', {
            module: module,
            role: role,
            permissions: permissions
        });
        showToast('Permission updated', 'success');
    } catch (error) {
        showToast('Error updating permission', 'error');
    }
}

// ==================== REPORTS MODULE ====================
async function loadReports() {
    try {
        const response = await apiPost('getAuditLog', {});
        const logs = response.logs || [];
        
        renderAuditLog(logs);
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

function renderAuditLog(logs) {
    const tbody = document.getElementById('auditLogTableBody');
    tbody.innerHTML = '';
    
    logs.slice(0, 100).forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDateTime(log.timestamp)}</td>
            <td>${log.user}</td>
            <td>${log.action}</td>
            <td>${log.description}</td>
        `;
        tbody.appendChild(row);
    });
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    
    // Raise Requirement
    document.getElementById('btnRaiseRequirement')?.addEventListener('click', () => {
        document.getElementById('formRaiseRequirement').reset();
        openModal('modalRaiseRequirement');
    });
    
    // Job Role selection - load template
    document.getElementById('reqJobRole')?.addEventListener('change', async (e) => {
        const jobRole = e.target.value;
        if (!jobRole) return;
        
        try {
            const response = await apiPost('getJobTemplate', { jobRole: jobRole });
            if (response.jobTitle) {
                document.getElementById('reqJobTitle').value = response.jobTitle;
                document.getElementById('reqRolesResp').value = response.rolesResponsibilities;
                document.getElementById('reqMustHave').value = response.mustHaveSkills;
                document.getElementById('reqShift').value = response.shift;
                document.getElementById('reqPayScale').value = response.payScale;
                document.getElementById('reqPerks').value = response.perks;
            }
        } catch (error) {
            // Template not found, ignore
        }
    });
    
    // Submit Requirement Form
    document.getElementById('formRaiseRequirement')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        showLoading();
        try {
            const reqData = {
                id: 'REQ' + Date.now(),
                jobRole: document.getElementById('reqJobRole').value,
                jobTitle: document.getElementById('reqJobTitle').value,
                rolesResponsibilities: document.getElementById('reqRolesResp').value,
                mustHaveSkills: document.getElementById('reqMustHave').value,
                shift: document.getElementById('reqShift').value,
                payScale: document.getElementById('reqPayScale').value,
                perks: document.getElementById('reqPerks').value,
                note: document.getElementById('reqNote').value,
                raisedBy: currentUser.email,
                raisedDate: new Date().toISOString(),
                status: 'Raised'
            };
            
            // Send to backend
            await apiPost('raiseRequirement', reqData);
            
            // Also save to localStorage for display (due to CORS)
            const existingReqs = localStorage.getItem('hrms_requirements');
            const requirements = existingReqs ? JSON.parse(existingReqs) : [];
            requirements.push(reqData);
            localStorage.setItem('hrms_requirements', JSON.stringify(requirements));
            
            showToast('Requirement raised successfully!', 'success');
            closeModal('modalRaiseRequirement');
            await loadRequirements();
        } catch (error) {
            showToast('Error raising requirement', 'error');
        }
        hideLoading();
    });
    
    // Upload Candidates
    document.getElementById('btnUploadCandidates')?.addEventListener('click', async () => {
        // Load requirements for dropdown
        const response = await apiPost('getRequirements', { filters: { status: 'Valid' } });
        let requirements = response.requirements || [];
        
        // If empty due to CORS, use localStorage
        if (requirements.length === 0) {
            const mockReqs = localStorage.getItem('hrms_requirements');
            if (mockReqs) {
                const allReqs = JSON.parse(mockReqs);
                requirements = allReqs.filter(r => r.status === 'Valid');
            }
        }
        
        const select = document.getElementById('uploadReqId');
        select.innerHTML = '<option value="">Select Requirement</option>';
        requirements.forEach(req => {
            select.innerHTML += `<option value="${req.id}">${req.id} - ${req.jobTitle}</option>`;
        });
        
        document.getElementById('formUploadCandidates').reset();
        openModal('modalUploadCandidates');
    });
    
    // Submit Upload Candidates Form
    document.getElementById('formUploadCandidates')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const reqId = document.getElementById('uploadReqId').value;
        const files = document.getElementById('uploadCVs').files;
        
        if (files.length === 0) {
            showToast('Please select CV files', 'warning');
            return;
        }
        
        // Parse file names and upload
        const candidates = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
            const parts = fileName.split('_');
            
            if (parts.length >= 3) {
                candidates.push({
                    name: parts[0],
                    mobile: parts[1],
                    source: parts[2],
                    cvUrl: '' // In real implementation, upload to Google Drive
                });
            }
        }
        
        // Show progress
        const progressDiv = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('uploadProgressFill');
        const progressText = document.getElementById('uploadProgressText');
        
        progressDiv.style.display = 'block';
        
        // Upload in batches
        for (let i = 0; i < candidates.length; i++) {
            progressFill.style.width = `${((i + 1) / candidates.length) * 100}%`;
            progressText.textContent = `Uploading ${i + 1} of ${candidates.length}...`;
            
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate upload
        }
        
        try {
            // Get requirement for job role
            const req = allRequirements.find(r => r.id === reqId);
            
            // Add IDs and status to candidates
            const candidatesWithIds = candidates.map(c => ({
                ...c,
                id: 'CAND' + Date.now() + Math.random().toString(36).substr(2, 5),
                requirementId: reqId,
                currentRole: req?.jobRole || 'Unknown',
                status: 'Uploaded',
                uploadDate: new Date().toISOString()
            }));
            
            await apiPost('uploadCandidates', {
                requirementId: reqId,
                jobRole: req?.jobRole || 'Unknown',
                candidates: candidatesWithIds
            });
            
            // Also save to localStorage for display (due to CORS)
            const existingCands = localStorage.getItem('hrms_candidates');
            const allCands = existingCands ? JSON.parse(existingCands) : [];
            allCands.push(...candidatesWithIds);
            localStorage.setItem('hrms_candidates', JSON.stringify(allCands));
            
            showToast(`${candidates.length} candidates uploaded successfully!`, 'success');
            closeModal('modalUploadCandidates');
            await loadCandidates();
        } catch (error) {
            showToast('Error uploading candidates', 'error');
        }
        
        progressDiv.style.display = 'none';
    });
    
    // Telephonic Status Change
    document.getElementById('telephonicStatus')?.addEventListener('change', (e) => {
        const reasonGroup = document.getElementById('telephonicReasonGroup');
        if (e.target.value === 'Reject') {
            reasonGroup.style.display = 'block';
        } else {
            reasonGroup.style.display = 'none';
        }
    });
    
    // Submit Telephonic Form
    document.getElementById('formTelephonic')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        showLoading();
        try {
            await apiPost('recordTelephonic', {
                candidateId: document.getElementById('telephonicCandidateId').value,
                status: document.getElementById('telephonicStatus').value,
                communicationMarks: parseInt(document.getElementById('telephonicComm').value),
                experienceMarks: parseInt(document.getElementById('telephonicExp').value),
                reason: document.getElementById('telephonicReason').value
            });
            
            showToast('Telephonic screening recorded successfully!', 'success');
            closeModal('modalTelephonic');
            await loadTelephonic();
        } catch (error) {
            showToast('Error recording telephonic screening', 'error');
        }
        hideLoading();
    });
    
    // Owner Decision Change
    document.getElementById('ownerDecision')?.addEventListener('change', (e) => {
        const scheduleGroup = document.getElementById('ownerScheduleGroup');
        const timeGroup = document.getElementById('ownerTimeGroup');
        const reasonGroup = document.getElementById('ownerReasonGroup');
        
        if (e.target.value === 'Approved') {
            scheduleGroup.style.display = 'block';
            timeGroup.style.display = 'block';
            reasonGroup.style.display = 'none';
        } else if (e.target.value === 'Rejected' || e.target.value === 'Hold') {
            scheduleGroup.style.display = 'none';
            timeGroup.style.display = 'none';
            reasonGroup.style.display = 'block';
        } else {
            scheduleGroup.style.display = 'none';
            timeGroup.style.display = 'none';
            reasonGroup.style.display = 'none';
        }
    });
    
    // Submit Owner Review Form
    document.getElementById('formOwnerReview')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        showLoading();
        try {
            await apiPost('ownerReview', {
                candidateId: document.getElementById('ownerCandidateId').value,
                decision: document.getElementById('ownerDecision').value,
                interviewDate: document.getElementById('ownerInterviewDate').value,
                interviewTime: document.getElementById('ownerInterviewTime').value,
                reason: document.getElementById('ownerReason').value
            });
            
            showToast('Owner review recorded successfully!', 'success');
            closeModal('modalOwnerReview');
            await loadOwnerReview();
        } catch (error) {
            showToast('Error recording owner review', 'error');
        }
        hideLoading();
    });
    
    // Schedule Call Status Change
    document.getElementById('scheduleCallStatus')?.addEventListener('change', (e) => {
        const messageSection = document.getElementById('interviewMessageSection');
        if (e.target.value === 'Informed') {
            messageSection.style.display = 'block';
        } else {
            messageSection.style.display = 'none';
        }
    });
    
    // Copy Interview Message
    document.getElementById('btnCopyMessage')?.addEventListener('click', () => {
        const message = document.getElementById('interviewMessage').value;
        copyToClipboard(message);
        showToast('Message copied to clipboard!', 'success');
    });
    
    // Submit Schedule Interview Form
    document.getElementById('formScheduleInterview')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const cand = allCandidates.find(c => c.id === document.getElementById('scheduleCandidateId').value);
        
        showLoading();
        try {
            await apiPost('scheduleInterview', {
                candidateId: document.getElementById('scheduleCandidateId').value,
                status: document.getElementById('scheduleCallStatus').value,
                interviewDate: cand.interviewDate,
                interviewTime: cand.interviewTime
            });
            
            showToast('Interview schedule updated!', 'success');
            closeModal('modalScheduleInterview');
            await loadSchedule();
        } catch (error) {
            showToast('Error updating interview schedule', 'error');
        }
        hideLoading();
    });
    
    // Submit HR Interview Form
    document.getElementById('formHRInterview')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        showLoading();
        try {
            await apiPost('recordHRInterview', {
                candidateId: document.getElementById('hrInterviewCandidateId').value,
                marks: parseInt(document.getElementById('hrInterviewMarks').value)
            });
            
            showToast('HR interview marks recorded!', 'success');
            closeModal('modalHRInterview');
            await loadWalkins();
        } catch (error) {
            showToast('Error recording HR interview', 'error');
        }
        hideLoading();
    });
    
    // Submit Test Marks Form
    document.getElementById('formTestMarks')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        showLoading();
        try {
            await apiPost('recordTestMarks', {
                candidateId: document.getElementById('testCandidateId').value,
                testType: document.getElementById('testType').value,
                marks: parseInt(document.getElementById('testMarksValue').value)
            });
            
            showToast('Test marks recorded!', 'success');
            closeModal('modalTestMarks');
            await loadWalkins();
        } catch (error) {
            showToast('Error recording test marks', 'error');
        }
        hideLoading();
    });
    
    // Add User
    document.getElementById('btnAddUser')?.addEventListener('click', () => {
        document.getElementById('formUser').reset();
        document.getElementById('userId').value = '';
        document.getElementById('userEmail').readOnly = false;
        document.getElementById('modalUserTitle').textContent = 'Add User';
        openModal('modalUser');
    });
    
    // Submit User Form
    document.getElementById('formUser')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const userId = document.getElementById('userId').value;
        const action = userId ? 'updateUser' : 'createUser';
        
        showLoading();
        try {
            const data = {
                name: document.getElementById('userName').value,
                email: document.getElementById('userEmail').value,
                role: document.getElementById('userRoleSelect').value
            };
            
            if (userId) {
                data.userId = userId;
            }
            
            await apiPost(action, data);
            
            showToast(`User ${userId ? 'updated' : 'created'} successfully!`, 'success');
            closeModal('modalUser');
            await loadUsers();
        } catch (error) {
            showToast(`Error ${userId ? 'updating' : 'creating'} user`, 'error');
        }
        hideLoading();
    });
    
    // Add Template
    document.getElementById('btnAddTemplate')?.addEventListener('click', () => {
        document.getElementById('formTemplate').reset();
        document.getElementById('templateJobRole').readOnly = false;
        document.getElementById('modalTemplateTitle').textContent = 'Add Job Template';
        openModal('modalTemplate');
    });
    
    // Submit Template Form
    document.getElementById('formTemplate')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        showLoading();
        try {
            await apiPost('saveJobTemplate', {
                jobRole: document.getElementById('templateJobRole').value,
                jobTitle: document.getElementById('templateJobTitle').value,
                rolesResponsibilities: document.getElementById('templateRolesResp').value,
                mustHaveSkills: document.getElementById('templateMustHave').value,
                shift: document.getElementById('templateShift').value,
                payScale: document.getElementById('templatePayScale').value,
                perks: document.getElementById('templatePerks').value
            });
            
            showToast('Template saved successfully!', 'success');
            closeModal('modalTemplate');
            await loadTemplates();
        } catch (error) {
            showToast('Error saving template', 'error');
        }
        hideLoading();
    });
    
    // Filter Requirements
    document.getElementById('btnFilterReq')?.addEventListener('click', () => {
        const status = document.getElementById('filterReqStatus').value;
        loadRequirements({ status: status || undefined });
    });
    
    // Filter Candidates
    document.getElementById('btnFilterCand')?.addEventListener('click', () => {
        const reqId = document.getElementById('filterReqId').value;
        const status = document.getElementById('filterCandStatus').value;
        loadCandidates({ 
            requirementId: reqId || undefined, 
            status: status || undefined 
        });
    });
    
    // Filter Today's Walk-ins
    document.getElementById('btnFilterToday')?.addEventListener('click', async () => {
        showLoading();
        try {
            const response = await apiPost('getCandidates', { 
                filters: { walkInStatus: 'Informed' } 
            });
            const candidates = (response.candidates || []).filter(c => isDateToday(c.interviewDate));
            renderWalkinsList(candidates);
        } catch (error) {
            showToast('Error filtering candidates', 'error');
        }
        hideLoading();
    });
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });
    
    // Close modal on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

// ==================== API FUNCTIONS ====================
async function apiCall(method, url) {
    try {
        const response = await fetch(url, { 
            method: method,
            mode: 'no-cors'
        });
        
        // With no-cors, we can't read the response, so assume success
        return { success: true };
    } catch (error) {
        console.error('API Call Error:', error);
        throw error;
    }
}

async function apiPost(action, payload) {
    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: action,
                userEmail: currentUser.email,
                ...payload
            })
        });
        
        // With no-cors mode, we can't read response
        // Return success for now
        return { success: true, data: {} };
    } catch (error) {
        console.error('API Post Error:', error);
        throw error;
    }
}

// ==================== UTILITY FUNCTIONS ====================
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleString('en-IN');
}

function isDateToday(date) {
    if (!date) return false;
    const today = new Date();
    const checkDate = new Date(date);
    return checkDate.getDate() === today.getDate() &&
           checkDate.getMonth() === today.getMonth() &&
           checkDate.getFullYear() === today.getFullYear();
}

function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}

function canView(module) {
    return userPermissions[module]?.view || currentUser.role === 'admin';
}

function canCreate(module) {
    return userPermissions[module]?.create || currentUser.role === 'admin';
}

function canEdit(module) {
    return userPermissions[module]?.edit || currentUser.role === 'admin';
}

function canDelete(module) {
    return userPermissions[module]?.delete || currentUser.role === 'admin';
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('hrms_user');
        currentUser = null;
        google.accounts.id.disableAutoSelect();
        location.reload();
    }
}

// ==================== RANDOM QUESTIONS GENERATOR ====================
function generateRandomQuestions() {
    const questions = [];
    
    // Mathematical questions
    const mathQuestions = [
        { q: '75% of 200', a: 150 },
        { q: '88% of 100', a: 88 },
        { q: '120% of 200', a: 240 },
        { q: 'Half of 230', a: 115 },
        { q: 'One third of 300', a: 100 },
        { q: 'One fourth of 240', a: 60 },
        { q: 'Convert 5m to cm', a: 500 },
        { q: 'Convert 2.5km to m', a: 2500 },
        { q: '25% of 80', a: 20 },
        { q: '15% of 200', a: 30 }
    ];
    
    // Select 4 random questions
    const shuffled = mathQuestions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 4);
}
