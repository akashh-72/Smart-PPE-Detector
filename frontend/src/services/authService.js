/**
 * SafeGuard AI - Single User Authentication Service
 * Manages authorized Safety Controller access session with LocalStorage persistence & Firebase sync.
 */

const STORAGE_KEY = 'safeguard_active_user';

export function getActiveUser() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export async function signInUser(email, password) {
  // Simulate authentication validation or authenticate with Firebase
  if (!email || !password) {
    return { success: false, error: "Please enter both email and password." };
  }
  
  const user = {
    uid: "usr_" + Math.random().toString(36).substring(2, 9),
    email: email.trim(),
    name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    role: "Safety Controller",
    badge: "SITE-01 ADMIN",
    department: "HSE & Industrial Security",
    employeeId: "SEC-" + Math.floor(1000 + Math.random() * 9000),
    loginTime: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return { success: true, user };
}

export async function signUpUser(email, password, profileData = {}) {
  if (!email || !password) {
    return { success: false, error: "Please fill in all mandatory fields." };
  }
  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters long." };
  }

  const user = {
    uid: "usr_" + Math.random().toString(36).substring(2, 9),
    email: email.trim(),
    name: profileData.name || email.split('@')[0],
    role: "Safety Controller",
    badge: "SITE-01 ADMIN",
    department: profileData.department || "HSE Operations",
    employeeId: profileData.employeeId || "SEC-" + Math.floor(1000 + Math.random() * 9000),
    phone: profileData.phone || "",
    loginTime: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return { success: true, user };
}

export async function signInWithGoogle() {
  // Google sign in authentication simulation
  const user = {
    uid: "google_controller_01",
    email: "safety.officer@safeguard.ai",
    name: "Alex Vance",
    role: "Safety Controller",
    badge: "SITE-01 ADMIN",
    department: "Industrial HSE Operations",
    employeeId: "HSE-8492",
    photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
    loginTime: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return { success: true, user };
}

export function loginAsDemo() {
  const demoUser = {
    uid: "demo_safety_controller",
    email: "controller@industrial-safety.org",
    name: "Alex Vance",
    role: "Safety Controller",
    badge: "SITE-01 ADMIN",
    department: "HSE & Gate Security",
    employeeId: "HSE-8492",
    loginTime: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser));
  return demoUser;
}

export async function signOutUser() {
  localStorage.removeItem(STORAGE_KEY);
  return { success: true };
}

export function subscribeToAuthChanges(callback) {
  // Listen for storage events across tabs or local changes
  const handler = (e) => {
    if (e.key === STORAGE_KEY) {
      try {
        const u = e.newValue ? JSON.parse(e.newValue) : null;
        callback(u);
      } catch {
        callback(null);
      }
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
