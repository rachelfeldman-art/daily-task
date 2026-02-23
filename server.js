require('dotenv/config');
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const { clerkMiddleware, requireAuth } = require('@clerk/express');
const { z } = require('zod');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());
app.use(express.static(path.join(__dirname)));

// Protect all API routes - require authentication
app.use('/api', requireAuth());

// PostgreSQL connection
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ─── Validation Schemas ───

const itemSchema = z.object({
  id: z.number().int().positive(),
  text: z.string().min(1).max(1000),
  completed: z.boolean().optional().default(false),
  createdAt: z.string().optional(),
  type: z.enum(['task', 'idea']),
  category: z.string().min(1).max(100),
  priority: z.enum(['high', 'medium', 'low']),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(5000).optional().default(''),
  order: z.number().int().min(0).optional().default(0)
});

const itemUpdateSchema = z.object({
  text: z.string().min(1).max(1000),
  completed: z.boolean(),
  type: z.enum(['task', 'idea']),
  category: z.string().min(1).max(100),
  priority: z.enum(['high', 'medium', 'low']),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(5000).optional(),
  order: z.number().int().min(0).optional()
});

const learningDataSchema = z.object({
  text: z.string().min(1).max(1000),
  type: z.enum(['task', 'idea']),
  category: z.string().min(1).max(100),
  priority: z.enum(['high', 'medium', 'low'])
});

const customCategorySchema = z.object({
  name: z.string().min(1).max(100).toLowerCase(),
  emoji: z.string().min(1).max(10).optional().default('📌')
});

const customCategoryUpdateSchema = z.object({
  name: z.string().min(1).max(100).toLowerCase().optional(),
  emoji: z.string().min(1).max(10).optional()
}).refine(data => data.name !== undefined || data.emoji !== undefined, {
  message: 'At least one of name or emoji must be provided'
});

const categorizeRequestSchema = z.object({
  model: z.string(),
  max_tokens: z.number().int().min(1).max(4000),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(10000)
  })).min(1)
});

// Validation middleware factory
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const data = source === 'body' ? req.body : req.params;
      const validated = schema.parse(data);
      if (source === 'body') {
        req.body = validated;
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

// Initialize database tables
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
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
      );

      CREATE TABLE IF NOT EXISTS learning_data (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        type VARCHAR(10) NOT NULL,
        category VARCHAR(100) NOT NULL,
        priority VARCHAR(10) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS custom_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL
      );

      -- Add user_id column to all tables (idempotent)
      ALTER TABLE items ADD COLUMN IF NOT EXISTS user_id TEXT;
      ALTER TABLE learning_data ADD COLUMN IF NOT EXISTS user_id TEXT;
      ALTER TABLE custom_categories ADD COLUMN IF NOT EXISTS user_id TEXT;
      ALTER TABLE custom_categories ADD COLUMN IF NOT EXISTS emoji VARCHAR(20) DEFAULT '📌';
    `);

    // Drop the old unique constraint on custom_categories.name (now scoped per user)
    await client.query(`
      ALTER TABLE custom_categories DROP CONSTRAINT IF EXISTS custom_categories_name_key;
    `).catch(() => {});

    // Add per-user unique constraint on custom_categories(name, user_id)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS custom_categories_name_user_id_idx ON custom_categories (name, user_id);
    `).catch(() => {});

    console.log('Database tables initialized');
  } finally {
    client.release();
  }
}

// ─── Claim unclaimed data for the authenticated user ───
// Only claims rows that have no user_id (one-time migration for pre-auth data)
// Checks the DB each time until there's nothing left to claim, then stops
let unclaimedDataClaimed = false;
app.use('/api', async (req, res, next) => {
  if (unclaimedDataClaimed) return next();
  const userId = req.auth.userId;
  try {
    const result = await pool.query('SELECT COUNT(*) FROM items WHERE user_id IS NULL');
    const unclaimedCount = parseInt(result.rows[0].count);
    if (unclaimedCount > 0) {
      await pool.query('UPDATE items SET user_id = $1 WHERE user_id IS NULL', [userId]);
      await pool.query('UPDATE learning_data SET user_id = $1 WHERE user_id IS NULL', [userId]);
      await pool.query('UPDATE custom_categories SET user_id = $1 WHERE user_id IS NULL', [userId]);
      console.log(`Claimed ${unclaimedCount} unclaimed items for user ${userId}`);
    } else {
      console.log('No unclaimed data to migrate');
    }
    unclaimedDataClaimed = true;
  } catch (err) {
    console.error('Error claiming unclaimed data:', err);
  }
  next();
});

