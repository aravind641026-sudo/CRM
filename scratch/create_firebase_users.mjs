const API_KEY = "AIzaSyBFXGeQ0OytxoSKwgj8o1gdf7m7O0VwNEk";

const users = [
  { email: "admin@crm.com", password: "admin123", displayName: "System Administrator" },
  { email: "agent@crm.com", password: "agent123", displayName: "Priya Sharma" },
  { email: "agent2@crm.com", password: "agent123", displayName: "Kiran Rao" }
];

async function createUsers() {
  console.log("=== Provisioning Users to New Firebase Auth Project (callingcrm-9c9fd) ===");
  for (const u of users) {
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: u.email,
          password: u.password,
          returnSecureToken: true
        })
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`[CREATED] ${u.email} -> Firebase UID: ${data.localId}`);
        // Set display name
        if (data.idToken && u.displayName) {
          await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idToken: data.idToken,
              displayName: u.displayName,
              returnSecureToken: false
            })
          });
          console.log(`[UPDATED PROFILE] Set display name: ${u.displayName}`);
        }
      } else {
        console.log(`[RESULT] ${u.email} -> Status ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
      }
    } catch (err) {
      console.error(`[ERROR] ${u.email} ->`, err.message);
    }
  }
}

createUsers();
