// Supabase Configuration
// Replace with your actual Supabase URL and Key
const supabaseUrl = 'https://uximseyeqkhoghsrksds.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aW1zZXllcWtob2doc3Jrc2RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjYwODksImV4cCI6MjA5NDY0MjA4OX0.5BdspRtw7IBI201E-RrqXiDJ-MDQFBpKhJlaujP-i6w';

let supabaseClient;
if (window.supabase) {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
}

const App = {
    user: null,
    profile: null,
    charts: {},

    init: async function () {
        if (!supabaseClient) return;

        // Restore Dark Mode
        if (localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
        }

        this.attachEventListeners();
        await this.checkAuthStatus();
        
        // Initialize global components
        this.initRealtime();
        if (this.profile && this.profile.role === 'student') {
            this.initChatbot();
        }

        this.routePage();
    },

    toggleDarkMode: function() {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
        // Re-render charts to update colors if on faculty dashboard
        if (this.profile && this.profile.role === 'faculty') {
            this.fetchFacultyRequests();
        }
    },

    attachEventListeners: function () {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.addEventListener('submit', (e) => this.handleLogin(e));

        const regForm = document.getElementById('registerForm');
        if (regForm) regForm.addEventListener('submit', (e) => this.handleRegister(e));

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.handleLogout());

        const bookForm = document.getElementById('bookForm');
        if (bookForm) bookForm.addEventListener('submit', (e) => this.handleBooking(e));

        const availForm = document.getElementById('availabilityForm');
        if (availForm) availForm.addEventListener('submit', (e) => this.handleAddAvailability(e));

        // Sidebar Navigation
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href !== '#' && !href.startsWith('javascript:')) {
                    return; // Let standard page navigation run!
                }
                e.preventDefault();
                const viewId = link.id.replace('nav-', '');
                this.switchView(viewId);
            });
        });

        // Profile Events
        const profileForm = document.getElementById('profileForm');
        if (profileForm) profileForm.addEventListener('submit', (e) => this.handleProfileSubmit(e));

        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) passwordForm.addEventListener('submit', (e) => this.handlePasswordSubmit(e));

        const avatarUpload = document.getElementById('avatarUpload');
        if (avatarUpload) avatarUpload.addEventListener('change', (e) => this.handleAvatarUpload(e));

        const facultySelect = document.getElementById('facultySelect');
        if (facultySelect) {
            facultySelect.addEventListener('change', () => this.handleFacultySelectChange());
        }

        // Hide notification badge when dropdown is opened
        const notifBtn = document.querySelector('[data-bs-toggle="dropdown"]');
        if (notifBtn && document.getElementById('notificationList')) {
            notifBtn.addEventListener('click', () => {
                const badge = document.getElementById('notifBadge');
                if (badge && badge.style.display === 'block') {
                    badge.style.display = 'none';
                    sessionStorage.setItem('notifsViewed', 'true');
                }
            });
        }
    },

    checkAuthStatus: async function () {
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (session) {
            this.user = session.user;
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', this.user.id)
                .single();
            this.profile = profile;

            // Setup User Menu if on index
            const userMenu = document.getElementById('userMenu');
            if (userMenu) {
                const dashboardLink = this.profile.role === 'faculty' ? 'faculty-dashboard.html' : 'student-dashboard.html';
                userMenu.innerHTML = `
                    <a href="${dashboardLink}" class="btn btn-outline-light me-2 rounded-pill px-4">Dashboard</a>
                    <button onclick="App.handleLogout()" class="btn btn-accent rounded-pill px-4 fw-bold shadow-sm">Logout</button>
                `;
            }

            // Populate Sidebar Profile
            if (document.getElementById('sidebarUserName') || document.getElementById('userName')) {
                const oldUserName = document.getElementById('userName');
                if (oldUserName) oldUserName.textContent = this.profile.full_name;
                const oldUserDept = document.getElementById('userDept');
                if (oldUserDept) oldUserDept.textContent = this.profile.department || this.profile.role;
                const initials = this.profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                
                // Populate the new beautiful Sidebar Profile Card
                const sidebarName = document.getElementById('sidebarUserName');
                if (sidebarName) sidebarName.textContent = this.profile.full_name;
                const sidebarEmail = document.getElementById('sidebarUserEmail');
                if (sidebarEmail) sidebarEmail.textContent = this.profile.email || '';
                const sidebarRole = document.getElementById('sidebarUserRole');
                if (sidebarRole) sidebarRole.textContent = this.profile.role.toUpperCase();
                
                const sidebarInitialsEl = document.getElementById('sidebarUserInitials');
                if (sidebarInitialsEl) {
                    if (this.profile.avatar) {
                        sidebarInitialsEl.innerHTML = `<img src="${this.profile.avatar}" class="w-100 h-100 rounded-circle object-fit-cover border border-3 border-white">`;
                        sidebarInitialsEl.classList.remove('bg-primary', 'text-white', 'd-flex', 'align-items-center', 'justify-content-center', 'border-3');
                    } else {
                        sidebarInitialsEl.textContent = initials;
                    }
                }

                // Populate detail rows
                const sidebarIdNumber = document.getElementById('sidebarIdNumber');
                if (sidebarIdNumber) sidebarIdNumber.textContent = this.profile.id_number || '—';
                const sidebarDept = document.getElementById('sidebarDept');
                if (sidebarDept) sidebarDept.textContent = this.profile.department || '—';
                const sidebarAge = document.getElementById('sidebarAge');
                if (sidebarAge) sidebarAge.textContent = this.profile.age || '—';
                const sidebarAddress = document.getElementById('sidebarAddress');
                if (sidebarAddress) sidebarAddress.textContent = this.profile.address || '—';

                // Populate profile view if on dashboard
                this.populateProfileView();
            }

            // Always try to populate dedicated profile page (profile.html)
            this.populateProfilePage();
        }
    },

    routePage: function () {
        const path = window.location.pathname;
        const isAuthPage = path.includes('login.html') || path.includes('register.html');
        const isDashboard = path.includes('dashboard.html');
        const isProfilePage = path.includes('profile.html');

        if (this.user) {
            if (isAuthPage) {
                const dash = this.profile.role === 'faculty' ? 'faculty-dashboard.html' : 'student-dashboard.html';
                window.location.replace(dash);
            } else if (isProfilePage) {
                // Set back button destination
                const backBtn = document.getElementById('backToDashboard');
                if (backBtn) backBtn.href = this.profile.role === 'faculty' ? 'faculty-dashboard.html' : 'student-dashboard.html';
                this.loadProfilePageStatsAndTimeline();
            } else if (isDashboard) {
                if (path.includes('student') && this.profile.role === 'faculty') window.location.replace('faculty-dashboard.html');
                if (path.includes('faculty') && this.profile.role === 'student') window.location.replace('student-dashboard.html');

                if (this.profile.role === 'student') this.loadStudentDashboard();
                if (this.profile.role === 'faculty') this.loadFacultyDashboard();
            }
        } else {
            if (isDashboard) {
                window.location.replace('login.html');
            }
        }
    },

    handleLogin: async function (e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const alertBox = document.getElementById('loginAlert');
        const btn = document.getElementById('loginBtn');
        const originalText = btn.innerHTML;

        try {
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            btn.disabled = true;

            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

            if (error) throw error;

            window.location.reload();
        } catch (error) {
            alertBox.textContent = error.message;
            alertBox.classList.remove('d-none');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    handleRegister: async function (e) {
        e.preventDefault();
        const fullName = document.getElementById('fullName').value;
        const role = document.getElementById('role').value;
        const idNumber = document.getElementById('idNumber').value;
        const department = document.getElementById('department').value;
        const address = document.getElementById('address') ? document.getElementById('address').value : '';
        const age = document.getElementById('age') ? document.getElementById('age').value : '';
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('confirmPassword').value;
        const alertBox = document.getElementById('registerAlert');
        const btn = document.getElementById('registerBtn');

        if (password !== confirm) {
            alertBox.textContent = "Passwords do not match.";
            alertBox.classList.remove('d-none');
            return;
        }

        try {
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            btn.disabled = true;

            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        role: role,
                        id_number: idNumber,
                        department: department,
                        address: address,
                        age: age
                    }
                }
            });

            if (error) throw error;

            // Note: Since Supabase triggers handle user profile creation, we just wait.
            alert("Registration successful! Please check your email or login.");
            window.location.replace('login.html');
        } catch (error) {
            alertBox.textContent = error.message;
            alertBox.classList.remove('d-none');
            btn.innerHTML = 'Register Account <i class="fa-solid fa-user-plus"></i>';
            btn.disabled = false;
        }
    },

    handleLogout: async function () {
        await supabaseClient.auth.signOut();
        window.location.replace('login.html');
    },

    switchView: function (viewId) {
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active', 'text-primary', 'bg-light', 'border-primary'));
        const activeLink = document.getElementById(`nav-${viewId}`);
        if (activeLink) activeLink.classList.add('active', 'text-primary', 'bg-light', 'border-primary');

        const views = ['view-dashboard', 'view-book', 'view-history', 'view-requests', 'view-availability', 'view-profile'];
        views.forEach(v => {
            const el = document.getElementById(v);
            if (el) el.classList.add('d-none');
        });

        const targetView = document.getElementById(`view-${viewId}`);
        if (targetView) targetView.classList.remove('d-none');
    },

    // --- PROFILE LOGIC ---
    populateProfileView: function() {
        if (!document.getElementById('profileName')) return;
        
        document.getElementById('profileName').value = this.profile.full_name;
        document.getElementById('profileDept').value = this.profile.department || '';
        if (document.getElementById('profileIdNumber')) {
            document.getElementById('profileIdNumber').value = this.profile.id_number || '';
        }
        if (document.getElementById('profileAddress')) {
            document.getElementById('profileAddress').value = this.profile.address || '';
        }
        if (document.getElementById('profileAge')) {
            document.getElementById('profileAge').value = this.profile.age || '';
        }
        document.getElementById('profileEmail').value = this.profile.email;
        
        document.getElementById('profileNameDisplay').textContent = this.profile.full_name;
        const emailDisp = document.getElementById('profileEmailDisplay');
        if (emailDisp) emailDisp.textContent = this.profile.email;
        const roleBadge = document.getElementById('profileRoleBadge');
        if (roleBadge) roleBadge.textContent = this.profile.role.toUpperCase();

        if (this.profile.avatar) {
            document.getElementById('profileAvatarPreview').src = this.profile.avatar;
            document.getElementById('profileAvatarPreview').style.display = 'block';
            document.getElementById('profileAvatarInitials').style.display = 'none';
        } else {
            const initialsEl = document.getElementById('sidebarUserInitials') || document.getElementById('userInitials');
            const initials = initialsEl ? initialsEl.textContent.trim() : 'ST';
            document.getElementById('profileAvatarInitials').textContent = initials;
            document.getElementById('profileAvatarPreview').style.display = 'none';
            document.getElementById('profileAvatarInitials').style.display = 'flex';
        }
    },

    populateProfilePage: function() {
        if (!document.getElementById('heroName')) return;
        const p = this.profile;
        const initials = p.full_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();

        // Hero section
        document.getElementById('heroName').textContent = p.full_name;
        document.getElementById('heroEmail').textContent = p.email;
        document.getElementById('heroBadge').textContent = p.role.toUpperCase();
        document.getElementById('profileInitialsText').textContent = initials;

        if (p.avatar) {
            document.getElementById('profileAvatarPreview').src = p.avatar;
            document.getElementById('profileAvatarPreview').style.display = 'block';
            document.getElementById('profileInitialsText').style.display = 'none';
        }

        // Info card
        document.getElementById('infoIdNumber').textContent = p.id_number || '—';
        document.getElementById('infoDept').textContent = p.department || '—';
        document.getElementById('infoEmail').textContent = p.email;
        document.getElementById('infoAge').textContent = p.age || '—';
        document.getElementById('infoAddress').textContent = p.address || '—';

        // Edit form
        const profileNameInput = document.getElementById('profileName');
        if (profileNameInput) {
            profileNameInput.value = p.full_name;
            if (document.getElementById('profileEmail')) document.getElementById('profileEmail').value = p.email;
            if (document.getElementById('profileIdNumber')) document.getElementById('profileIdNumber').value = p.id_number || '';
            if (document.getElementById('profileDept')) document.getElementById('profileDept').value = p.department || '';
            if (document.getElementById('profileAddress')) document.getElementById('profileAddress').value = p.address || '';
            if (document.getElementById('profileAge')) document.getElementById('profileAge').value = p.age || '';
        }

        // Avatar upload handler
        const avatarInput = document.getElementById('avatarUpload');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this.tempAvatar = ev.target.result;
                    document.getElementById('profileAvatarPreview').src = ev.target.result;
                    document.getElementById('profileAvatarPreview').style.display = 'block';
                    document.getElementById('profileInitialsText').style.display = 'none';
                };
                reader.readAsDataURL(file);
            });
        }

        // Profile form
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('saveProfileBtn');
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin me-2"></i>Saving...';
                btn.disabled = true;

                const updates = {
                    full_name: document.getElementById('profileName').value,
                    department: document.getElementById('profileDept').value,
                    id_number: document.getElementById('profileIdNumber').value,
                    address: document.getElementById('profileAddress').value,
                    age: parseInt(document.getElementById('profileAge').value) || null
                };
                if (this.tempAvatar) updates.avatar = this.tempAvatar;

                const { error } = await supabaseClient.from('profiles').update(updates).eq('id', this.user.id);

                btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-2"></i>Save Changes';
                btn.disabled = false;

                if (error) {
                    this.showProfileToast('Error: ' + error.message, 'danger');
                } else {
                    Object.assign(this.profile, updates);
                    // Refresh info card
                    document.getElementById('heroName').textContent = updates.full_name;
                    document.getElementById('infoIdNumber').textContent = updates.id_number || '—';
                    document.getElementById('infoDept').textContent = updates.department || '—';
                    document.getElementById('infoAge').textContent = updates.age || '—';
                    document.getElementById('infoAddress').textContent = updates.address || '—';
                    this.showProfileToast('Profile updated successfully!', 'success');
                }
            });
        }

        // Action Buttons (Share & Export)
        const btnShare = document.getElementById('btnShareProfile');
        if (btnShare) {
            btnShare.addEventListener('click', () => {
                const infoText = `ConsulTime Profile\nName: ${p.full_name}\nRole: ${p.role.toUpperCase()}\nID Number: ${p.id_number || '—'}\nDepartment: ${p.department || '—'}\nEmail: ${p.email}`;
                navigator.clipboard.writeText(infoText).then(() => {
                    this.showProfileToast('📋 Profile details copied to clipboard!', 'success');
                }).catch(() => {
                    this.showProfileToast('Unable to copy details.', 'danger');
                });
            });
        }

        const btnPrint = document.getElementById('btnPrintProfile');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                window.print();
            });
        }
    },

    showProfileToast: function(message, type) {
        const box = document.getElementById('toastBox');
        const body = document.getElementById('toastBody');
        if (!box || !body) return;
        const icons = { success: 'fa-circle-check text-success', danger: 'fa-circle-xmark text-danger', info: 'fa-circle-info text-info' };
        body.innerHTML = `<i class="fa-solid ${icons[type] || icons.info} fs-5"></i> ${message}`;
        box.style.display = 'block';
        setTimeout(() => { box.style.display = 'none'; }, 3500);
    },

    handleAvatarUpload: function(e) {

        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Str = event.target.result;
            // Update UI immediately
            document.getElementById('profileAvatarPreview').src = base64Str;
            document.getElementById('profileAvatarPreview').style.display = 'block';
            document.getElementById('profileAvatarInitials').style.display = 'none';
            // Save to object so handleProfileSubmit can access it
            this.tempAvatar = base64Str;
        };
        reader.readAsDataURL(file);
    },

    handleProfileSubmit: async function(e) {
        e.preventDefault();
        const btn = document.getElementById('saveProfileBtn');
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Saving...';
        btn.disabled = true;

        const name = document.getElementById('profileName').value;
        const dept = document.getElementById('profileDept').value;
        const idNumber = document.getElementById('profileIdNumber') ? document.getElementById('profileIdNumber').value : '';
        const address = document.getElementById('profileAddress') ? document.getElementById('profileAddress').value : '';
        const age = document.getElementById('profileAge') ? document.getElementById('profileAge').value : '';
        
        const updates = {
            full_name: name,
            department: dept
        };
        if (idNumber) updates.id_number = idNumber;
        if (address) updates.address = address;
        if (age) updates.age = parseInt(age);

        if (this.tempAvatar) {
            updates.avatar = this.tempAvatar;
        }

        const { error } = await supabaseClient.from('profiles').update(updates).eq('id', this.user.id);
        
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i> Save Changes';
        btn.disabled = false;

        if (error) {
            this.showToast('Error', error.message, 'danger');
        } else {
            this.showToast('Success', 'Profile updated successfully!', 'success');
            // Update local state
            this.profile.full_name = name;
            this.profile.department = dept;
            if (idNumber) this.profile.id_number = idNumber;
            if (address) this.profile.address = address;
            if (age) this.profile.age = parseInt(age);
            if (this.tempAvatar) this.profile.avatar = this.tempAvatar;
            this.checkAuthStatus(); // Refresh UI headers
        }
    },

    handlePasswordSubmit: async function(e) {
        e.preventDefault();
        const newPw = document.getElementById('newPassword').value;
        const confirmPw = document.getElementById('confirmNewPassword').value;
        const btn = document.getElementById('changePasswordBtn');

        if (newPw !== confirmPw) {
            if (document.getElementById('toastBox')) {
                this.showProfileToast('Passwords do not match!', 'danger');
            } else {
                this.showToast('Error', 'Passwords do not match!', 'danger');
            }
            return;
        }

        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin me-2"></i>Updating...';
        btn.disabled = true;

        const { error } = await supabaseClient.auth.updateUser({ password: newPw });

        btn.innerHTML = '<i class="fa-solid fa-key me-2"></i>Update Password';
        btn.disabled = false;

        if (error) {
            if (document.getElementById('toastBox')) {
                this.showProfileToast('Error: ' + error.message, 'danger');
            } else {
                this.showToast('Error', error.message, 'danger');
            }
        } else {
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmNewPassword').value = '';
            if (document.getElementById('toastBox')) {
                this.showProfileToast('Password updated successfully!', 'success');
            } else {
                this.showToast('Success', 'Password updated successfully!', 'success');
            }
        }
    },

    loadProfilePageStatsAndTimeline: async function() {
        if (!document.getElementById('profileStatTotal')) return;

        try {
            const role = this.profile.role;
            const joinQuery = role === 'faculty' 
                ? '*, profiles!appointments_student_id_fkey(full_name)' 
                : '*, profiles!appointments_faculty_id_fkey(full_name)';
            
            const { data, error } = await supabaseClient
                .from('appointments')
                .select(joinQuery)
                .or(`student_id.eq.${this.user.id},faculty_id.eq.${this.user.id}`)
                .order('appointment_date', { ascending: false });

            if (error) throw error;

            let total = data.length;
            let completed = data.filter(a => a.status === 'completed').length;
            let pending = data.filter(a => a.status === 'pending' || a.status === 'approved').length;

            document.getElementById('profileStatTotal').textContent = total;
            document.getElementById('profileStatCompleted').textContent = completed;
            document.getElementById('profileStatPending').textContent = pending;

            // Render Timeline
            const timeline = document.getElementById('profileTimeline');
            timeline.innerHTML = '';

            if (data.length === 0) {
                timeline.innerHTML = '<div class="text-center py-4 text-muted small"><i class="fa-solid fa-circle-info mb-2 fs-5 text-muted d-block"></i>No recent consultations activity recorded yet.</div>';
                return;
            }

            // Take the last 4 appointments for the timeline
            data.slice(0, 4).forEach(appt => {
                const dateObj = new Date(appt.appointment_date);
                const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                const formatTime = (time) => new Date(`1970-01-01T${time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                let title = '';
                let desc = '';
                let icon = '';
                
                if (role === 'student') {
                    // Student timeline
                    const partnerName = appt.profiles ? appt.profiles.full_name : 'Faculty';
                    icon = appt.status === 'completed' ? 'fa-check' : (appt.status === 'approved' ? 'fa-calendar' : (appt.status === 'pending' ? 'fa-clock' : 'fa-xmark'));
                    
                    if (appt.status === 'completed') {
                        title = `Completed consultation with ${partnerName}`;
                        desc = `Topic: "${appt.purpose}" successfully resolved.`;
                    } else if (appt.status === 'approved') {
                        title = `Consultation scheduled with ${partnerName}`;
                        desc = `Confirmed for ${formatTime(appt.start_time)} - ${formatTime(appt.end_time)}.`;
                    } else if (appt.status === 'pending') {
                        title = `Requested consultation with ${partnerName}`;
                        desc = `Awaiting approval for the purpose: "${appt.purpose}".`;
                    } else {
                        title = `Consultation with ${partnerName} rejected`;
                        desc = appt.notes ? `Reason: "${appt.notes}"` : `The request was rejected or cancelled.`;
                    }
                } else {
                    // Faculty timeline
                    const partnerName = appt.profiles ? appt.profiles.full_name : 'Student';
                    icon = appt.status === 'completed' ? 'fa-check' : (appt.status === 'approved' ? 'fa-calendar' : (appt.status === 'pending' ? 'fa-clock' : 'fa-xmark'));
                    
                    if (appt.status === 'completed') {
                        title = `Completed consultation with ${partnerName}`;
                        desc = `Resolved purpose: "${appt.purpose}".`;
                    } else if (appt.status === 'approved') {
                        title = `Scheduled consultation with ${partnerName}`;
                        desc = `Time: ${formatTime(appt.start_time)} - ${formatTime(appt.end_time)}.`;
                    } else if (appt.status === 'pending') {
                        title = `New consultation request from ${partnerName}`;
                        desc = `Requested a session for: "${appt.purpose}".`;
                    } else {
                        title = `Consultation request with ${partnerName} rejected`;
                        desc = appt.notes ? `Feedback provided: "${appt.notes}"` : `Request was declined.`;
                    }
                }

                timeline.innerHTML += `
                    <div class="timeline-item ${appt.status}">
                        <div class="timeline-icon">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div class="timeline-content text-start">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span class="fw-bold text-dark" style="font-size: 13px;">${title}</span>
                                <span class="timeline-time">${dateStr}</span>
                            </div>
                            <p class="mb-0 text-muted small" style="font-size: 12px; line-height: 1.4;">${desc}</p>
                        </div>
                    </div>
                `;
            });

        } catch (error) {
            console.error("Timeline error:", error);
            document.getElementById('profileTimeline').innerHTML = '<div class="text-center py-4 text-danger small"><i class="fa-solid fa-triangle-exclamation mb-1 fs-5 d-block"></i>Unable to load consultation history.</div>';
        }
    },

    // --- STUDENT DASHBOARD LOGIC ---
    loadStudentDashboard: async function () {
        this.fetchFacultyList();
        this.fetchStudentAppointments();
    },

    fetchFacultyList: async function () {
        const select = document.getElementById('facultySelect');
        if (!select) return;

        const { data, error } = await supabaseClient
            .from('profiles')
            .select('id, full_name, department')
            .eq('role', 'faculty');

        if (error) {
            console.error(error);
            return;
        }

        select.innerHTML = '<option value="" disabled selected>Select a faculty member...</option>';
        
        // Group faculty by department for a cleaner dropdown UI
        const groupedFaculty = data.reduce((acc, fac) => {
            const dept = fac.department || 'General Department';
            if (!acc[dept]) acc[dept] = [];
            acc[dept].push(fac);
            return acc;
        }, {});

        // Sort and render optgroups
        Object.keys(groupedFaculty).sort().forEach(dept => {
            let optgroup = `<optgroup label="${dept}">`;
            groupedFaculty[dept].forEach(fac => {
                optgroup += `<option value="${fac.id}">${fac.full_name}</option>`;
            });
            optgroup += `</optgroup>`;
            select.innerHTML += optgroup;
        });
    },

    handleFacultySelectChange: async function() {
        const facId = document.getElementById('facultySelect').value;
        const dateInput = document.getElementById('appointmentDate');
        const container = document.getElementById('availabilityContainer');
        const slotsDiv = document.getElementById('timeSlotsContainer');

        if (!facId) return;

        // Reset fields
        dateInput.value = '';
        dateInput.disabled = true;
        dateInput.placeholder = 'Loading calendar...';
        container.style.display = 'none';
        slotsDiv.innerHTML = '';
        document.getElementById('selectedStartTime').value = '';
        document.getElementById('selectedEndTime').value = '';

        // Fetch faculty's available days
        const { data: availability, error } = await supabaseClient
            .from('faculty_availability')
            .select('specific_date')
            .eq('faculty_id', facId)
            .gte('specific_date', new Date().toISOString().split('T')[0]);

        if (error || !availability || availability.length === 0) {
            dateInput.placeholder = 'No availability set by faculty';
            return;
        }

        const availableDates = [...new Set(availability.map(a => a.specific_date))]; 

        dateInput.disabled = false;
        dateInput.placeholder = 'Select a date...';

        // Destroy previous flatpickr instance if exists
        if (dateInput._flatpickr) {
            dateInput._flatpickr.destroy();
        }

        // Initialize Flatpickr
        flatpickr(dateInput, {
            minDate: "today",
            enable: availableDates,
            onChange: (selectedDates, dateStr, instance) => {
                this.checkAvailability();
            }
        });
    },

    checkAvailability: async function () {
        const facId = document.getElementById('facultySelect').value;
        const dateVal = document.getElementById('appointmentDate').value;
        const container = document.getElementById('availabilityContainer');
        const slotsDiv = document.getElementById('timeSlotsContainer');

        if (!facId || !dateVal) return;

        container.style.display = 'block';
        slotsDiv.innerHTML = '<div class="col-12 text-center text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Loading availability...</div>';

        // Fetch Faculty Availability for this EXACT date
        const { data: availability, error } = await supabaseClient
            .from('faculty_availability')
            .select('*')
            .eq('faculty_id', facId)
            .eq('specific_date', dateVal);

        // Fetch existing approved/pending appointments for that day
        const { data: existingAppts } = await supabaseClient
            .from('appointments')
            .select('start_time, end_time, status')
            .eq('faculty_id', facId)
            .eq('appointment_date', dateVal)
            .in('status', ['pending', 'approved']);

        if (error || !availability || availability.length === 0) {
            slotsDiv.innerHTML = '<div class="col-12"><div class="alert alert-warning mb-0">Faculty is not available on this day.</div></div>';
            return;
        }

        slotsDiv.innerHTML = '';

        // Generate 30-min slots based on availability
        availability.forEach(avail => {
            let start = new Date(`1970-01-01T${avail.start_time}`);
            const end = new Date(`1970-01-01T${avail.end_time}`);

            while (start < end) {
                let slotStart = start.toTimeString().substring(0, 5);
                start.setMinutes(start.getMinutes() + 30);
                let slotEnd = start.toTimeString().substring(0, 5);

                // Check if slot is taken
                let isTaken = false;
                if (existingAppts) {
                    isTaken = existingAppts.some(appt => {
                        return appt.start_time.substring(0, 5) === slotStart;
                    });
                }

                if (!isTaken && start <= end) {
                    const formatTime = (time) => new Date(`1970-01-01T${time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    slotsDiv.innerHTML += `
                        <div class="col-md-4 col-6">
                            <div class="time-slot" onclick="App.selectTimeSlot('${slotStart}', '${slotEnd}', this)">
                                ${formatTime(slotStart)} - ${formatTime(slotEnd)}
                            </div>
                        </div>
                    `;
                }
            }
        });

        if (slotsDiv.innerHTML === '') {
            slotsDiv.innerHTML = '<div class="col-12"><div class="alert alert-info mb-0">All slots are booked for this day.</div></div>';
        }
    },

    selectTimeSlot: function (start, end, element) {
        document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        document.getElementById('selectedStartTime').value = start;
        document.getElementById('selectedEndTime').value = end;
    },

    handleBooking: async function (e) {
        e.preventDefault();
        const facId = document.getElementById('facultySelect').value;
        const apptDate = document.getElementById('appointmentDate').value;
        const startTime = document.getElementById('selectedStartTime').value;
        const endTime = document.getElementById('selectedEndTime').value;
        const purpose = document.getElementById('purpose').value;
        const btn = document.getElementById('submitBookBtn');

        if (!startTime || !endTime) {
            alert("Please select an available time slot.");
            return;
        }

        btn.innerHTML = 'Booking...';
        btn.disabled = true;

        const { error } = await supabaseClient.from('appointments').insert([
            {
                student_id: this.user.id,
                faculty_id: facId,
                appointment_date: apptDate,
                start_time: startTime + ':00',
                end_time: endTime + ':00',
                purpose: purpose,
                status: 'pending'
            }
        ]);

        btn.innerHTML = 'Submit Request';
        btn.disabled = false;

        if (error) {
            alert("Failed to book: " + error.message);
        } else {
            alert("Appointment request submitted successfully!");
            document.getElementById('bookForm').reset();
            document.getElementById('availabilityContainer').style.display = 'none';
            this.switchView('dashboard');
            this.fetchStudentAppointments();
        }
    },

    fetchStudentAppointments: async function () {
        const { data, error } = await supabaseClient
            .from('appointments')
            .select('*, profiles!appointments_faculty_id_fkey(full_name)')
            .eq('student_id', this.user.id)
            .order('appointment_date', { ascending: false });

        if (error) return;

        let upcoming = 0;
        let pending = 0;
        let completed = 0;

        const tbody = document.getElementById('upcomingTableBody');
        tbody.innerHTML = '';

        data.forEach(appt => {
            if (appt.status === 'approved') upcoming++;
            if (appt.status === 'pending') pending++;
            if (appt.status === 'completed') completed++;

            const badgeClass = `status-${appt.status}`;
            const dateObj = new Date(appt.appointment_date);
            const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

            const formatTime = (time) => new Date(`1970-01-01T${time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            tbody.innerHTML += `
                <tr>
                    <td class="px-4">
                        <div class="d-flex align-items-center">
                            <div class="bg-primary-soft text-primary rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 36px; height: 36px;">
                                <i class="fa-solid fa-user-tie"></i>
                            </div>
                            <span class="fw-medium">${appt.profiles.full_name}</span>
                        </div>
                    </td>
                    <td>
                        <div class="fw-medium">${dateStr}</div>
                        <small class="text-muted">${formatTime(appt.start_time)} - ${formatTime(appt.end_time)}</small>
                    </td>
                    <td class="text-wrap" style="max-width: 200px;">${appt.purpose}</td>
                    <td><span class="badge status-badge ${badgeClass} text-uppercase">${appt.status}</span></td>
                    <td class="text-end px-4">
                        ${appt.status === 'pending' ? `<button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="App.cancelAppointment('${appt.id}')">Cancel</button>` : ''}
                        ${appt.status === 'approved' ? `<a href="https://meet.jit.si/ConsulTime_${appt.id}" target="_blank" class="btn btn-sm btn-primary rounded-pill px-3 shadow-sm"><i class="fa-solid fa-video me-1"></i> Join Call</a>` : ''}
                    </td>
                </tr>
            `;
        });

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No appointments found.</td></tr>';
        }

        document.getElementById('stat-upcoming').textContent = upcoming;
        document.getElementById('stat-pending').textContent = pending;
        document.getElementById('stat-completed').textContent = completed;

        const notifList = document.getElementById('notificationList');
        const notifBadge = document.getElementById('notifBadge');
        if (notifList && notifBadge) {
            const recentUpdates = data.filter(a => a.status !== 'pending');
            if (recentUpdates.length > 0) {
                if (sessionStorage.getItem('notifsViewed') !== 'true') {
                    notifBadge.style.display = 'block';
                    notifBadge.textContent = recentUpdates.length;
                }
                let html = '<li><h6 class="dropdown-header fw-bold">Recent Notifications</h6></li><li><hr class="dropdown-divider"></li>';
                recentUpdates.slice(0, 5).forEach(a => {
                    html += `<li><a class="dropdown-item py-2 border-bottom" href="#" onclick="document.getElementById('nav-dashboard').click()">
                        <div class="fw-bold small text-dark text-capitalize">Appointment ${a.status}</div>
                        <div class="text-muted" style="font-size: 12px;">With ${a.profiles.full_name}</div>
                    </a></li>`;
                });
                notifList.innerHTML = html;
            } else {
                notifBadge.style.display = 'none';
                notifList.innerHTML = '<li><h6 class="dropdown-header fw-bold">Notifications</h6></li><li><hr class="dropdown-divider"></li><li><span class="dropdown-item text-center text-muted small">No new notifications</span></li>';
            }
        }
    },

    cancelAppointment: async function (id) {
        if (confirm("Cancel this appointment request?")) {
            await supabaseClient.from('appointments').update({ status: 'cancelled' }).eq('id', id);
            this.fetchStudentAppointments();
        }
    },

    // --- FACULTY DASHBOARD LOGIC ---
    loadFacultyDashboard: async function () {
        this.fetchFacultyRequests();
        this.fetchFacultyAvailability();
        
        // Init flatpickr for adding availability
        const availDate = document.getElementById('specificDate');
        if (availDate) {
            flatpickr(availDate, {
                minDate: "today"
            });
        }
    },

    fetchFacultyRequests: async function () {
        const { data, error } = await supabaseClient
            .from('appointments')
            .select('*, profiles!appointments_student_id_fkey(full_name, department)')
            .eq('faculty_id', this.user.id)
            .order('appointment_date', { ascending: true });

        if (error) return;

        let pending = 0;
        let today = 0;
        let total = data.length;

        const tbody = document.getElementById('requestsTableBody');
        tbody.innerHTML = '';

        const todayStr = new Date().toISOString().split('T')[0];

        data.forEach(appt => {
            if (appt.status === 'pending') pending++;
            if (appt.appointment_date === todayStr && appt.status === 'approved') today++;

            const badgeClass = `status-${appt.status}`;
            const dateObj = new Date(appt.appointment_date);
            const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

            const formatTime = (time) => new Date(`1970-01-01T${time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            let actions = '';
            if (appt.status === 'pending') {
                actions = `
                    <button class="btn btn-sm btn-success rounded-pill px-3 me-1 shadow-sm" onclick="App.openActionModal('${appt.id}', 'approved')"><i class="fa-solid fa-check"></i></button>
                    <button class="btn btn-sm btn-danger rounded-pill px-3 shadow-sm" onclick="App.openActionModal('${appt.id}', 'rejected')"><i class="fa-solid fa-xmark"></i></button>
                `;
            } else if (appt.status === 'approved') {
                actions = `
                    <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="App.openActionModal('${appt.id}', 'completed')">Mark Done</button>
                    <a href="https://meet.jit.si/ConsulTime_${appt.id}" target="_blank" class="btn btn-sm btn-primary rounded-pill px-3 shadow-sm ms-1"><i class="fa-solid fa-video"></i></a>
                `;
            }

            tbody.innerHTML += `
                <tr>
                    <td class="px-4">
                        <div class="d-flex align-items-center">
                            <div class="bg-accent-soft text-accent rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 36px; height: 36px;">
                                ${appt.profiles.full_name.charAt(0)}
                            </div>
                            <div>
                                <div class="fw-medium text-dark">${appt.profiles.full_name}</div>
                                <div class="small text-muted" style="font-size: 11px;">${appt.profiles.department || 'Student'}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="fw-medium">${dateStr}</div>
                        <small class="text-muted">${formatTime(appt.start_time)} - ${formatTime(appt.end_time)}</small>
                    </td>
                    <td class="text-wrap text-muted small" style="max-width: 200px;">${appt.purpose}</td>
                    <td><span class="badge status-badge ${badgeClass} text-uppercase">${appt.status}</span></td>
                    <td class="text-end px-4">
                        ${actions}
                    </td>
                </tr>
            `;
        });

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No consultation requests yet.</td></tr>';
        }

        document.getElementById('stat-pending').textContent = pending;
        document.getElementById('stat-today').textContent = today;
        document.getElementById('stat-total').textContent = total;

        if (typeof this.renderCharts === 'function') {
            this.renderCharts(data);
        }

        const notifList = document.getElementById('notificationList');
        const notifBadge = document.getElementById('notifBadge');
        if (notifList && notifBadge) {
            const pendingAppts = data.filter(a => a.status === 'pending');
            if (pendingAppts.length > 0) {
                if (sessionStorage.getItem('notifsViewed') !== 'true') {
                    notifBadge.style.display = 'block';
                    notifBadge.textContent = pendingAppts.length;
                }
                let html = '<li><h6 class="dropdown-header fw-bold">Recent Notifications</h6></li><li><hr class="dropdown-divider"></li>';
                pendingAppts.slice(0, 5).forEach(a => {
                    html += `<li><a class="dropdown-item py-2 border-bottom" href="#" onclick="document.getElementById('nav-requests').click()">
                        <div class="fw-bold small text-dark">${a.profiles.full_name}</div>
                        <div class="text-muted" style="font-size: 12px;">Requested a consultation</div>
                    </a></li>`;
                });
                notifList.innerHTML = html;
            } else {
                notifBadge.style.display = 'none';
                notifList.innerHTML = '<li><h6 class="dropdown-header fw-bold">Notifications</h6></li><li><hr class="dropdown-divider"></li><li><span class="dropdown-item text-center text-muted small">No new notifications</span></li>';
            }
        }
    },

    openActionModal: function (id, type) {
        document.getElementById('actionApptId').value = id;
        document.getElementById('actionType').value = type;

        let title = '';
        let desc = '';
        if (type === 'approved') { title = 'Approve Request'; desc = 'This will notify the student that the consultation is confirmed.'; }
        if (type === 'rejected') { title = 'Reject Request'; desc = 'Please provide a reason in the notes if possible.'; }
        if (type === 'completed') { title = 'Complete Consultation'; desc = 'Mark this consultation as successfully completed.'; }

        document.getElementById('actionModalTitle').textContent = title;
        document.getElementById('actionModalDesc').textContent = desc;
        document.getElementById('actionNotes').value = '';

        const modal = new bootstrap.Modal(document.getElementById('actionModal'));
        modal.show();

        document.getElementById('confirmActionBtn').onclick = async () => {
            const notes = document.getElementById('actionNotes').value;
            await supabaseClient.from('appointments').update({
                status: type,
                faculty_notes: notes
            }).eq('id', id);

            modal.hide();
            this.fetchFacultyRequests();
        };
    },

    handleAddAvailability: async function (e) {
        e.preventDefault();
        const dateVal = document.getElementById('specificDate').value;
        const start = document.getElementById('availStartTime').value;
        const end = document.getElementById('availEndTime').value;

        if (!dateVal) {
            alert("Please select a date.");
            return;
        }

        if (start >= end) {
            alert("Start time must be before end time.");
            return;
        }

        const { error } = await supabaseClient.from('faculty_availability').insert([
            {
                faculty_id: this.user.id,
                specific_date: dateVal,
                start_time: start + ':00',
                end_time: end + ':00'
            }
        ]);

        if (error) alert(error.message);
        else {
            document.getElementById('availabilityForm').reset();
            this.fetchFacultyAvailability();
        }
    },

    fetchFacultyAvailability: async function () {
        const { data, error } = await supabaseClient
            .from('faculty_availability')
            .select('*')
            .eq('faculty_id', this.user.id)
            .order('specific_date', { ascending: true })
            .order('start_time', { ascending: true });

        if (error) return;

        const tbody = document.getElementById('availabilityTableBody');
        tbody.innerHTML = '';

        // Filter out past dates (optional but recommended)
        const todayStr = new Date().toISOString().split('T')[0];
        const validData = data.filter(a => a.specific_date >= todayStr);

        validData.forEach(avail => {
            const formatTime = (time) => new Date(`1970-01-01T${time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const dateObj = new Date(avail.specific_date);
            const exactDateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', weekday: 'long' });

            tbody.innerHTML += `
                <tr>
                    <td>
                        <div class="fw-medium text-dark">${exactDateStr}</div>
                    </td>
                    <td>${formatTime(avail.start_time)} - ${formatTime(avail.end_time)}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="App.deleteAvailability('${avail.id}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        if (validData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-muted">No availability set. Students cannot book appointments.</td></tr>';
        }
    },

    deleteAvailability: async function (id) {
        if (confirm("Delete this availability slot?")) {
            await supabaseClient.from('faculty_availability').delete().eq('id', id);
            this.fetchFacultyAvailability();
        }
    },

    renderCharts: function(data) {
        if (!window.Chart) return;

        const isDark = document.body.classList.contains('dark-mode');
        Chart.defaults.color = isDark ? '#cbd5e1' : '#6b7280';
        Chart.defaults.borderColor = isDark ? '#334155' : '#e5e7eb';
        
        // Status Chart
        let pending = 0, approved = 0, completed = 0;
        data.forEach(a => {
            if (a.status === 'pending') pending++;
            if (a.status === 'approved') approved++;
            if (a.status === 'completed') completed++;
        });

        const ctxStatus = document.getElementById('statusChart');
        if (ctxStatus) {
            if (this.charts.status) this.charts.status.destroy();
            this.charts.status = new Chart(ctxStatus, {
                type: 'doughnut',
                data: {
                    labels: ['Pending', 'Approved', 'Completed'],
                    datasets: [{
                        data: [pending, approved, completed],
                        backgroundColor: ['#f59e0b', '#10b981', '#3b82f6'],
                        borderWidth: 0
                    }]
                },
                options: { plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#f8fafc' : '#1f2937' } } }, cutout: '70%' }
            });
        }

        // Weekly Chart (Past 7 days)
        const days = [];
        const counts = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            days.push(d.toLocaleDateString([], { weekday: 'short' }));
            counts.push(data.filter(a => a.appointment_date === dateStr).length);
        }

        const ctxWeekly = document.getElementById('weeklyChart');
        if (ctxWeekly) {
            if (this.charts.weekly) this.charts.weekly.destroy();
            this.charts.weekly = new Chart(ctxWeekly, {
                type: 'bar',
                data: {
                    labels: days,
                    datasets: [{
                        label: 'Consultations',
                        data: counts,
                        backgroundColor: '#3b82f6',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { 
                        y: { beginAtZero: true, ticks: { stepSize: 1, color: isDark ? '#94a3b8' : '#6b7280' }, grid: { color: isDark ? '#334155' : '#e5e7eb' } },
                        x: { ticks: { color: isDark ? '#94a3b8' : '#6b7280' }, grid: { color: isDark ? '#334155' : '#e5e7eb' } }
                    },
                    plugins: { legend: { labels: { color: isDark ? '#f8fafc' : '#1f2937' } } }
                }
            });
        }
    },

    initRealtime: function() {
        if (!supabaseClient || !this.user) return;
        
        supabaseClient.channel('custom-all-channel')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'appointments' },
            (payload) => {
                const appt = payload.new;
                
                // If I am faculty and someone booked me
                if (this.profile.role === 'faculty' && appt.faculty_id === this.user.id && payload.eventType === 'INSERT') {
                    sessionStorage.removeItem('notifsViewed');
                    this.showToast('New Appointment Request!', 'A student just booked a consultation.', 'success');
                    this.fetchFacultyRequests();
                }
                
                // If I am student and my booking was updated
                if (this.profile.role === 'student' && appt.student_id === this.user.id && payload.eventType === 'UPDATE') {
                    sessionStorage.removeItem('notifsViewed');
                    this.showToast('Status Updated!', 'Your appointment is now ' + appt.status + '.', 'info');
                    this.fetchStudentAppointments();
                }
            }
        )
        .subscribe();
    },

    showToast: function(title, message, type='primary') {
        this.playNotificationSound();
        if (!document.getElementById('toastContainer')) {
            document.body.insertAdjacentHTML('beforeend', '<div id="toastContainer" class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 1055;"></div>');
        }
        
        const toastId = 'toast' + Date.now();
        const html = `
            <div id="${toastId}" class="toast align-items-center text-bg-${type} border-0 show shadow-lg" role="alert" aria-live="assertive" aria-atomic="true">
              <div class="d-flex">
                <div class="toast-body fw-medium">
                  <strong>${title}</strong><br><small>${message}</small>
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="document.getElementById('${toastId}').remove()"></button>
              </div>
            </div>
        `;
        document.getElementById('toastContainer').insertAdjacentHTML('beforeend', html);
        
        setTimeout(() => {
            const t = document.getElementById(toastId);
            if (t) t.remove();
        }, 5000);
    },

    playNotificationSound: function() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            // Premium "Ding" sound (soft bell)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // Up to A6
            
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.error("Audio play failed:", e);
        }
    },

    initChatbot: function() {
        if (document.getElementById('chatbotToggle')) return;
        const html = `
            <!-- Chatbot Toggle Button -->
            <button class="btn btn-primary rounded-circle shadow-lg d-flex justify-content-center align-items-center" 
                    id="chatbotToggle" 
                    style="position: fixed; bottom: 30px; right: 30px; width: 65px; height: 65px; z-index: 1050; border: 4px solid white; transition: transform 0.2s;"
                    onclick="App.toggleChatbot()"
                    onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                <i class="fa-solid fa-robot fs-3"></i>
            </button>

            <!-- Chatbot Window -->
            <div class="card shadow-lg d-none flex-column border-0" id="chatbotWindow" style="position: fixed; bottom: 110px; right: 30px; width: 360px; height: 500px; z-index: 1050; border-radius: 16px; overflow: hidden;">
                <div class="bg-primary text-white p-3 d-flex justify-content-between align-items-center shadow-sm" style="z-index: 2;">
                    <div class="fw-bold d-flex align-items-center gap-2 fs-5">
                        <div class="bg-white text-primary rounded-circle d-flex justify-content-center align-items-center" style="width: 32px; height: 32px;"><i class="fa-solid fa-robot"></i></div>
                        ConsulTime Assistant
                    </div>
                    <button class="btn-close btn-close-white" onclick="App.toggleChatbot()"></button>
                </div>
                <div class="card-body p-3 flex-grow-1 overflow-auto d-flex flex-column gap-3" id="chatbotMessages" style="background-color: #f8fafc;">
                    <div class="d-flex gap-2">
                        <div class="bg-primary text-white rounded-circle d-flex justify-content-center align-items-center flex-shrink-0 mt-1" style="width: 35px; height: 35px; font-size: 14px;"><i class="fa-solid fa-robot"></i></div>
                        <div class="bg-white border p-3 rounded-4 text-dark small shadow-sm" style="border-top-left-radius: 4px !important;">
                            Hi there! 👋 I'm the ConsulTime Assistant. How can I help you schedule your consultations today?
                        </div>
                    </div>
                </div>
                <div class="p-3 border-top bg-white" id="chatbotOptionsContainer">
                    <p class="text-muted small mb-2 fw-medium">Suggested Questions:</p>
                    <div class="d-flex flex-wrap gap-2" id="chatbotOptions">
                        <button class="btn btn-sm btn-outline-primary rounded-pill flex-grow-1 fw-medium" onclick="App.sendChatMessage('How do I book?')">How do I book?</button>
                        <button class="btn btn-sm btn-outline-primary rounded-pill flex-grow-1 fw-medium" onclick="App.sendChatMessage('Where is the video link?')">Where is the video link?</button>
                        <button class="btn btn-sm btn-outline-primary rounded-pill flex-grow-1 fw-medium" onclick="App.sendChatMessage('Can I cancel?')">Can I cancel?</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    toggleChatbot: function() {
        const chatWindow = document.getElementById('chatbotWindow');
        const isHidden = chatWindow.classList.contains('d-none');
        
        if (isHidden) {
            chatWindow.classList.remove('d-none');
            chatWindow.classList.add('d-flex');
            chatWindow.style.animation = 'slideUp 0.3s ease-out';
        } else {
            chatWindow.classList.add('d-none');
            chatWindow.classList.remove('d-flex');
        }
    },

    sendChatMessage: function(msg) {
        const msgContainer = document.getElementById('chatbotMessages');
        
        // Add User Message
        msgContainer.insertAdjacentHTML('beforeend', `
            <div class="d-flex gap-2 justify-content-end mb-1">
                <div class="bg-primary text-white p-3 rounded-4 small shadow-sm" style="border-top-right-radius: 4px !important;">
                    ${msg}
                </div>
            </div>
        `);
        msgContainer.scrollTop = msgContainer.scrollHeight;

        // Disable options
        document.getElementById('chatbotOptions').style.opacity = '0.5';
        document.getElementById('chatbotOptions').style.pointerEvents = 'none';

        // Add Typing Indicator
        const typingId = 'typing' + Date.now();
        msgContainer.insertAdjacentHTML('beforeend', `
            <div class="d-flex gap-2" id="${typingId}">
                <div class="bg-primary text-white rounded-circle d-flex justify-content-center align-items-center flex-shrink-0 mt-1" style="width: 35px; height: 35px; font-size: 14px;"><i class="fa-solid fa-robot"></i></div>
                <div class="bg-white border p-3 rounded-4 text-muted small shadow-sm d-flex align-items-center gap-1" style="border-top-left-radius: 4px !important;">
                    <span class="spinner-grow spinner-grow-sm text-primary" style="width: 6px; height: 6px; animation-delay: 0s;"></span>
                    <span class="spinner-grow spinner-grow-sm text-primary" style="width: 6px; height: 6px; animation-delay: 0.2s;"></span>
                    <span class="spinner-grow spinner-grow-sm text-primary" style="width: 6px; height: 6px; animation-delay: 0.4s;"></span>
                </div>
            </div>
        `);
        msgContainer.scrollTop = msgContainer.scrollHeight;

        // Simulate network delay and reply
        setTimeout(() => {
            document.getElementById(typingId).remove();
            
            let reply = "I'm sorry, I don't understand that request.";
            if (msg === 'How do I book?') reply = "It's easy! Click the green **New Appointment** button on your dashboard. Select your department, choose a Faculty member, pick an available date and time, and type your purpose. The faculty will review it shortly!";
            if (msg === 'Where is the video link?') reply = "Once your professor approves your request, a blue **Join Call** button will automatically appear next to your schedule. Just click it to enter the video room!";
            if (msg === 'Can I cancel?') reply = "Yes! As long as your appointment status is still **Pending**, you can click the red **Cancel** button on your dashboard to withdraw your request.";

            msgContainer.insertAdjacentHTML('beforeend', `
                <div class="d-flex gap-2 mb-1">
                    <div class="bg-primary text-white rounded-circle d-flex justify-content-center align-items-center flex-shrink-0 mt-1" style="width: 35px; height: 35px; font-size: 14px;"><i class="fa-solid fa-robot"></i></div>
                    <div class="bg-white border p-3 rounded-4 text-dark small shadow-sm" style="border-top-left-radius: 4px !important; line-height: 1.5;">
                        ${reply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
                    </div>
                </div>
            `);
            msgContainer.scrollTop = msgContainer.scrollHeight;

            document.getElementById('chatbotOptions').style.opacity = '1';
            document.getElementById('chatbotOptions').style.pointerEvents = 'auto';

        }, 1200);
    }
};

// Add keyframes animation for chatbot
document.head.insertAdjacentHTML('beforeend', '<style>@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }</style>');

document.addEventListener('DOMContentLoaded', () => App.init());
