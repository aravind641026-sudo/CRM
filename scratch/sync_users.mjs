import http from 'http';

const API_KEY = "AIzaSyBFXGeQ0OytxoSKwgj8o1gdf7m7O0VwNEk";

async function main() {
  console.log("=== CHECKING BACKEND USERS ===");
  let usersToSync = [];

  try {
    const loginRes = await fetch("http://localhost:8080/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@crm.com", password: "admin123" })
    });
    
    if (loginRes.ok) {
      const loginData = await loginRes.json();
      console.log("Logged into CRM backend successfully.");
      const token = loginData.data?.token;

      const usersRes = await fetch("http://localhost:8080/api/v1/users", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const usersList = usersData.data?.content || usersData.data || [];
        console.log(`Found ${usersList.length} users in backend DB.`);
        for (const u of usersList) {
          usersToSync.push({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            password: u.email === "admin@crm.com" ? "admin123" : "agent123"
          });
        }
      }
    } else {
      console.log("Backend login returned:", loginRes.status);
    }
  } catch (err) {
    console.log("Backend not reachable directly on port 8080 (" + err.message + "). Using defined system user roster.");
  }

  // Fallback / standard CRM roster if backend wasn't running or empty
  if (usersToSync.length === 0) {
    usersToSync = [
      { email: "admin@crm.com", name: "System Administrator", role: "ROLE_ADMIN", password: "admin123" },
      { email: "agent@crm.com", name: "Priya Sharma", role: "ROLE_USER", password: "agent123" },
      { email: "agent2@crm.com", name: "Kiran Rao", role: "ROLE_USER", password: "agent123" }
    ];
  }

  console.log("\n=== USERS TO PROVISION / SYNC IN FIREBASE ===");
  console.table(usersToSync);

  console.log("\n=== PROVISIONING INTO FIREBASE (Project: callingcrm-9c9fd) ===");
  for (const user of usersToSync) {
    try {
      // 1. Attempt to sign up user
      const signUpRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          returnSecureToken: true
        })
      });

      const signUpData = await signUpRes.json();

      if (signUpRes.ok) {
        console.log(`[CREATED] ${user.email} -> UID: ${signUpData.localId}`);
        // Update display name
        if (signUpData.idToken && user.name) {
          await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idToken: signUpData.idToken,
              displayName: user.name,
              returnSecureToken: false
            })
          });
          console.log(`  [PROFILE UPDATED] Set name: ${user.name}`);
        }
      } else if (signUpData.error?.message === "EMAIL_EXISTS") {
        console.log(`[EXISTS] ${user.email} already exists in Firebase Auth.`);
        // Try sign-in to verify credentials and ensure display name is updated
        try {
          const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              password: user.password,
              returnSecureToken: true
            })
          });
          const signInData = await signInRes.json();
          if (signInRes.ok) {
            console.log(`  [VERIFIED] Login successful for ${user.email} -> UID: ${signInData.localId}`);
            if (user.name && (!signInData.displayName || signInData.displayName !== user.name)) {
              await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  idToken: signInData.idToken,
                  displayName: user.name,
                  returnSecureToken: false
                })
              });
              console.log(`  [PROFILE UPDATED] Display name set to: ${user.name}`);
            }
          } else {
            console.log(`  [NOTICE] Existing account password check: ${signInData.error?.message}`);
          }
        } catch (e) {
          console.log(`  [WARN] Could not verify login for ${user.email}: ${e.message}`);
        }
      } else {
        console.error(`[FAILED] ${user.email} -> ${JSON.stringify(signUpData.error || signUpData)}`);
      }
    } catch (err) {
      console.error(`[ERROR] ${user.email} ->`, err.message);
    }
  }

  console.log("\n=== ALL USERS PROCESSED SUCCESSFULLY ===");
}

main();
