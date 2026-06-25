// Quick API smoke test
const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 5000, path, method: 'GET' };
    const req = http.request(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.end();
  });
}

function post(path, payload, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const opts = {
      hostname: 'localhost', port: 5000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...(token && { Authorization: `Bearer ${token}` }) }
    };
    const req = http.request(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('\n=== TimeTable Pro — API Smoke Test ===\n');

  // 1. Health check
  const health = await get('/api/health');
  console.log('[1] Health:', health.status === 200 ? '✅ OK' : '❌ FAIL', health.body.status);

  // 2. Login
  const loginRes = await post('/api/auth/login', { username: 'admin', password: 'admin123' });
  const token = loginRes.body.token;
  console.log('[2] Login:', loginRes.status === 200 && token ? `✅ Got JWT (${token.slice(0, 20)}...)` : '❌ FAIL ' + JSON.stringify(loginRes.body));
  if (!token) return;

  // 3. Stats check
  const statsRes = await new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 5000, path: '/api/timetable/stats', method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    };
    const req = http.request(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.end();
  });
  console.log('[3] Stats:', statsRes.status === 200 ? '✅' : '❌', JSON.stringify(statsRes.body));

  // 4. Generate All
  const genAllRes = await post('/api/timetable/generate-all', {}, token);
  console.log('[4] Generate All:', genAllRes.status === 200 ? '✅' : '❌', genAllRes.body.message);
  if (genAllRes.body.details) {
    genAllRes.body.details.forEach(d => console.log('   ', d));
  }

  // 5. Stats after generation
  const statsAfter = await new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 5000, path: '/api/timetable/stats', method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    };
    const req = http.request(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.end();
  });
  console.log('[5] Stats after gen:', statsAfter.status === 200 ? '✅' : '❌');
  console.log('   Assignments:', statsAfter.body.entryCount, '(should be > 0)');

  console.log('\n=== Smoke Test Complete ===\n');
}

main().catch(e => console.error('Test error:', e.message));
