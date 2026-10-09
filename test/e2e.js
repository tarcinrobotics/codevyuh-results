const assert = require('assert');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function runTests() {
  console.log('🧪 Starting End-to-End & Authorization Test Suite...\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${err.message}\n`);
      failed++;
    }
  }

  // ── 1. Unauthenticated Protection ──
  await test('Unauthenticated API requests are rejected with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/event-insights/events`);
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await test('Unauthenticated page access redirects to /login', async () => {
    const pages = ['/admin-overview', '/zone-dashboard', '/parent-view', '/user-management'];
    for (const page of pages) {
      const res = await fetch(`${BASE_URL}${page}`, { redirect: 'manual' });
      assert.strictEqual(res.status, 302, `Page ${page} expected 302 redirect, got ${res.status}`);
      const loc = res.headers.get('location');
      assert.ok(loc.includes('/login'), `Expected redirect to /login, got ${loc}`);
    }
  });

  // ── 2. Invalid Login & Rate Limiting ──
  await test('Invalid password rejected with generic 401 error', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin@kln', password: 'WrongPassword123' }),
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'Invalid credentials');
  });

  await test('Unknown username rejected without account enumeration', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent@user.com', password: 'AnyPassword123' }),
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'Invalid credentials');
  });

  await test('Card A (KLN) rejects Dolphin admin credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin@dolphin',
        password: 'dolphinprelims@2026',
        targetEvent: '0542016a-b443-421e-9ae0-a4787697b945', // KLN ID
      }),
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'Invalid credentials');
  });

  await test('Card B (Dolphin) rejects KLN admin credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin@kln',
        password: 'klnprelims@2026',
        targetEvent: 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89', // Dolphin ID
      }),
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'Invalid credentials');
  });

  // ── 3. KLN Login & Scoped Access ──
  let klnCookie = '';
  await test('KLN Admin logs in successfully and lands at /kln/dashboard', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin@kln',
        password: 'klnprelims@2026',
        targetEvent: '0542016a-b443-421e-9ae0-a4787697b945',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.user.username, 'admin@kln');
    assert.strictEqual(data.user.role, 'event_admin');
    assert.strictEqual(data.user.eventId, '0542016a-b443-421e-9ae0-a4787697b945');
    assert.strictEqual(data.user.eventName, 'KLN PRELIMS');
    assert.strictEqual(data.redirectTo, '/kln/dashboard');

    const rawCookies = res.headers.get('set-cookie');
    assert.ok(rawCookies, 'Set-Cookie header missing');
    klnCookie = rawCookies.split(';')[0];
  });

  await test('KLN Admin fetches only KLN PRELIMS from /api/event-insights/events', async () => {
    const res = await fetch(`${BASE_URL}/api/event-insights/events`, {
      headers: { Cookie: klnCookie },
    });
    assert.strictEqual(res.status, 200);
    const events = await res.json();
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].id, '0542016a-b443-421e-9ae0-a4787697b945');
    assert.strictEqual(events[0].name, 'KLN PRELIMS');
    assert.strictEqual(events[0].student_count, 107);
  });

  await test('KLN Admin can access KLN overview and participants (107 count)', async () => {
    const overviewRes = await fetch(`${BASE_URL}/api/event-insights/0542016a-b443-421e-9ae0-a4787697b945/overview`, {
      headers: { Cookie: klnCookie },
    });
    assert.strictEqual(overviewRes.status, 200);
    const overview = await overviewRes.json();
    assert.strictEqual(overview.name, 'KLN PRELIMS');
    assert.strictEqual(overview.total_participants, 107);

    const rosterRes = await fetch(`${BASE_URL}/api/event-insights/0542016a-b443-421e-9ae0-a4787697b945/participants`, {
      headers: { Cookie: klnCookie },
    });
    assert.strictEqual(rosterRes.status, 200);
    const roster = await rosterRes.json();
    assert.strictEqual(roster.total, 107);
  });

  await test('KLN Admin is DENIED access to Dolphin event (403 Forbidden)', async () => {
    const res = await fetch(`${BASE_URL}/api/event-insights/e4bd56c6-924d-49bb-9c3a-e2c74eab9f89/overview`, {
      headers: { Cookie: klnCookie },
    });
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);

    const rosterRes = await fetch(`${BASE_URL}/api/event-insights/e4bd56c6-924d-49bb-9c3a-e2c74eab9f89/participants`, {
      headers: { Cookie: klnCookie },
    });
    assert.strictEqual(rosterRes.status, 403, `Expected 403 on roster, got ${rosterRes.status}`);
  });

  await test('KLN Admin has access to all 4 preserved routes', async () => {
    const routes = ['/admin-overview', '/zone-dashboard', '/parent-view', '/user-management', '/kln/dashboard'];
    for (const r of routes) {
      const res = await fetch(`${BASE_URL}${r}`, { headers: { Cookie: klnCookie } });
      assert.strictEqual(res.status, 200, `Expected 200 on ${r}, got ${res.status}`);
    }
  });

  await test('KLN Admin cannot access Dolphin landing route /dolphin/dashboard', async () => {
    const res = await fetch(`${BASE_URL}/dolphin/dashboard`, {
      headers: { Cookie: klnCookie },
      redirect: 'manual',
    });
    assert.ok(res.status === 302 || res.status === 403, `Expected 302 or 403, got ${res.status}`);
  });

  await test('KLN Admin School Dashboard is scoped to KLN (107 students)', async () => {
    const summaryRes = await fetch(`${BASE_URL}/api/zone-dashboard/summary?zone=KLN%20Vidyalaya%20CBSE%20Senior%20Secondary%20School`, {
      headers: { Cookie: klnCookie },
    });
    assert.strictEqual(summaryRes.status, 200);
    const summary = await summaryRes.json();
    assert.strictEqual(summary.total_students, 107);

    const zonesRes = await fetch(`${BASE_URL}/api/zone-dashboard/zones`, {
      headers: { Cookie: klnCookie },
    });
    assert.strictEqual(zonesRes.status, 200);
    const zones = await zonesRes.json();
    assert.strictEqual(zones.length, 1);
    assert.strictEqual(zones[0].name, 'KLN Vidyalaya CBSE Senior Secondary School');
  });

  // ── 4. Dolphin Login & Scoped Access ──
  let dolphinCookie = '';
  await test('Dolphin Admin logs in successfully and lands at /dolphin/dashboard', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin@dolphin',
        password: 'dolphinprelims@2026',
        targetEvent: 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.user.username, 'admin@dolphin');
    assert.strictEqual(data.user.role, 'event_admin');
    assert.strictEqual(data.user.eventId, 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89');
    assert.strictEqual(data.user.eventName, 'Dolphin PRELIMS');
    assert.strictEqual(data.redirectTo, '/dolphin/dashboard');

    const rawCookies = res.headers.get('set-cookie');
    assert.ok(rawCookies, 'Set-Cookie header missing');
    dolphinCookie = rawCookies.split(';')[0];
  });

  await test('Dolphin Admin fetches only Dolphin PRELIMS from /api/event-insights/events', async () => {
    const res = await fetch(`${BASE_URL}/api/event-insights/events`, {
      headers: { Cookie: dolphinCookie },
    });
    assert.strictEqual(res.status, 200);
    const events = await res.json();
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].id, 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89');
    assert.strictEqual(events[0].name, 'Dolphin PRELIMS');
    assert.strictEqual(events[0].student_count, 555);
  });

  await test('Dolphin Admin can access Dolphin overview and participants (555 count)', async () => {
    const overviewRes = await fetch(`${BASE_URL}/api/event-insights/e4bd56c6-924d-49bb-9c3a-e2c74eab9f89/overview`, {
      headers: { Cookie: dolphinCookie },
    });
    assert.strictEqual(overviewRes.status, 200);
    const overview = await overviewRes.json();
    assert.strictEqual(overview.name, 'Dolphin PRELIMS');
    assert.strictEqual(overview.total_participants, 555);

    const rosterRes = await fetch(`${BASE_URL}/api/event-insights/e4bd56c6-924d-49bb-9c3a-e2c74eab9f89/participants`, {
      headers: { Cookie: dolphinCookie },
    });
    assert.strictEqual(rosterRes.status, 200);
    const roster = await rosterRes.json();
    assert.strictEqual(roster.total, 555);
  });

  await test('Dolphin Admin is DENIED access to KLN event (403 Forbidden)', async () => {
    const res = await fetch(`${BASE_URL}/api/event-insights/0542016a-b443-421e-9ae0-a4787697b945/overview`, {
      headers: { Cookie: dolphinCookie },
    });
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);

    const rosterRes = await fetch(`${BASE_URL}/api/event-insights/0542016a-b443-421e-9ae0-a4787697b945/participants`, {
      headers: { Cookie: dolphinCookie },
    });
    assert.strictEqual(rosterRes.status, 403, `Expected 403 on roster, got ${rosterRes.status}`);
  });

  await test('Dolphin Admin has access to all 4 preserved routes', async () => {
    const routes = ['/admin-overview', '/zone-dashboard', '/parent-view', '/user-management', '/dolphin/dashboard'];
    for (const r of routes) {
      const res = await fetch(`${BASE_URL}${r}`, { headers: { Cookie: dolphinCookie } });
      assert.strictEqual(res.status, 200, `Expected 200 on ${r}, got ${res.status}`);
    }
  });

  await test('Dolphin Admin cannot access KLN landing route /kln/dashboard', async () => {
    const res = await fetch(`${BASE_URL}/kln/dashboard`, {
      headers: { Cookie: dolphinCookie },
      redirect: 'manual',
    });
    assert.ok(res.status === 302 || res.status === 403, `Expected 302 or 403, got ${res.status}`);
  });

  await test('Dolphin Admin School Dashboard is scoped to Dolphin (555 students)', async () => {
    const summaryRes = await fetch(`${BASE_URL}/api/zone-dashboard/summary?zone=Dolphin%20PRELIMS`, {
      headers: { Cookie: dolphinCookie },
    });
    assert.strictEqual(summaryRes.status, 200);
    const summary = await summaryRes.json();
    assert.strictEqual(summary.total_students, 555);

    const zonesRes = await fetch(`${BASE_URL}/api/zone-dashboard/zones`, {
      headers: { Cookie: dolphinCookie },
    });
    assert.strictEqual(zonesRes.status, 200);
    const zones = await zonesRes.json();
    assert.strictEqual(zones.length, 1);
    assert.strictEqual(zones[0].name, 'Dolphin PRELIMS');
  });

  // ── 5. User Management Isolation ──
  await test('KLN Admin and Dolphin Admin user rosters are completely isolated', async () => {
    const klnUsersRes = await fetch(`${BASE_URL}/api/auth/users`, { headers: { Cookie: klnCookie } });
    assert.strictEqual(klnUsersRes.status, 200);
    const klnUsers = await klnUsersRes.json();
    assert.ok(klnUsers.some(u => u.username === 'admin@kln'));
    assert.ok(!klnUsers.some(u => u.username === 'admin@dolphin'), 'KLN Admin should NOT see Dolphin Admin!');

    const dolphinUsersRes = await fetch(`${BASE_URL}/api/auth/users`, { headers: { Cookie: dolphinCookie } });
    assert.strictEqual(dolphinUsersRes.status, 200);
    const dolphinUsers = await dolphinUsersRes.json();
    assert.ok(dolphinUsers.some(u => u.username === 'admin@dolphin'));
    assert.ok(!dolphinUsers.some(u => u.username === 'admin@kln'), 'Dolphin Admin should NOT see KLN Admin!');
  });

  // ── 6. UI Polish Assertions ──
  await test('Login UI: heading removed, subtitle preserved, badges removed, placeholders empty', async () => {
    const loginRes = await fetch(`${BASE_URL}/login`);
    const html = await loginRes.text();
    assert.strictEqual(html.includes('Choose Your Event Portal'), false, 'Main heading must be removed');
    assert.strictEqual(
      html.includes('Log in with your event credentials to access authorized participant rosters, grade analytics, and live performance metrics.'),
      true,
      'Intro subtitle must remain'
    );
    assert.strictEqual(html.includes('KLN School Cohort'), false, 'KLN School Cohort badge must be removed');
    assert.strictEqual(html.includes('class="card-badge"'), false, 'Card badges must be completely removed');
    assert.strictEqual(html.includes('e.g. admin@kln'), false, 'KLN username placeholder must be removed');
    assert.strictEqual(html.includes('e.g. admin@dolphin'), false, 'Dolphin username placeholder must be removed');
    assert.strictEqual(html.includes('id="kln-username"'), true, 'KLN username input must exist');
    assert.strictEqual(html.includes('id="dolphin-username"'), true, 'Dolphin username input must exist');
  });

  await test('Active Event Header: non-interactive header label and display element exist in Admin Overview', async () => {
    const overviewRes = await fetch(`${BASE_URL}/admin-overview`, { headers: { Cookie: klnCookie } });
    const html = await overviewRes.text();
    assert.strictEqual(html.includes('id="active-event-display"'), true, 'active-event-display element must exist');
    assert.strictEqual(html.includes('id="label-active-event"'), true, 'label-active-event element must exist');
    assert.strictEqual(html.includes('Active Event'), true, 'Active Event text label must exist');
  });

  // ── 7. Logout Behavior ──
  await test('Logout invalidates session and revokes access', async () => {
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: klnCookie },
    });
    assert.strictEqual(logoutRes.status, 200);

    const postLogoutRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: klnCookie },
    });
    assert.strictEqual(postLogoutRes.status, 401);
  });

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
