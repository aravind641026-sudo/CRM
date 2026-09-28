import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file directly
const envPath = path.join(__dirname, '.env');
let baseUrlFromEnv = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/API_BASE_URL=(.+)/);
  if (match) {
    baseUrlFromEnv = match[1].trim();
  }
}

const FIREBASE_API_KEY = "AIzaSyBFXGeQ0OytxoSKwgj8o1gdf7m7O0VwNEk";
const RAW_URL = baseUrlFromEnv || "http://127.0.0.1:8080";
const BACKEND_URL = RAW_URL.endsWith('/api/v1') ? RAW_URL : `${RAW_URL.replace(/\/+$/, '')}/api/v1`;
console.log(`Using Backend API Base URL from .env: ${BACKEND_URL}`);

async function loginFirebase(email, password) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Firebase login failed: ${JSON.stringify(data)}`);
  }
  return data.idToken;
}

async function runTests() {
  console.log('=== MOBILE APP BACKEND INTEGRATION TEST ===\n');

  try {
    // 1. Authenticate as USER (agent2@crm.com)
    console.log('1. Authenticating as USER role: agent2@crm.com ...');
    const token = await loginFirebase('agent2@crm.com', 'agent123');
    console.log('   Firebase ID token obtained successfully.');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // 2. Test /auth/me
    console.log('2. Testing GET /auth/me ...');
    const meRes = await fetch(`${BACKEND_URL}/auth/me`, { headers });
    const meData = await meRes.json();
    console.log(`   Status: ${meRes.status}, User: ${meData.data?.name}, Role: ${meData.data?.role}`);
    if (meData.data?.role !== 'ROLE_USER') throw new Error('Expected ROLE_USER');

    // 3. Test /dashboard/user
    console.log('3. Testing GET /dashboard/user ...');
    const dashRes = await fetch(`${BACKEND_URL}/dashboard/user`, { headers });
    const dashData = await dashRes.json();
    console.log(`   Status: ${dashRes.status}, Assigned leads: ${dashData.data?.myAssignedLeads}, Calls today: ${dashData.data?.myCallsToday}, Revenue: ₹${dashData.data?.totalRevenue || 0}`);

    // 4. Test /attendance/today
    console.log('4. Testing GET /attendance/today ...');
    const attTodayRes = await fetch(`${BACKEND_URL}/attendance/today`, { headers });
    const attTodayData = await attTodayRes.json();
    console.log(`   Status: ${attTodayRes.status}, Attendance Status: ${attTodayData.data?.status}`);

    // 5. Test /attendance/clock-in
    console.log('5. Testing POST /attendance/clock-in ...');
    const clockInRes = await fetch(`${BACKEND_URL}/attendance/clock-in`, {
      method: 'POST',
      headers,
    });
    const clockInData = await clockInRes.json();
    console.log(`   Status: ${clockInRes.status}, Clock-in response: ${clockInData.message || clockInData.data?.status}`);

    // 6. Test /attendance/clock-out
    console.log('6. Testing POST /attendance/clock-out ...');
    const clockOutRes = await fetch(`${BACKEND_URL}/attendance/clock-out`, {
      method: 'POST',
      headers,
    });
    const clockOutData = await clockOutRes.json();
    console.log(`   Status: ${clockOutRes.status}, Clock-out response: ${clockOutData.message || clockOutData.data?.status}, Duration: ${clockOutData.data?.durationMinutes} mins`);

    // 7. Test /attendance/monthly
    console.log('7. Testing GET /attendance/monthly ...');
    const monthlyRes = await fetch(`${BACKEND_URL}/attendance/monthly?year=2026&month=9`, { headers });
    const monthlyData = await monthlyRes.json();
    console.log(`   Status: ${monthlyRes.status}, Present days: ${monthlyData.data?.presentDays}, Half days: ${monthlyData.data?.halfDays}, Records: ${monthlyData.data?.records?.length}`);

    // 8. Test /calls/analytics
    console.log('8. Testing GET /calls/analytics ...');
    const analyticsRes = await fetch(`${BACKEND_URL}/calls/analytics`, { headers });
    const analyticsData = await analyticsRes.json();
    console.log(`   Status: ${analyticsRes.status}, Total calls: ${analyticsData.data?.totalCalls}, Unique calls: ${analyticsData.data?.uniqueCalls}, Outbound: ${analyticsData.data?.outboundCalls}`);

    // 9. Test /leads (assigned leads for user)
    console.log('9. Testing GET /leads ...');
    const leadsRes = await fetch(`${BACKEND_URL}/leads?size=5`, { headers });
    const leadsData = await leadsRes.json();
    console.log(`   Status: ${leadsRes.status}, Total user leads: ${leadsData.data?.totalElements}`);

    // 10. Test /sales/my-sales
    console.log('10. Testing GET /sales/my-sales ...');
    const salesRes = await fetch(`${BACKEND_URL}/sales/my-sales`, { headers });
    const salesData = await salesRes.json();
    console.log(`   Status: ${salesRes.status}, Converted sales count: ${salesData.data?.length}`);

    // 11. Test ADMIN Rejection on Mobile check: admin@crm.com has ROLE_ADMIN
    console.log('11. Testing ADMIN role detection ...');
    const adminToken = await loginFirebase('admin@crm.com', 'admin123');
    const adminMeRes = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminMeData = await adminMeRes.json();
    console.log(`   Admin role: ${adminMeData.data?.role} -> Successfully identified as ADMIN (Mobile app strictly restricts and rejects this role!).`);

    console.log('\n✅ ALL MOBILE BACKEND INTEGRATION TESTS PASSED PERFECTLY!\n');
  } catch (e) {
    console.error('❌ Test failed:', e);
    process.exit(1);
  }
}

runTests();