// ─── Items API ───

// GET all items
app.get('/api/items', async (req, res) => {
  const userId = req.auth.userId;
  try {
    const result = await pool.query('SELECT * FROM items WHERE user_id = $1 ORDER BY sort_order ASC, created_at DESC', [userId]);
    const items = result.rows.map(row => ({
      id: Number(row.id),
      text: row.text,
      completed: row.completed,
      createdAt: row.created_at.toISOString(),
      type: row.type,
      category: row.category,
      priority: row.priority,
      dueDate: row.due_date ? row.due_date.toISOString().split('T')[0] : null,
      notes: row.notes || '',
      order: row.sort_order
    }));
    res.json(items);
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// POST new item(s)
app.post('/api/items', validate(z.union([itemSchema, z.array(itemSchema)])), async (req, res) => {
  const userId = req.auth.userId;
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = [];
    for (const item of items) {
      const result = await client.query(
        `INSERT INTO items (id, text, completed, created_at, type, category, priority, due_date, notes, sort_order, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          item.id,
          item.text,
          item.completed || false,
          item.createdAt || new Date().toISOString(),
          item.type || 'task',
          item.category || 'personal',
          item.priority || 'medium',
          item.dueDate || null,
          item.notes || '',
          item.order || 0,
          userId
        ]
      );
      inserted.push(result.rows[0]);
    }
    await client.query('COMMIT');
    res.json(inserted);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating items:', err);
    res.status(500).json({ error: 'Failed to create items' });
  } finally {
    client.release();
  }
});

// PUT update item
app.put('/api/items/:id', validate(itemUpdateSchema), async (req, res) => {
  const userId = req.auth.userId;
  const { id } = req.params;
  const { text, completed, type, category, priority, dueDate, notes, order } = req.body;

  // Validate ID is a valid number
  const itemId = parseInt(id);
  if (isNaN(itemId) || itemId <= 0) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }

  try {
    const result = await pool.query(
      `UPDATE items SET text=$1, completed=$2, type=$3, category=$4, priority=$5, due_date=$6, notes=$7, sort_order=$8
       WHERE id=$9 AND user_id=$10 RETURNING *`,
      [text, completed, type, category, priority, dueDate || null, notes || '', order || 0, itemId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found or unauthorized' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// PUT bulk update items (for reordering)
app.put('/api/items', validate(z.array(itemSchema).min(1).max(1000)), async (req, res) => {
  const userId = req.auth.userId;
  const items = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      await client.query(
        `UPDATE items SET text=$1, completed=$2, type=$3, category=$4, priority=$5, due_date=$6, notes=$7, sort_order=$8
         WHERE id=$9 AND user_id=$10`,
        [item.text, item.completed, item.type, item.category, item.priority, item.dueDate || null, item.notes || '', item.order || 0, item.id, userId]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error bulk updating items:', err);
    res.status(500).json({ error: 'Failed to update items' });
  } finally {
    client.release();
  }
});

// DELETE item
app.delete('/api/items/:id', async (req, res) => {
  const userId = req.auth.userId;
  const { id } = req.params;

  // Validate ID is a valid number
  const itemId = parseInt(id);
  if (isNaN(itemId) || itemId <= 0) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }

  try {
    const result = await pool.query('DELETE FROM items WHERE id=$1 AND user_id=$2 RETURNING id', [itemId, userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found or unauthorized' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// ─── Learning Data API ───

// GET all learning data
app.get('/api/learning-data', async (req, res) => {
  const userId = req.auth.userId;
  try {
    const result = await pool.query('SELECT * FROM learning_data WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    const data = result.rows.map(row => ({
      text: row.text,
      type: row.type,
      category: row.category,
      priority: row.priority,
      timestamp: row.created_at.toISOString()
    }));
    res.json(data);
  } catch (err) {
    console.error('Error fetching learning data:', err);
    res.status(500).json({ error: 'Failed to fetch learning data' });
  }
});

// POST learning data entry
app.post('/api/learning-data', validate(learningDataSchema), async (req, res) => {
  const userId = req.auth.userId;
  const { text, type, category, priority } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO learning_data (text, type, category, priority, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [text, type, category, priority, userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error saving learning data:', err);
    res.status(500).json({ error: 'Failed to save learning data' });
  }
});

// ─── Custom Categories API ───

// GET all custom categories (returns { name, emoji }[])
app.get('/api/custom-categories', async (req, res) => {
  const userId = req.auth.userId;
  try {
    const result = await pool.query('SELECT name, emoji FROM custom_categories WHERE user_id = $1 ORDER BY id', [userId]);
    res.json(result.rows.map(r => ({ name: r.name, emoji: r.emoji || '📌' })));
  } catch (err) {
    console.error('Error fetching custom categories:', err);
    res.status(500).json({ error: 'Failed to fetch custom categories' });
  }
});

// POST new custom category
app.post('/api/custom-categories', validate(customCategorySchema), async (req, res) => {
  const userId = req.auth.userId;
  const { name, emoji } = req.body;
  const emojiVal = (emoji && String(emoji).trim()) ? String(emoji).trim().slice(0, 10) : '📌';
  try {
    await pool.query(
      'INSERT INTO custom_categories (name, emoji, user_id) VALUES ($1, $2, $3)',
      [name, emojiVal, userId]
    );
    res.json({ success: true });
  } catch (err) {
    // Check for unique constraint violation
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Category already exists' });
    }
    console.error('Error adding custom category:', err);
    res.status(500).json({ error: 'Failed to add custom category' });
  }
});

// PUT update custom category (name and/or emoji); :name is the current name
app.put('/api/custom-categories/:name', validate(customCategoryUpdateSchema), async (req, res) => {
  const userId = req.auth.userId;
  const oldName = decodeURIComponent(req.params.name);

  // Validate oldName
  if (!oldName || oldName.length === 0 || oldName.length > 100) {
    return res.status(400).json({ error: 'Invalid category name in URL' });
  }

  const { name: newName, emoji: newEmoji } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updates = [];
    const values = [];
    let n = 1;
    if (newName != null && String(newName).trim() !== '' && String(newName).trim() !== oldName) {
      updates.push(`name = $${n++}`);
      values.push(String(newName).trim());
    }
    if (newEmoji !== undefined) {
      updates.push(`emoji = $${n++}`);
      values.push((newEmoji && String(newEmoji).trim()) ? String(newEmoji).trim().slice(0, 10) : '📌');
    }
    if (updates.length === 0) {
      await client.query('COMMIT');
      return res.json({ success: true });
    }
    values.push(oldName, userId);
    const result = await client.query(
      `UPDATE custom_categories SET ${updates.join(', ')} WHERE name = $${n} AND user_id = $${n + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Category not found or unauthorized' });
    }

    if (newName != null && String(newName).trim() !== '' && String(newName).trim() !== oldName) {
      const nameVal = String(newName).trim();
      await client.query('UPDATE items SET category = $1 WHERE category = $2 AND user_id = $3', [nameVal, oldName, userId]);
      await client.query('UPDATE learning_data SET category = $1 WHERE category = $2 AND user_id = $3', [nameVal, oldName, userId]);
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    console.error('Error updating custom category:', err);
    res.status(500).json({ error: 'Failed to update custom category' });
  } finally {
    client.release();
  }
});

// DELETE custom category
app.delete('/api/custom-categories/:name', async (req, res) => {
  const userId = req.auth.userId;
  const { name } = req.params;
  const categoryName = decodeURIComponent(name);

  // Validate category name
  if (!categoryName || categoryName.length === 0 || categoryName.length > 100) {
    return res.status(400).json({ error: 'Invalid category name' });
  }

  try {
    const result = await pool.query('DELETE FROM custom_categories WHERE name=$1 AND user_id=$2 RETURNING id', [categoryName, userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found or unauthorized' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting custom category:', err);
    res.status(500).json({ error: 'Failed to delete custom category' });
  }
});

// ─── Categorize API (Anthropic proxy) ───

app.post('/api/categorize', validate(categorizeRequestSchema), async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'API key not configured' });
  }

  try {
    // Server-side validation: only allow expected model and cap max_tokens
    const allowedModels = ['claude-sonnet-4-20250514'];
    const body = {
      model: allowedModels.includes(req.body.model) ? req.body.model : allowedModels[0],
      max_tokens: Math.min(Number(req.body.max_tokens) || 2000, 4000),
      messages: req.body.messages,
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
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
    res.status(500).json({ error: 'Failed to reach Anthropic API' });
  }
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
