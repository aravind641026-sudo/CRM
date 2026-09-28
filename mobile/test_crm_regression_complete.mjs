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

console.log(`================================================================`);
console.log(`CRM COMPREHENSIVE END-TO-END REGRESSION TEST SUITE`);
console.log(`Target Backend: ${BACKEND_URL}`);
console.log(`================================================================\n`);

async function loginFirebase(email, password) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Firebase login failed for ${email}: ${JSON.stringify(data.error?.message || data)}`);
  }
  return data.idToken;
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    failedTests++;
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
    passedTests++;
  }
}

async function runTestSuite() {
  try {
    // -------------------------------------------------------------------------
    // TEST 1: ADMIN & USER AUTHENTICATION & IDENTITY
    // -------------------------------------------------------------------------
    console.log('\n[1/10] AUTHENTICATION & PROFILE VERIFICATION');
    console.log('Logging in as Admin (admin@crm.com)...');
    const adminToken = await loginFirebase('admin@crm.com', 'admin123');
    const adminHeaders = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    };

    const adminMeRes = await fetch(`${BACKEND_URL}/auth/me`, { headers: adminHeaders });
    const adminMe = await adminMeRes.json();
    assert(adminMeRes.status === 200, 'Admin /auth/me returns 200 OK');
    assert(adminMe.data?.role === 'ROLE_ADMIN', `Admin role is ROLE_ADMIN (actual: ${adminMe.data?.role})`);

    console.log('Logging in as User Agent (agent2@crm.com)...');
    const agentToken = await loginFirebase('agent2@crm.com', 'agent123');
    const agentHeaders = {
      'Authorization': `Bearer ${agentToken}`,
      'Content-Type': 'application/json',
    };

    const agentMeRes = await fetch(`${BACKEND_URL}/auth/me`, { headers: agentHeaders });
    const agentMe = await agentMeRes.json();
    assert(agentMeRes.status === 200, 'Agent /auth/me returns 200 OK');
    assert(agentMe.data?.role === 'ROLE_USER', `Agent role is ROLE_USER (actual: ${agentMe.data?.role})`);

    // -------------------------------------------------------------------------
    // TEST 2: SECURITY, AUTHORIZATION & RBAC ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log('\n[2/10] RBAC & SECURITY ENFORCEMENT');
    // Test unauthenticated 401
    const unauthRes = await fetch(`${BACKEND_URL}/dashboard/user`);
    assert(unauthRes.status === 401, `Unauthenticated request receives 401 Unauthorized (got: ${unauthRes.status})`);

    // Test agent trying to access admin-only endpoint: /users
    const agentUsersRes = await fetch(`${BACKEND_URL}/users`, { headers: agentHeaders });
    assert(agentUsersRes.status === 403, `Agent accessing /users receives 403 Forbidden (got: ${agentUsersRes.status})`);

    // Test agent trying to access admin-only endpoint: /audit-logs
    const agentAuditRes = await fetch(`${BACKEND_URL}/audit-logs`, { headers: agentHeaders });
    assert(agentAuditRes.status === 403, `Agent accessing /audit-logs receives 403 Forbidden (got: ${agentAuditRes.status})`);

    // -------------------------------------------------------------------------
    // TEST 3: PROJECTS MANAGEMENT (CRUD)
    // -------------------------------------------------------------------------
    console.log('\n[3/10] PROJECTS LIFECYCLE (ADMIN)');
    const testProjectName = `Test Campaign ${Date.now()}`;
    const createProjRes = await fetch(`${BACKEND_URL}/projects`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: testProjectName,
        description: 'Automated test campaign for CRM verification',
        status: 'ACTIVE',
      }),
    });
    const createProjData = await createProjRes.json();
    assert(createProjRes.status === 200 || createProjRes.status === 201, 'Admin successfully created test project');
    const createdProject = createProjData.data;
    const testProjectId = createdProject.id;
    assert(testProjectId > 0, `Created project has valid ID: ${testProjectId}`);

    // Fetch active projects
    const listProjRes = await fetch(`${BACKEND_URL}/projects`, { headers: adminHeaders });
    const listProjData = await listProjRes.json();
    const projectsArr = listProjData.data?.content || listProjData.data || (Array.isArray(listProjData) ? listProjData : []);
    const foundProject = projectsArr.find(p => p.id === testProjectId);
    assert(foundProject !== undefined, `Created project ${testProjectId} visible in projects listing`);

    // Update project
    const updateProjRes = await fetch(`${BACKEND_URL}/projects/${testProjectId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        name: `${testProjectName} (Updated)`,
        description: 'Updated campaign description',
        status: 'ACTIVE',
      }),
    });
    assert(updateProjRes.status === 200, 'Admin successfully updated project details');

    // -------------------------------------------------------------------------
    // TEST 4: LEADS PIPELINE CREATION & ASSIGNMENT
    // -------------------------------------------------------------------------
    console.log('\n[4/10] LEADS PIPELINE CREATION & ASSIGNMENT');
    const testLeadName = `Enterprise Lead ${Date.now()}`;
    const testLeadPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

    const createLeadRes = await fetch(`${BACKEND_URL}/leads`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: testLeadName,
        phone: testLeadPhone,
        email: `lead_${Date.now()}@example.com`,
        city: 'Bengaluru',
        status: 'NEW',
        projectId: testProjectId,
      }),
    });
    const createLeadData = await createLeadRes.json();
    assert(createLeadRes.status === 200 || createLeadRes.status === 201, 'Created new lead successfully');
    const createdLead = createLeadData.data;
    const testLeadId = createdLead.id;
    assert(testLeadId > 0, `Created lead has valid ID: ${testLeadId}`);

    // Assign lead to agent2
    const agentUserId = agentMe.data.id;
    const assignRes = await fetch(`${BACKEND_URL}/leads/${testLeadId}/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        userId: agentUserId,
        reason: 'Automated test lead assignment for client follow-up',
      }),
    });
    assert(assignRes.status === 200, `Successfully assigned lead #${testLeadId} to Agent #${agentUserId}`);

    // Fetch lead details as Agent
    const leadDetailRes = await fetch(`${BACKEND_URL}/leads/${testLeadId}`, { headers: agentHeaders });
    const leadDetailData = await leadDetailRes.json();
    assert(leadDetailRes.status === 200, 'Agent can fetch assigned lead details');
    assert(leadDetailData.data?.name === testLeadName, 'Lead detail name matches');
    assert(
      leadDetailData.data?.currentOwner?.id === agentUserId || leadDetailData.data?.assignedTo?.id === agentUserId,
      'Lead current owner is set to assigned agent'
    );

    // -------------------------------------------------------------------------
    // TEST 5: NOTES & INTERNAL COLLABORATION
    // -------------------------------------------------------------------------
    console.log('\n[5/10] INTERNAL NOTES & ACTIVITY LOG');
    const addNoteRes = await fetch(`${BACKEND_URL}/leads/${testLeadId}/notes`, {
      method: 'POST',
      headers: agentHeaders,
      body: JSON.stringify({
        content: 'Customer is looking for 50 licenses. Scheduled follow-up for quotation discussion.',
      }),
    });
    assert(addNoteRes.status === 200 || addNoteRes.status === 201, 'Agent successfully logged internal lead note');

    const getNotesRes = await fetch(`${BACKEND_URL}/leads/${testLeadId}/notes`, { headers: agentHeaders });
    const notesData = await getNotesRes.json();
    const notesList = notesData.data || notesData;
    assert(notesList.length > 0, `Lead #${testLeadId} has ${notesList.length} note(s) logged`);

    // -------------------------------------------------------------------------
    // TEST 6: TELEPHONY CALL LOGGING & OUTCOMES
    // -------------------------------------------------------------------------
    console.log('\n[6/10] TELEPHONY & CALL INTERACTIONS');
    const logCallRes = await fetch(`${BACKEND_URL}/calls`, {
      method: 'POST',
      headers: agentHeaders,
      body: JSON.stringify({
        leadId: testLeadId,
        callStatus: 'CONNECTED',
        businessOutcome: 'INTERESTED',
        durationSeconds: 145,
        notes: 'Discussion with decision maker. Expressed strong interest.',
      }),
    });
    const logCallData = await logCallRes.json();
    assert(logCallRes.status === 200 || logCallRes.status === 201, 'Logged telephone call record with status & outcome');
    const loggedCall = logCallData.data;
    assert(loggedCall.durationSeconds === 145, 'Call duration accurately stored');

    // Verify call shows in call history
    const callHistoryRes = await fetch(`${BACKEND_URL}/leads/${testLeadId}/calls`, { headers: agentHeaders });
    const callHistoryData = await callHistoryRes.json();
    const callsList = callHistoryData.data || callHistoryData;
    assert(callsList.length > 0, `Lead calls list contains recorded call (#${loggedCall.id})`);

    // -------------------------------------------------------------------------
    // TEST 7: SCHEDULED FOLLOW-UPS WORKFLOW
    // -------------------------------------------------------------------------
    console.log('\n[7/10] SCHEDULED FOLLOW-UPS LIFECYCLE');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 19);

    const scheduleFuRes = await fetch(`${BACKEND_URL}/follow-ups`, {
      method: 'POST',
      headers: agentHeaders,
      body: JSON.stringify({
        leadId: testLeadId,
        scheduledTime: tomorrowIso,
        notes: 'Follow-up call to review customized enterprise proposal',
      }),
    });
    const scheduleFuData = await scheduleFuRes.json();
    assert(scheduleFuRes.status === 200 || scheduleFuRes.status === 201, 'Successfully scheduled client follow-up callback');
    const createdFollowUp = scheduleFuData.data;
    const fuId = createdFollowUp.id;

    // Get upcoming followups
    const upcomingFuRes = await fetch(`${BACKEND_URL}/follow-ups/upcoming`, { headers: agentHeaders });
    const upcomingFuData = await upcomingFuRes.json();
    const upcomingList = upcomingFuData.data || [];
    assert(upcomingList.some(fu => fu.id === fuId), `Follow-up #${fuId} appears in upcoming follow-ups list`);

    // Mark follow-up as completed via status patch
    const completeFuRes = await fetch(`${BACKEND_URL}/follow-ups/${fuId}/status`, {
      method: 'PATCH',
      headers: agentHeaders,
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    assert(completeFuRes.status === 200, `Successfully completed follow-up #${fuId}`);

    // -------------------------------------------------------------------------
    // TEST 8: LEAD SALE CONVERSION & REVENUE TRACKING
    // -------------------------------------------------------------------------
    console.log('\n[8/10] SALE CONVERSION & REVENUE ATTRIBUTION');
    const saleAmount = 85000;
    const convertRes = await fetch(`${BACKEND_URL}/leads/${testLeadId}/convert`, {
      method: 'POST',
      headers: agentHeaders,
      body: JSON.stringify({
        amount: saleAmount,
        currency: 'INR',
        notes: 'Signed contract for 50 user annual enterprise subscription',
        paymentMethod: 'BANK_TRANSFER',
      }),
    });
    const convertData = await convertRes.json();
    assert(convertRes.status === 200 || convertRes.status === 201, `Converted lead #${testLeadId} into sale of ₹${saleAmount}`);

    // Verify converted status on lead
    const convertedLeadRes = await fetch(`${BACKEND_URL}/leads/${testLeadId}`, { headers: agentHeaders });
    const convertedLead = (await convertedLeadRes.json()).data;
    assert(convertedLead.status === 'CONVERTED', `Lead status updated to CONVERTED (actual: ${convertedLead.status})`);

    // Verify sale record in agent sales
    const mySalesRes = await fetch(`${BACKEND_URL}/sales/my-sales`, { headers: agentHeaders });
    const mySales = (await mySalesRes.json()).data || [];
    assert(mySales.some(s => s.leadId === testLeadId || s.lead?.id === testLeadId), 'Sale record appears in Agent /sales/my-sales list');

    // -------------------------------------------------------------------------
    // TEST 9: ANALYTICS, DASHBOARD & ADMIN AUDITING
    // -------------------------------------------------------------------------
    console.log('\n[9/10] DASHBOARD METRICS, ANALYTICS & AUDIT LOGS');
    // Agent user dashboard
    const userDashRes = await fetch(`${BACKEND_URL}/dashboard/user`, { headers: agentHeaders });
    const userDash = (await userDashRes.json()).data;
    assert(userDash !== undefined && userDash.myAssignedLeads !== undefined, 'User dashboard provides accurate metric counters');

    // Call analytics
    const analyticsRes = await fetch(`${BACKEND_URL}/calls/analytics`, { headers: agentHeaders });
    const analytics = (await analyticsRes.json()).data;
    assert(analytics !== undefined && analytics.totalCalls >= 1, 'Call analytics calculates total call performance');

    // Admin audit logs check
    const auditRes = await fetch(`${BACKEND_URL}/audit-logs?size=20`, { headers: adminHeaders });
    const auditData = await auditRes.json();
    const auditLogs = auditData.data?.content || auditData.data || [];
    assert(auditLogs.length > 0, `Admin audit log contains logged operational events (${auditLogs.length} events logged)`);

    // -------------------------------------------------------------------------
    // TEST 10: EDGE CASES, ERROR RESILIENCE & VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n[10/10] EDGE CASES & ERROR RESILIENCE');
    // 404 for non-existent lead
    const notFoundRes = await fetch(`${BACKEND_URL}/leads/9999999`, { headers: agentHeaders });
    assert(notFoundRes.status === 404, `Non-existent entity returns 404 Not Found (got: ${notFoundRes.status})`);

    // 400 for empty required fields
    const badReqRes = await fetch(`${BACKEND_URL}/leads`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({}), // Missing name, phone, etc.
    });
    assert(badReqRes.status === 400, `Invalid request payload returns 400 Bad Request (got: ${badReqRes.status})`);

    // Clean up test project
    console.log('\nCleaning up test project...');
    const delProjRes = await fetch(`${BACKEND_URL}/projects/${testProjectId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    assert(delProjRes.status === 200 || delProjRes.status === 204, `Cleaned up test project #${testProjectId}`);

    console.log('\n================================================================');
    console.log(`ALL TESTS PASSED! (${passedTests} passed, ${failedTests} failed)`);
    console.log(`================================================================\n`);
  } catch (err) {
    console.error('\n❌ Test Suite Encountered an Error:\n', err);
    process.exit(1);
  }
}

runTestSuite();
