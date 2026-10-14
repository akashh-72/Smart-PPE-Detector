/**
 * SafeGuard AI - Firebase Realtime Database & Authentication Service
 * Connects directly to Firebase Project: ppe-detector-c3835
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  update,
  remove,
  get,
  child,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Official Firebase configuration provided for ppe-detector-c3835
export const firebaseConfig = {
  apiKey: "AIzaSyB2WHY2BlNODgMABHErbER5NuB9CKGgsHc",
  authDomain: "ppe-detector-c3835.firebaseapp.com",
  databaseURL: "https://ppe-detector-c3835-default-rtdb.firebaseio.com",
  projectId: "ppe-detector-c3835",
  storageBucket: "ppe-detector-c3835.firebasestorage.app",
  messagingSenderId: "401231291518",
  appId: "1:401231291518:web:0197cc627ea5c1b9efe42f",
};

// Initialize Firebase App, Auth and Realtime Database
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

console.log("[Firebase Engine] Initialized Firebase RTDB & Auth with project:", firebaseConfig.projectId);

class FirebaseService {
  constructor() {
    this.app = app;
    this.auth = auth;
    this.db = db;
    this.currentUser = null;
    this.userProfile = null;
    this.isConnected = false;
    this.isReady = true;

    // Track active connection state
    this.initConnectionMonitor();
  }

  /* --------------------------------------------------------------------------
     CONNECTION MONITOR
     -------------------------------------------------------------------------- */
  initConnectionMonitor() {
    const connectedRef = ref(this.db, ".info/connected");
    onValue(connectedRef, (snap) => {
      this.isConnected = snap.val() === true;
      const statusDot = document.getElementById("firebaseStatusDot");
      const statusText = document.getElementById("firebaseStatusText");
      if (statusDot) {
        statusDot.className = this.isConnected ? "pulsing-dot green" : "pulsing-dot red";
      }
      if (statusText) {
        statusText.textContent = this.isConnected ? "Firebase Live" : "Offline / Syncing";
      }
      const popoverFbDot = document.getElementById("popoverFbDot");
      const popoverFbText = document.getElementById("popoverFbText");
      if (popoverFbDot) {
        popoverFbDot.className = this.isConnected ? "item-dot green" : "item-dot amber";
      }
      if (popoverFbText) {
        popoverFbText.textContent = this.isConnected ? "Connected (RTDB)" : "Reconnecting...";
      }
    });
  }

  /* --------------------------------------------------------------------------
     AUTHENTICATION METHODS
     -------------------------------------------------------------------------- */

  /**
   * Listen to Firebase auth state changes.
   */
  onAuthStateChange(callback) {
    return onAuthStateChanged(this.auth, async (user) => {
      this.currentUser = user;
      if (user) {
        // Fetch or create profile in RTDB
        try {
          const userRef = ref(this.db, `users/${user.uid}`);
          const snap = await get(userRef);
          if (snap.exists()) {
            this.userProfile = snap.val();
          } else {
            // Build fallback profile
            const name = user.displayName || user.email.split("@")[0].replace(".", " ").toUpperCase();
            this.userProfile = {
              uid: user.uid,
              name: name,
              email: user.email,
              role: "Safety Officer",
              avatar: name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "SO",
              bg: "#f97316",
              lastLogin: new Date().toISOString(),
            };
            await set(userRef, this.userProfile);
          }
        } catch (err) {
          console.warn("[Firebase Auth] Failed to fetch user profile, using fallback:", err);
          this.userProfile = {
            uid: user.uid,
            name: user.displayName || user.email.split("@")[0],
            email: user.email,
            role: "Safety Officer",
            avatar: "US",
            bg: "#f97316",
          };
        }
      } else {
        this.userProfile = null;
      }
      callback(user, this.userProfile);
    });
  }

  /**
   * Sign in with Email and Password.
   */
  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email.trim(), password);
      return userCredential.user;
    } catch (error) {
      console.error("[Firebase Auth Error] Sign in failed:", error);
      throw this.formatAuthError(error);
    }
  }

  /**
   * Sign up a new user with Email, Password and Role metadata.
   */
  async signUp(email, password, displayName, role = "Safety Officer", department = "Operations") {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email.trim(), password);
      const user = userCredential.user;

      // Update auth profile
      await updateProfile(user, { displayName });

      // Generate avatar initials and palette color
      const initials = displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "US";

      const palette = ["#f97316", "#16a34a", "#2563eb", "#9333ea", "#0891b2", "#ea580c"];
      const bg = palette[Math.floor(Math.random() * palette.length)];

      const profile = {
        uid: user.uid,
        name: displayName,
        email: user.email,
        role: role || "Safety Officer",
        department: department || "Operations",
        avatar: initials,
        bg: bg,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };

      // Persist profile to Realtime Database
      await set(ref(this.db, `users/${user.uid}`), profile);
      this.userProfile = profile;

      return user;
    } catch (error) {
      console.error("[Firebase Auth Error] Sign up failed:", error);
      throw this.formatAuthError(error);
    }
  }

  /**
   * Sign out the active user.
   */
  async signOut() {
    try {
      await signOut(this.auth);
      this.currentUser = null;
      this.userProfile = null;
    } catch (error) {
      console.error("[Firebase Auth Error] Sign out failed:", error);
      throw error;
    }
  }

  formatAuthError(error) {
    const code = error.code || "";
    if (code.includes("user-not-found")) return new Error("No account found with this work email.");
    if (code.includes("wrong-password") || code.includes("invalid-credential") || code.includes("INVALID_LOGIN_CREDENTIALS")) {
      return new Error("Invalid email or password. Please verify credentials.");
    }
    if (code.includes("email-already-in-use")) return new Error("An account with this email address already exists.");
    if (code.includes("weak-password")) return new Error("Password is too weak. Please use at least 6 characters.");
    if (code.includes("invalid-email")) return new Error("Invalid email format entered.");
    return new Error(error.message || "Authentication request failed.");
  }

  /* --------------------------------------------------------------------------
     REALTIME ACCESS LOGS & SCAN AUDIT LEDGER
     -------------------------------------------------------------------------- */

  /**
   * Subscribe to live access logs stream.
   */
  subscribeLogs(callback) {
    const logsRef = ref(this.db, "access_logs");
    return onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }
      // Convert map to array and sort descending by timestamp / id
      const logsList = Object.keys(data).map((key) => {
        const item = data[key];
        return {
          ...item,
          firebaseKey: key,
          id: item.id || key,
        };
      });
      logsList.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime() || 0;
        const timeB = new Date(b.timestamp).getTime() || 0;
        return timeB - timeA;
      });
      callback(logsList);
    });
  }

  /**
   * Push a new access verification scan log into Firebase RTDB.
   */
  async pushScanLog(log) {
    try {
      const logsRef = ref(this.db, "access_logs");
      const newLogRef = push(logsRef);
      const logData = {
        id: log.id || Math.floor(1000 + Math.random() * 9000),
        timestamp: log.timestamp || new Date().toISOString().replace("T", " ").slice(0, 19),
        status: log.status,
        compliance_percentage: Math.round(log.compliance_percentage || 0),
        average_confidence: Math.round(log.average_confidence || 0),
        inference_time_ms: Math.round(log.inference_time_ms || 40),
        compliant_items: log.compliant_items || [],
        missing_items: log.missing_items || [],
        image_filename: log.image_filename || "",
        worker_name: this.userProfile?.name || "Terminal Worker",
        worker_id: this.userProfile?.role || "GUEST",
        created_at: Date.now(),
      };
      await set(newLogRef, logData);
      return { firebaseKey: newLogRef.key, ...logData };
    } catch (e) {
      console.error("[Firebase RTDB] Failed pushing log:", e);
    }
  }

  /**
   * Clear all access logs in Firebase RTDB.
   */
  async clearLogs() {
    try {
      await remove(ref(this.db, "access_logs"));
    } catch (e) {
      console.error("[Firebase RTDB] Failed clearing logs:", e);
    }
  }

  /* --------------------------------------------------------------------------
     REALTIME STAFF DIRECTORY MODULE
     -------------------------------------------------------------------------- */

  /**
   * Subscribe to live staff directory changes.
   */
  subscribeStaff(callback) {
    const staffRef = ref(this.db, "staff");
    return onValue(staffRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }
      const list = Object.keys(data).map((key) => {
        const item = data[key];
        return {
          ...item,
          firebaseKey: key,
          id: item.id || key,
        };
      });
      callback(list);
    });
  }

  /**
   * Add a new staff member to Firebase RTDB.
   */
  async addStaff(staffData) {
    try {
      const staffRef = ref(this.db, "staff");
      const newStaffRef = push(staffRef);
      const payload = {
        id: newStaffRef.key,
        name: staffData.name,
        employee_id: staffData.employee_id,
        department: staffData.department,
        role: staffData.role,
        required_ppe: staffData.required_ppe || ["helmet", "vest"],
        status: staffData.status || "ACTIVE",
        compliance_score: staffData.compliance_score || 100.0,
        last_access: staffData.last_access || "Just Enrolled",
        avatar_bg: staffData.avatar_bg || "#f97316",
        created_at: Date.now(),
      };
      await set(newStaffRef, payload);
      return payload;
    } catch (e) {
      console.error("[Firebase RTDB] Failed adding staff member:", e);
      throw e;
    }
  }

  /**
   * Toggle staff status ("ACTIVE" <-> "RESTRICTED").
   */
  async toggleStaffStatus(staffId, newStatus) {
    try {
      const staffMemberRef = ref(this.db, `staff/${staffId}`);
      await update(staffMemberRef, { status: newStatus });
    } catch (e) {
      console.error("[Firebase RTDB] Failed toggling staff status:", e);
    }
  }

  /**
   * Delete staff member from Firebase RTDB.
   */
  async deleteStaff(staffId) {
    try {
      await remove(ref(this.db, `staff/${staffId}`));
    } catch (e) {
      console.error("[Firebase RTDB] Failed deleting staff member:", e);
    }
  }

  /* --------------------------------------------------------------------------
     REALTIME HARDWARE DIGITAL TWIN STATE
     -------------------------------------------------------------------------- */

  /**
   * Subscribe to live hardware twin state (Gate arm, LEDs, buzzer, LCD).
   */
  subscribeHardware(callback) {
    const hwRef = ref(this.db, "hardware");
    return onValue(hwRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        callback(data);
      }
    });
  }

  /**
   * Update hardware twin state in Firebase RTDB.
   */
  async updateHardware(state) {
    try {
      const hwRef = ref(this.db, "hardware");
      await update(hwRef, {
        ...state,
        updated_at: Date.now(),
      });
    } catch (e) {
      console.warn("[Firebase RTDB] Hardware update warning:", e);
    }
  }

  /* --------------------------------------------------------------------------
     SYSTEM SETTINGS & CONFIGURATION
     -------------------------------------------------------------------------- */

  /**
   * Subscribe to live system configuration.
   */
  subscribeSettings(callback) {
    const cfgRef = ref(this.db, "settings");
    return onValue(cfgRef, (snapshot) => {
      const data = snapshot.val();
      if (data) callback(data);
    });
  }

  /**
   * Update system settings in Firebase RTDB.
   */
  async saveSettings(settings) {
    try {
      await update(ref(this.db, "settings"), settings);
    } catch (e) {
      console.error("[Firebase RTDB] Failed updating settings:", e);
    }
  }

  /* --------------------------------------------------------------------------
     CONTACT INQUIRIES
     -------------------------------------------------------------------------- */
  async submitContactInquiry(inquiry) {
    try {
      const inqRef = ref(this.db, "inquiries");
      const newRef = push(inqRef);
      await set(newRef, {
        ...inquiry,
        created_at: new Date().toISOString(),
      });
      return newRef.key;
    } catch (e) {
      console.error("[Firebase RTDB] Failed saving inquiry:", e);
      throw e;
    }
  }
}

// Singleton instance
export const firebaseService = new FirebaseService();

// Expose on global window object so non-module scripts can seamlessly access it
window.SafeGuardFirebase = firebaseService;
window.dispatchEvent(new CustomEvent("firebase-ready", { detail: firebaseService }));
