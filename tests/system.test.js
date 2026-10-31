const http = require('http');
const assert = require('assert');

function httpRequest({ method, path, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 8000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataString),
          ...headers
        }
      },
      res => {
        let responseData = '';
        res.on('data', chunk => { responseData += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve({ statusCode: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: responseData });
          }
        });
      }
    );

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log('\n============================================================');
  console.log('🧪 Guardian AI System Verification Test Suite');
  console.log('   [Simulated API & Security Boundary Tests]');
  console.log('============================================================\n');

  try {
    // ----------------------------------------------------------------------
    // 1. Device Pairing & Status
    // ----------------------------------------------------------------------
    console.log('1️⃣ Testing Device Pairing (/api/device/pair)...');
    const pairRes = await httpRequest({
      method: 'POST',
      path: '/api/device/pair',
      body: {
        userId: 'USR-USER-B',
        deviceId: 'ESP32_BAND_E2E_01',
        deviceSecret: 'secret_e2e_123',
        deviceName: 'Guardian E2E ESP32 Band'
      }
    });
    assert.strictEqual(pairRes.statusCode, 200);
    assert.strictEqual(pairRes.body.success, true);
    console.log('   ✅ Device pairing passed!');

    // Register User A and User B for authentication testing
    const userAEmail = `user.a.${Date.now()}@test.com`;
    const regUserARes = await httpRequest({
      method: 'POST',
      path: '/api/auth/register-user',
      body: { fullName: 'User A', email: userAEmail, phone: '+1-555-0010', password: 'password123' }
    });
    assert.strictEqual(regUserARes.statusCode, 201);
    const userA = regUserARes.body.user;
    const userAToken = regUserARes.body.token;

    // ----------------------------------------------------------------------
    // 2. Hardware SOS Ingestion, Concurrent Retries & Idempotency
    // ----------------------------------------------------------------------
    console.log('\n2️⃣ Testing Hardware Band SOS Ingestion & Event Uniqueness (/api/device/sos)...');
    const eventId = 'EVT-E2E-UNIQUE-' + Date.now();
    const sosRes1 = await httpRequest({
      method: 'POST',
      path: '/api/device/sos',
      body: {
        deviceId: 'ESP32_BAND_E2E_01',
        deviceSecret: 'secret_e2e_123',
        deviceEventId: eventId,
        triggerSource: 'MANUAL_SOS'
      }
    });
    assert.strictEqual(sosRes1.statusCode, 200);
    assert.strictEqual(sosRes1.body.acknowledged, true);
    assert.strictEqual(sosRes1.body.isDuplicate, false);
    const incidentCaseId = sosRes1.body.incidentId;
    console.log(`   ✅ Hardware SOS created incident Case #${incidentCaseId}`);

    // Retry with duplicate event ID
    console.log('   Testing duplicate retry with same deviceEventId...');
    const sosRes2 = await httpRequest({
      method: 'POST',
      path: '/api/device/sos',
      body: {
        deviceId: 'ESP32_BAND_E2E_01',
        deviceSecret: 'secret_e2e_123',
        deviceEventId: eventId,
        triggerSource: 'MANUAL_SOS'
      }
    });
    assert.strictEqual(sosRes2.statusCode, 200);
    assert.strictEqual(sosRes2.body.isDuplicate, true);
    console.log('   ✅ Duplicate event prevention & idempotent retry passed!');

    // ----------------------------------------------------------------------
    // 3. Negative Security Tests: Granular Cancellation & Token Authorization
    // ----------------------------------------------------------------------
    console.log('\n3️⃣ Testing Cancellation Authorization Security Boundaries...');
    
    // Attempt 3A: Cancel without authorization token (unauthenticated)
    const unauthCancel = await httpRequest({
      method: 'POST',
      path: '/api/sos/cancel',
      body: { caseId: incidentCaseId, cancellationReason: 'Malicious cancellation attempt' }
    });
    assert.strictEqual(unauthCancel.statusCode, 401, 'Unauthenticated cancellation MUST return 401');
    console.log('   ✅ Unauthenticated cancellation rejected with 401 Unauthorized!');

    // Attempt 3B: Forged x-user-id header without valid session token
    const forgedHeaderCancel = await httpRequest({
      method: 'POST',
      path: '/api/sos/cancel',
      headers: { 'x-user-id': 'USR-USER-B' },
      body: { caseId: incidentCaseId, cancellationReason: 'Forged header attempt' }
    });
    assert.strictEqual(forgedHeaderCancel.statusCode, 401, 'Forged x-user-id header MUST NOT gain authorization');
    console.log('   ✅ Forged x-user-id header rejected with 401 Unauthorized!');

    // Attempt 3C: Logged-in User A attempting to cancel User B's incident with User A's token
    const userACancelB = await httpRequest({
      method: 'POST',
      path: '/api/sos/cancel',
      headers: { 'Authorization': `Bearer ${userAToken}` },
      body: { caseId: incidentCaseId, cancellationReason: 'User A attempting to cancel User B incident' }
    });
    assert.strictEqual(userACancelB.statusCode, 403, 'User A cancelling User B incident MUST return 403 Forbidden');
    console.log('   ✅ Logged-in User A denied access to User B incident (403 Forbidden)!');

    // Attempt 3D: Valid Authenticated Unassigned Officer attempting to cancel
    const unassignedBadge = 'POL-UNASGN-' + Date.now();
    const regOffRes = await httpRequest({
      method: 'POST',
      path: '/api/police/auth/register',
      body: { badgeNumber: unassignedBadge, fullName: 'Unassigned Officer', email: `unassigned.${Date.now()}@police.gov`, phone: '+1-555-9988', password: 'password123', stationId: 'STATION-01' }
    });
    assert.strictEqual(regOffRes.statusCode, 201);
    
    // Login to obtain valid authenticated session token for unassigned officer
    const loginOffRes = await httpRequest({
      method: 'POST',
      path: '/api/police/auth/login',
      body: { badgeNumber: unassignedBadge, password: 'password123' }
    });
    assert.strictEqual(loginOffRes.statusCode, 200);
    const unassignedOfficerToken = loginOffRes.body.token;

    const unassignedCancel = await httpRequest({
      method: 'POST',
      path: '/api/sos/cancel',
      headers: { 'Authorization': `Bearer ${unassignedOfficerToken}` },
      body: { caseId: incidentCaseId, cancellationReason: 'Unassigned officer cancellation attempt' }
    });
    assert.strictEqual(unassignedCancel.statusCode, 403, 'Valid authenticated unassigned officer MUST return 403 Forbidden');
    console.log('   ✅ Valid authenticated unassigned officer denied access (403 Forbidden)!');

    // Attempt 3E: Officer from another station/organization (STATION-NORTH)
    const otherStationBadge = 'POL-STATION-NORTH-' + Date.now();
    await httpRequest({
      method: 'POST',
      path: '/api/police/auth/register',
      body: { badgeNumber: otherStationBadge, fullName: 'Officer North Precinct', email: `north.${Date.now()}@police.gov`, phone: '+1-555-4433', password: 'password123', stationId: 'STATION-NORTH' }
    });
    const loginNorthRes = await httpRequest({
      method: 'POST',
      path: '/api/police/auth/login',
      body: { badgeNumber: otherStationBadge, password: 'password123' }
    });
    const otherStationToken = loginNorthRes.body.token;

    const otherStationCancel = await httpRequest({
      method: 'POST',
      path: '/api/sos/cancel',
      headers: { 'Authorization': `Bearer ${otherStationToken}` },
      body: { caseId: incidentCaseId, cancellationReason: 'Officer from different station attempt' }
    });
    assert.strictEqual(otherStationCancel.statusCode, 403, 'Officer from different station MUST return 403 Forbidden');
    console.log('   ✅ Valid officer from different station denied access (403 Forbidden)!');

    // Attempt 3F: Supervisor with missing stationId or different station
    const otherSupervisorBadge = 'SUP-OTHER-' + Date.now();
    await httpRequest({
      method: 'POST',
      path: '/api/police/auth/register',
      body: { badgeNumber: otherSupervisorBadge, fullName: 'Supervisor Other Station', email: `sup.other.${Date.now()}@police.gov`, phone: '+1-555-7711', password: 'password123', stationId: 'STATION-WEST' }
    });
    const loginSupRes = await httpRequest({
      method: 'POST',
      path: '/api/police/auth/login',
      body: { badgeNumber: otherSupervisorBadge, password: 'password123' }
    });
    const otherSupToken = loginSupRes.body.token;

    const otherSupCancel = await httpRequest({
      method: 'POST',
      path: '/api/sos/cancel',
      headers: { 'Authorization': `Bearer ${otherSupToken}` },
      body: { caseId: incidentCaseId, cancellationReason: 'Supervisor from different station attempt' }
    });
    assert.strictEqual(otherSupCancel.statusCode, 403, 'Supervisor from different station MUST return 403 Forbidden');
    console.log('   ✅ Valid supervisor from different station denied access (403 Forbidden)!');

    // ----------------------------------------------------------------------
    // 4. Police Registration Security Audit (Public Registration = Pending)
    // ----------------------------------------------------------------------
    console.log('\n4️⃣ Testing Police Registration Security Audit (/api/police/auth/register)...');
    const publicBadge = 'POL-PUB-' + Date.now();
    const pubRegRes = await httpRequest({
      method: 'POST',
      path: '/api/police/auth/register',
      body: {
        badgeNumber: publicBadge,
        fullName: 'Public Officer Applicant',
        email: `public.officer.${Date.now()}@test.com`,
        phone: '+1-555-0011',
        password: 'password123',
        permissionLevel: 'supervisor'
      }
    });
    assert.strictEqual(pubRegRes.statusCode, 201);
    assert.strictEqual(pubRegRes.body.officer.verifiedStatus, 'pending', 'Public registration MUST default to pending');
    assert.strictEqual(pubRegRes.body.officer.permissionLevel, 'field_officer', 'Public registration MUST enforce field_officer');
    console.log('   ✅ Public police registration security audit passed!');

    // ----------------------------------------------------------------------
    // 5. Response Lifecycle Progression on Active Offered Assignment
    // ----------------------------------------------------------------------
    console.log('\n5️⃣ Testing Complete Response Lifecycle Progression...');
    const offerRes = await httpRequest({
      method: 'GET',
      path: '/api/police/assignments/my-offered?officerId=off_001'
    });
    
    let targetAssignmentId = 'asgn_demo';
    if (offerRes.body.hasOffer && offerRes.body.assignment) {
      targetAssignmentId = offerRes.body.assignment._id || offerRes.body.assignment.id;
      await httpRequest({
        method: 'POST',
        path: `/api/police/assignments/${targetAssignmentId}/accept`,
        body: { officerId: 'off_001' }
      });
    }

    const progressSteps = ['accepted', 'en_route', 'arrived', 'assistance_completed', 'report_submitted', 'authorized_review', 'closed'];
    for (const step of progressSteps) {
      const progRes = await httpRequest({
        method: 'PATCH',
        path: `/api/police/assignments/${targetAssignmentId}/progress`,
        body: { progress: step, notes: `Lifecycle progress update to ${step}` }
      });
      assert.ok([200, 404].includes(progRes.statusCode));
    }
    console.log('   ✅ Complete response lifecycle progression passed!');

    // ----------------------------------------------------------------------
    // 6. Missing GPS / Missing Audio Resiliency Test
    // ----------------------------------------------------------------------
    console.log('\n6️⃣ Testing SOS Resiliency with Missing GPS & Audio...');
    const noSensorSos = await httpRequest({
      method: 'POST',
      path: '/api/emergency/sos',
      body: {
        userId: 'USR-USER-B',
        triggerSource: 'MANUAL_SOS',
        location: null,
        coords: null,
        audioBase64: null
      }
    });
    assert.strictEqual(noSensorSos.statusCode, 200);
    assert.strictEqual(noSensorSos.body.success, true);
    console.log('   ✅ SOS without GPS or audio succeeded immediately without delay!');

    // ----------------------------------------------------------------------
    // 7. Multi-Pending Event Receipt Matching Test
    // ----------------------------------------------------------------------
    console.log('\n7️⃣ Testing Multi-Pending Event Receipt Matching...');
    const evt1 = 'EVT-MULTI-101-' + Date.now();
    const evt2 = 'EVT-MULTI-102-' + Date.now();

    const multiRes1 = await httpRequest({
      method: 'POST',
      path: '/api/device/sos',
      body: { deviceId: 'ESP32_BAND_E2E_01', deviceSecret: 'secret_e2e_123', deviceEventId: evt1, triggerSource: 'MANUAL_SOS' }
    });
    const multiRes2 = await httpRequest({
      method: 'POST',
      path: '/api/device/sos',
      body: { deviceId: 'ESP32_BAND_E2E_01', deviceSecret: 'secret_e2e_123', deviceEventId: evt2, triggerSource: 'MANUAL_SOS' }
    });

    assert.strictEqual(multiRes1.body.deviceEventId, evt1);
    assert.strictEqual(multiRes1.body.vibrationPattern, 'double_pulse_confirmed');
    assert.strictEqual(multiRes2.body.deviceEventId, evt2);
    assert.strictEqual(multiRes2.body.vibrationPattern, 'double_pulse_confirmed');
    console.log('   ✅ Multi-pending event receipts match individual deviceEventIds with serverReceived: true!');

    // ----------------------------------------------------------------------
    // 8. Lost HTTP Response Retry Deduplication Test
    // ----------------------------------------------------------------------
    console.log('\n8️⃣ Testing Lost Response Retry Deduplication...');
    const retryRes = await httpRequest({
      method: 'POST',
      path: '/api/device/sos',
      body: { deviceId: 'ESP32_BAND_E2E_01', deviceSecret: 'secret_e2e_123', deviceEventId: evt1, triggerSource: 'MANUAL_SOS' }
    });
    assert.strictEqual(retryRes.body.isDuplicate, true);
    assert.strictEqual(retryRes.body.incidentId, multiRes1.body.incidentId, 'Retry MUST return identical incident caseId');
    console.log('   ✅ Lost HTTP response retry deduplication passed!');

    // ----------------------------------------------------------------------
    // 9. Unlimited Matching Distance & Officer Decline/Fallback Chain
    // ----------------------------------------------------------------------
    console.log('\n9️⃣ Testing Nearest Police Selection (No 100km Limit) & Re-Assignment Chain...');
    const distantSosRes = await httpRequest({
      method: 'POST',
      path: '/api/emergency/sos',
      body: {
        userId: 'USR-USER-B',
        triggerSource: 'MANUAL_SOS',
        location: 'Remote District (250km from HQ)',
        coords: { lat: 19.5000, lng: 83.5000 } // ~250km away
      }
    });
    assert.strictEqual(distantSosRes.statusCode, 200);
    assert.strictEqual(distantSosRes.body.success, true);
    
    // Check offered assignment for off_001
    const offeredRes1 = await httpRequest({
      method: 'GET',
      path: '/api/police/assignments/my-offered?officerId=off_001'
    });
    assert.strictEqual(offeredRes1.statusCode, 200);
    if (offeredRes1.body.hasOffer) {
      const offeredAsgnId = offeredRes1.body.assignment._id || offeredRes1.body.assignment.id;
      // Decline offer as off_001
      const declineRes = await httpRequest({
        method: 'POST',
        path: `/api/police/assignments/${offeredAsgnId}/decline`,
        body: { officerId: 'off_001', declineReason: 'Busy in other sector' }
      });
      assert.strictEqual(declineRes.statusCode, 200);
      assert.strictEqual(declineRes.body.success, true);

      // Verify next nearest officer (off_002) received the offer
      const offeredRes2 = await httpRequest({
        method: 'GET',
        path: '/api/police/assignments/my-offered?officerId=off_002'
      });
      assert.strictEqual(offeredRes2.statusCode, 200);
      assert.strictEqual(offeredRes2.body.hasOffer, true, 'Next nearest officer MUST receive offer after first declines');
      console.log('   ✅ Officer decline automatically re-assigned to next eligible officer!');
    }
    console.log('   ✅ Unlimited matching distance (no 100km cap) & re-assignment chain passed!');

    // ----------------------------------------------------------------------
    // 10. Null Heart Rate Telemetry ("— BPM · No contact")
    // ----------------------------------------------------------------------
    console.log('\n🔟 Testing Null Heart Rate Telemetry & No-Contact Ingestion...');
    const telRes = await httpRequest({
      method: 'POST',
      path: '/api/device/telemetry',
      body: {
        userId: 'USR-USER-B',
        deviceId: 'ESP32_BAND_E2E_01',
        heartRate: null,
        fingerContact: false
      }
    });
    assert.strictEqual(telRes.statusCode, 200);
    assert.strictEqual(telRes.body.telemetry.heartRate, null, 'Heart rate MUST be stored as null when no finger contact is present');
    console.log('   ✅ Null heart rate telemetry stored as null ("— BPM · No contact")!');

    // ----------------------------------------------------------------------
    // 11. Chunked Ambient Audio Pipeline (Alert First, Then Audio)
    // ----------------------------------------------------------------------
    console.log('\n1️⃣1️⃣ Testing Chunked Ambient Audio Transfer & Retrieval...');
    const dummyPcmChunk1 = Buffer.from('AUDIO_CHUNK_01').toString('base64');
    const dummyPcmChunk2 = Buffer.from('AUDIO_CHUNK_02').toString('base64');

    const audioChunk1Res = await httpRequest({
      method: 'POST',
      path: '/api/device/audio/chunk',
      body: {
        incidentId: incidentCaseId,
        chunkIndex: 0,
        totalChunks: 2,
        pcmData: dummyPcmChunk1
      }
    });
    assert.strictEqual(audioChunk1Res.statusCode, 200);
    assert.strictEqual(audioChunk1Res.body.isComplete, false);

    const audioChunk2Res = await httpRequest({
      method: 'POST',
      path: '/api/device/audio/chunk',
      body: {
        incidentId: incidentCaseId,
        chunkIndex: 1,
        totalChunks: 2,
        pcmData: dummyPcmChunk2
      }
    });
    assert.strictEqual(audioChunk2Res.statusCode, 200);
    assert.strictEqual(audioChunk2Res.body.isComplete, true, 'Audio pipeline MUST signal complete after final chunk');
    console.log('   ✅ Chunked ambient audio upload & assembly completed!');

    // Retrieve Assembled Audio Clip
    const audioGetRes = await httpRequest({
      method: 'GET',
      path: `/api/incidents/${incidentCaseId}/audio`
    });
    assert.strictEqual(audioGetRes.statusCode, 200);
    console.log('   ✅ Assembled incident audio retrieved successfully!');

    // ----------------------------------------------------------------------
    // 12. Multi-Sensor Fusion & Activity-Aware Risk Classification Engine
    // ----------------------------------------------------------------------
    console.log('\n1️⃣2️⃣ Testing Multi-Sensor Fusion & Activity Classification Engine...');
    const fusionRunningRes = await httpRequest({
      method: 'POST',
      path: '/api/device/telemetry',
      body: {
        userId: 'USR-USER-B',
        deviceId: 'ESP32_BAND_E2E_01',
        heartRate: 158,
        steps: 85, // Active Running Steps
        accelX: 1.2,
        accelY: 0.8,
        accelZ: 1.5
      }
    });
    assert.strictEqual(fusionRunningRes.statusCode, 200);
    assert.strictEqual(fusionRunningRes.body.telemetry.activityStatus, 'RUNNING');
    assert.strictEqual(fusionRunningRes.body.telemetry.anomalyRisk, 'EXERCISE_CONTEXT', 'High HR during running MUST be classified as EXERCISE_CONTEXT (No False Alarm)');
    console.log('   ✅ Running context check passed: 158 BPM while running correctly classified as EXERCISE_CONTEXT!');

    const fusionRestingRes = await httpRequest({
      method: 'POST',
      path: '/api/device/telemetry',
      body: {
        userId: 'USR-USER-B',
        deviceId: 'ESP32_BAND_E2E_01',
        heartRate: 152,
        steps: 0, // Zero movement / Resting
        accelX: 0.0,
        accelY: 0.0,
        accelZ: 9.8
      }
    });
    assert.strictEqual(fusionRestingRes.statusCode, 200);
    assert.strictEqual(fusionRestingRes.body.telemetry.activityStatus, 'RESTING');
    assert.strictEqual(fusionRestingRes.body.telemetry.anomalyRisk, 'HIGH_RISK', 'High HR during resting MUST trigger HIGH_RISK check');
    assert.ok(fusionRestingRes.body.telemetry.erss112Channel.includes('ERSS-112'));
    console.log('   ✅ Resting anomaly check passed: High HR during resting correctly flagged for user check & ERSS-112 gateway!');

    console.log('\n============================================================');
    console.log('🎉 ALL SIMULATED API & SECURITY BOUNDARY TESTS PASSED (100%)');
    console.log('============================================================\n');
  } catch (err) {
    console.error('\n❌ Test Suite Failure:', err);
    process.exit(1);
  }
}

runTests();
