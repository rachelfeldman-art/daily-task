require('dotenv/config');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, sql } = require('./src/db');
const { items, learningData, customCategories } = require('./src/schema');
const { eq, asc, desc } = require('drizzle-orm');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Ensure DATABASE_URL is set (db.js throws if not, but double-check for clarity)
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and add your Neon connection string.');
  process.exit(1);
}

// Initialize database tables (idempotent; safe if you use Drizzle migrations instead)
async function initDB() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS items (
      id BIGINT PRIMARY KEY,
      text TEXT NOT NULL,
      completed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      type VARCHAR(10) NOT NULL DEFAULT 'task',
      category VARCHAR(100) NOT NULL DEFAULT 'personal',
      priority VARCHAR(10) NOT NULL DEFAULT 'medium',
      due_date DATE,
      notes TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0
    )`;
    await sql`CREATE TABLE IF NOT EXISTS learning_data (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      type VARCHAR(10) NOT NULL,
      category VARCHAR(100) NOT NULL,
      priority VARCHAR(10) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS custom_categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL
    )`;
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Init DB error:', err);
    throw err;
  }
}

function rowToItem(row) {
  return {
    id: Number(row.id),
    text: row.text,
    completed: row.completed,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    type: row.type,
    category: row.category,
    priority: row.priority,
    dueDate: row.due_date ? (typeof row.due_date === 'string' ? row.due_date : row.due_date.toISOString().split('T')[0]) : null,
    notes: row.notes || '',
    order: row.sort_order
  };
}

// ─── Items API ───

app.get('/api/items', async (req, res) => {
  try {
    const rows = await db.select().from(items).orderBy(asc(items.sort_order), desc(items.created_at));
    res.json(rows.map(rowToItem));
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

app.post('/api/items', async (req, res) => {
  const bodyItems = Array.isArray(req.body) ? req.body : [req.body];
  try {
    const inserted = [];
    for (const item of bodyItems) {
      const [row] = await db.insert(items).values({
        id: item.id,
        text: item.text,
        completed: item.completed || false,
        created_at: item.createdAt ? new Date(item.createdAt) : undefined,
        type: item.type || 'task',
        category: item.category || 'personal',
        priority: item.priority || 'medium',
        due_date: item.dueDate || null,
        notes: item.notes || '',
        sort_order: item.order ?? 0
      }).returning();
      inserted.push(row ? rowToItem(row) : { ...item, id: item.id });
    }
    res.json(inserted);
  } catch (err) {
    console.error('Error creating items:', err);
    res.status(500).json({ error: 'Failed to create items' });
  }
});

app.put('/api/items/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { text, completed, type, category, priority, dueDate, notes, order } = req.body;
  try {
    const result = await db.update(items).set({
      text,
      completed,
      type,
      category,
      priority,
      due_date: dueDate || null,
      notes: notes || '',
      sort_order: order ?? 0
    }).where(eq(items.id, id)).returning();
    if (result.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(rowToItem(result[0]));
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

app.put('/api/items', async (req, res) => {
  const bodyItems = req.body;
  try {
    for (const item of bodyItems) {
      await db.update(items).set({
        text: item.text,
        completed: item.completed,
        type: item.type,
        category: item.category,
        priority: item.priority,
        due_date: item.dueDate || null,
        notes: item.notes || '',
        sort_order: item.order ?? 0
      }).where(eq(items.id, item.id));
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error bulk updating items:', err);
    res.status(500).json({ error: 'Failed to update items' });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(items).where(eq(items.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// ─── Learning Data API ───

app.get('/api/learning-data', async (req, res) => {
  try {
    const rows = await db.select().from(learningData).orderBy(desc(learningData.created_at));
    res.json(rows.map(row => ({
      text: row.text,
      type: row.type,
      category: row.category,
      priority: row.priority,
      timestamp: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
    })));
  } catch (err) {
    console.error('Error fetching learning data:', err);
    res.status(500).json({ error: 'Failed to fetch learning data' });
  }
});

app.post('/api/learning-data', async (req, res) => {
  const { text, type, category, priority } = req.body;
  try {
    const [row] = await db.insert(learningData).values({ text, type, category, priority }).returning();
    res.json(row || { text, type, category, priority });
  } catch (err) {
    console.error('Error saving learning data:', err);
    res.status(500).json({ error: 'Failed to save learning data' });
  }
});

// ─── Custom Categories API ───

app.get('/api/custom-categories', async (req, res) => {
  try {
    const rows = await db.select({ name: customCategories.name }).from(customCategories).orderBy(customCategories.id);
    res.json(rows.map(r => r.name));
  } catch (err) {
    console.error('Error fetching custom categories:', err);
    res.status(500).json({ error: 'Failed to fetch custom categories' });
  }
});

app.post('/api/custom-categories', async (req, res) => {
  const { name } = req.body;
  try {
    await db.insert(customCategories).values({ name }).onConflictDoNothing({ target: customCategories.name });
    res.json({ success: true });
  } catch (err) {
    console.error('Error adding custom category:', err);
    res.status(500).json({ error: 'Failed to add custom category' });
  }
});

app.delete('/api/custom-categories/:name', async (req, res) => {
  const { name } = req.params;
  try {
    await db.delete(customCategories).where(eq(customCategories.name, name));
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting custom category:', err);
    res.status(500).json({ error: 'Failed to delete custom category' });
  }
});

// ─── AI categorization proxy (keeps ANTHROPIC_API_KEY server-side) ───

app.post('/api/categorize', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Categorization unavailable; ANTHROPIC_API_KEY not set in .env' });
  }
  const { body } = req;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (err) {
    console.error('Categorization proxy error:', err);
    res.status(500).json({ error: 'Categorization request failed' });
  }
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
