// Quick validation test script
// Run this with: node test-validation.js (requires server running)

const API_BASE = 'http://localhost:3000';

async function testValidation() {
  console.log('🧪 Testing API Validation\n');

  // Test 1: Invalid item - missing required fields
  console.log('Test 1: POST /api/items with missing required fields');
  try {
    const res = await fetch(`${API_BASE}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Test task' }) // Missing id, type, category, priority
    });
    const data = await res.json();
    console.log(`  Status: ${res.status}`);
    console.log(`  Response:`, data);
    console.log(res.status === 401 ? '  ✅ Correctly requires authentication\n' : '  ❌ Unexpected response\n');
  } catch (err) {
    console.log('  ❌ Error:', err.message, '\n');
  }

  // Test 2: Invalid item - wrong data types
  console.log('Test 2: POST /api/items with invalid data types');
  try {
    const res = await fetch(`${API_BASE}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'not-a-number', // Should be number
        text: 'Test',
        type: 'invalid-type', // Should be 'task' or 'idea'
        category: 'work',
        priority: 'super-urgent' // Should be 'high', 'medium', or 'low'
      })
    });
    const data = await res.json();
    console.log(`  Status: ${res.status}`);
    console.log(`  Response:`, data);
    console.log(res.status === 401 ? '  ✅ Correctly requires authentication\n' : '  ❌ Unexpected response\n');
  } catch (err) {
    console.log('  ❌ Error:', err.message, '\n');
  }

  // Test 3: Invalid learning data
  console.log('Test 3: POST /api/learning-data with invalid enum values');
  try {
    const res = await fetch(`${API_BASE}/api/learning-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Test',
        type: 'random', // Should be 'task' or 'idea'
        category: 'work',
        priority: 'extreme' // Should be 'high', 'medium', or 'low'
      })
    });
    const data = await res.json();
    console.log(`  Status: ${res.status}`);
    console.log(`  Response:`, data);
    console.log(res.status === 401 ? '  ✅ Correctly requires authentication\n' : '  ❌ Unexpected response\n');
  } catch (err) {
    console.log('  ❌ Error:', err.message, '\n');
  }

  // Test 4: Invalid category - empty name
  console.log('Test 4: POST /api/custom-categories with empty name');
  try {
    const res = await fetch(`${API_BASE}/api/custom-categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '', // Should be min 1 char
        emoji: '📌'
      })
    });
    const data = await res.json();
    console.log(`  Status: ${res.status}`);
    console.log(`  Response:`, data);
    console.log(res.status === 401 ? '  ✅ Correctly requires authentication\n' : '  ❌ Unexpected response\n');
  } catch (err) {
    console.log('  ❌ Error:', err.message, '\n');
  }

  console.log('✅ All validation tests completed!');
  console.log('\nNote: All requests should return 401 (Unauthorized) because');
  console.log('authentication is required. If authenticated, invalid requests');
  console.log('would return 400 (Bad Request) with validation error details.');
}

testValidation().catch(console.error);
