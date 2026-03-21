// ===== SUSTAINABLE WASTE MANAGEMENT SYSTEM - VUE APPLICATION =====
// Using Firebase Realtime Database — NO authentication

import {
    db,
    ref, set, push, update, remove,
    onValue, get, child,
    query, orderByChild, equalTo
} from './firebase.js';

import { createApp, ref as vueRef, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

const ROLES = { RESIDENT: 'resident', ADMIN: 'admin', COLLECTOR: 'collector' };

// Helper to generate unique IDs (replaces Firebase Auth UID)
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

createApp({
    setup() {
        const currentView = vueRef('home');
        const adminSubView = vueRef('users');
        const userSearchQuery = vueRef('');
        const loginRole = vueRef('');
        const loginData = vueRef({ username: '', password: '' });
        const signupData = vueRef({ username: '', fullName: '', email: '', address: '', password: '' });
        const currentUser = vueRef(null);
        const showAboutModal = vueRef(false);
        const showHistoryModal = vueRef(false);
        const selectedUser = vueRef(null);
        const userHistory = vueRef([]);

        const isSigningIn = vueRef(false);
        const isSigningUp = vueRef(false);
        const notifications = vueRef([]);

        const residents = vueRef([]);
        const collectors = vueRef([
            { username: 'sanchez', password: 'sanchez' },
            { username: 'reyes', password: 'reyes' },
            { username: 'molo', password: 'molo' }
        ]);
        const allRequests = vueRef([]);
        const schedules = vueRef([]);

        const newComplaint = vueRef({ description: '', type: 'General Waste' });
        const newSched = vueRef({ day: 'Monday', area: '', time: '08:00 - 12:00' });
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        // ===== NOTIFICATIONS =====
        const addNotify = (message, type = 'success') => {
            const id = Date.now();
            notifications.value.push({ id, message, type });
            setTimeout(() => removeNotification(id), 6000);
        };
        const removeNotification = (id) => notifications.value = notifications.value.filter(n => n.id !== id);

        // ===== LIFECYCLE =====
        onMounted(() => {
            // Restore session from localStorage
            const localUser = localStorage.getItem('eco_waste_session');
            if (localUser) {
                const parsed = JSON.parse(localUser);
                currentUser.value = parsed;
                updateViewByRole(parsed.role);
            }

            setupRealtime();
        });

        // ===== REALTIME LISTENERS =====
        const setupRealtime = () => {
            // Listen for schedules
            onValue(ref(db, 'schedules'), (snapshot) => {
                const data = snapshot.val();
                schedules.value = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
            });

            // Listen for requests
            onValue(ref(db, 'requests'), (snapshot) => {
                const data = snapshot.val();
                allRequests.value = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
            });

            // Listen for profiles (filter to residents only)
            onValue(ref(db, 'profiles'), (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    residents.value = Object.entries(data)
                        .map(([id, val]) => ({ id, ...val }))
                        .filter(p => p.role === ROLES.RESIDENT);
                } else {
                    residents.value = [];
                }
            });
        };

        // ===== AUTH & NAVIGATION =====
        const selectRole = (role) => { loginRole.value = role; currentView.value = 'login_form'; };
        const updateViewByRole = (role) => {
            if (role === ROLES.ADMIN) currentView.value = 'admin_dashboard';
            else if (role === ROLES.RESIDENT) currentView.value = 'resident_dashboard';
            else if (role === ROLES.COLLECTOR) currentView.value = 'collector_dashboard';
        };

        const handleLogin = async () => {
            isSigningIn.value = true;
            const { username, password } = loginData.value;

            if (loginRole.value === ROLES.ADMIN && username === 'admin' && password === 'admin') {
                finalizeLogin({ username: 'Admin', fullName: 'Administrator', role: ROLES.ADMIN, uid: 'admin' });
                addNotify('Administrator Access Granted');
            } else if (loginRole.value === ROLES.COLLECTOR) {
                const coll = collectors.value.find(c => c.username === username && c.password === password);
                if (coll) {
                    finalizeLogin({ username: coll.username, fullName: 'Collector Node ' + coll.username, role: ROLES.COLLECTOR, uid: 'collector-' + coll.username });
                } else {
                    addNotify('Identification failed', 'error');
                }
            } else if (loginRole.value === ROLES.RESIDENT) {
                try {
                    // Read all profiles and find matching username
                    const snapshot = await get(ref(db, 'profiles'));
                    const data = snapshot.val();
                    if (data) {
                        const match = Object.entries(data).find(([id, val]) => val.username === username);
                        if (match) {
                            const [profileId, userData] = match;
                            if (userData.password === password) {
                                if (userData.blocked) {
                                    addNotify('Account Access Suspended', 'error');
                                    isSigningIn.value = false;
                                    return;
                                }
                                finalizeLogin({ ...userData, uid: profileId });
                                addNotify(`Welcome, ${userData.fullName}`);
                            } else {
                                addNotify('Invalid password', 'error');
                            }
                        } else {
                            addNotify('Identity not found', 'error');
                        }
                    } else {
                        addNotify('Identity not found', 'error');
                    }
                } catch (e) {
                    addNotify('Connection Timeout', 'error');
                    console.error(e);
                }
            }
            isSigningIn.value = false;
        };

        const finalizeLogin = (user) => {
            currentUser.value = user;
            localStorage.setItem('eco_waste_session', JSON.stringify(currentUser.value));
            updateViewByRole(user.role);
        };

        const handleSignup = async () => {
            if (isSigningUp.value) return;
            isSigningUp.value = true;
            const { username, fullName, email, address, password } = signupData.value;

            try {
                // Check for existing username or email
                const snapshot = await get(ref(db, 'profiles'));
                const data = snapshot.val();
                if (data) {
                    const existing = Object.values(data).find(p => p.username === username || p.email === email);
                    if (existing) {
                        addNotify("Identity collision: Account already registered", "error");
                        isSigningUp.value = false;
                        return;
                    }
                }

                const uid = generateId();
                const newProfile = {
                    uid, username, fullName, email, address, password,
                    role: ROLES.RESIDENT, blocked: false, created: new Date().toISOString()
                };

                await set(ref(db, 'profiles/' + uid), newProfile);
                addNotify("Account deployed! Node indexed in database.", "success");

                setTimeout(() => {
                    signupData.value = { username: '', fullName: '', email: '', address: '', password: '' };
                    currentView.value = 'login_choice';
                }, 2000);
            } catch (e) {
                addNotify("Signup failure: Check database settings", "error");
                console.error(e);
            }
            isSigningUp.value = false;
        };

        const logout = () => {
            localStorage.removeItem('eco_waste_session');
            currentUser.value = null;
            currentView.value = 'home';
            addNotify("Safe sign-out complete");
        };

        // ===== CRUD OPERATIONS =====
        const submitComplaint = async () => {
            if (!currentUser.value) return;
            const newReqRef = push(ref(db, 'requests'));
            await set(newReqRef, {
                uid: currentUser.value.uid,
                username: currentUser.value.username,
                fullName: currentUser.value.fullName,
                description: newComplaint.value.description,
                type: newComplaint.value.type,
                status: 'Pending',
                collector: '',
                timestamp: new Date().toISOString()
            });
            newComplaint.value = { description: '', type: 'General Waste' };
            addNotify("Pickup request synchronized");
        };

        const createSchedule = async () => {
            const newSchedRef = push(ref(db, 'schedules'));
            await set(newSchedRef, { ...newSched.value });
            newSched.value = { day: 'Monday', area: '', time: '08:00 - 12:00' };
            addNotify("Route established");
        };

        const deleteSchedule = async (id) => {
            await remove(ref(db, 'schedules/' + id));
            addNotify("Route purged");
        };

        const toggleBlock = async (id, status) => {
            await update(ref(db, 'profiles/' + id), { blocked: status });
            addNotify(status ? "Access restricted" : "Access reinstated");
        };

        const deleteUser = async (id, name) => {
            if (confirm(`Purge account: ${name}?`)) {
                await remove(ref(db, 'profiles/' + id));
                addNotify("Identity purged");
            }
        };

        const deleteRequest = async (id) => {
            await remove(ref(db, 'requests/' + id));
            addNotify("Task cleared");
        };

        const updateReqStatus = async (id, status) => {
            await update(ref(db, 'requests/' + id), { status });
            addNotify(`Phase: ${status}`);
        };

        const assignCollector = async (id, name) => {
            await update(ref(db, 'requests/' + id), { collector: name });
            addNotify(name ? `Node assigned to ${name}` : 'Unassigned');
        };

        const viewUserHistory = (user) => {
            selectedUser.value = user;
            userHistory.value = allRequests.value.filter(r => r.uid === user.uid);
            showHistoryModal.value = true;
        };

        // ===== COMPUTED =====
        const filteredResidents = computed(() => {
            if (!userSearchQuery.value) return residents.value;
            const q = userSearchQuery.value.toLowerCase();
            return residents.value.filter(r => r.fullName.toLowerCase().includes(q) || r.username.toLowerCase().includes(q));
        });

        const myRequests = computed(() => {
            if (!currentUser.value) return [];
            return allRequests.value
                .filter(r => r.uid === currentUser.value.uid)
                .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        });

        const myTasks = computed(() => currentUser.value ? allRequests.value.filter(r => r.collector === currentUser.value.username) : []);
        const getReportCount = (uid) => allRequests.value.filter(r => r.uid === uid).length;

        // ===== HELPERS =====
        const formatDate = (ts) => {
            if (!ts) return 'INDEXING...';
            // Handle ISO string timestamps (Realtime Database)
            const date = new Date(ts);
            return isNaN(date.getTime()) ? 'INDEXING...' : date.toLocaleString();
        };

        const getStatusClass = (s) => ({
            'bg-orange-500': s === 'Pending',
            'bg-blue-500': s === 'Approved',
            'bg-indigo-500': s === 'In Progress',
            'bg-emerald-500': s === 'Collected'
        }[s] || 'bg-slate-400');

        return {
            currentView, adminSubView, userSearchQuery, loginRole, loginData, signupData, currentUser, notifications,
            residents, collectors, allRequests, schedules, myRequests, myTasks, filteredResidents,
            newComplaint, newSched, days, showHistoryModal, selectedUser, userHistory, showAboutModal,
            isSigningIn, isSigningUp,
            selectRole, handleLogin, handleSignup, logout, submitComplaint, deleteRequest,
            createSchedule, deleteSchedule, toggleBlock, deleteUser, viewUserHistory, updateReqStatus, assignCollector,
            formatDate, getStatusClass, getReportCount, removeNotification
        }
    }
}).mount('#app');
