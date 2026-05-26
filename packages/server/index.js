const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mysql = require('mysql2/promise');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { simpleGit } = require('simple-git');
const axios = require('axios');

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/terminal' });

// Database
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'cyberpwr_user',
  password: process.env.DB_PASSWORD || 'StrongP@ssw0rd',
  database: process.env.DB_NAME || 'cyberpwr_db',
  waitForConnections: true,
  connectionLimit: 10,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(morgan('combined'));

// Storage
const storageDir = path.join(__dirname, '../storage');
if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
app.use('/storage', express.static(storageDir));
const upload = multer({ dest: storageDir });

// Auth middleware
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    const [users] = await pool.query('SELECT id, username FROM users WHERE id = ?', [decoded.userId]);
    if (users.length === 0) return res.status(401).json({ error: 'User not found' });
    req.user = users[0];
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// AI Providers (10+)
const AI_PROVIDERS = {
  openai: { url: 'https://api.openai.com/v1/chat/completions', key: process.env.AI_OPENAI_KEY, model: 'gpt-3.5-turbo' },
  gemini: { url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.AI_GEMINI_KEY}`, key: process.env.AI_GEMINI_KEY, model: 'gemini-pro' },
  cohere: { url: 'https://api.cohere.ai/v1/generate', key: process.env.AI_COHERE_KEY, model: 'command' },
  huggingface: { url: 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', key: process.env.AI_HUGGINGFACE_KEY, model: 'mistral' },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.AI_GROQ_KEY, model: 'mixtral-8x7b-32768' },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', key: process.env.AI_MISTRAL_KEY, model: 'mistral-tiny' },
  anthropic: { url: 'https://api.anthropic.com/v1/messages', key: process.env.AI_ANTHROPIC_KEY, model: 'claude-3-haiku-20240307' },
  replicate: { url: 'https://api.replicate.com/v1/predictions', key: process.env.AI_REPLICATE_KEY, model: 'meta/llama-2-70b-chat' },
  together: { url: 'https://api.together.xyz/v1/chat/completions', key: process.env.AI_TOGETHER_KEY, model: 'togethercomputer/llama-2-70b-chat' },
  deepseek: { url: 'https://api.deepseek.com/v1/chat/completions', key: process.env.AI_DEEPSEEK_KEY, model: 'deepseek-chat' },
};

// Environment API (for creator)
app.get('/api/env', authenticate, (req, res) => {
  if (req.user.username !== 'shaoncmd@gmail.com') return res.status(403).json({ error: 'Forbidden' });
  const env = {};
  for (const key of Object.keys(AI_PROVIDERS)) {
    env[`AI_${key.toUpperCase()}_KEY`] = process.env[`AI_${key.toUpperCase()}_KEY`] || '';
  }
  env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
  res.json(env);
});

app.post('/api/env', authenticate, async (req, res) => {
  if (req.user.username !== 'shaoncmd@gmail.com') return res.status(403).json({ error: 'Forbidden' });
  const updates = req.body;
  const envPath = path.join(__dirname, '../.env');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }
  fs.writeFileSync(envPath, envContent);
  dotenv.config({ override: true });
  res.json({ success: true });
});

// AI chat endpoint
app.post('/api/ai/chat', authenticate, async (req, res) => {
  const { provider, prompt } = req.body;
  const ai = AI_PROVIDERS[provider];
  if (!ai) return res.status(400).json({ error: 'Invalid provider' });
  if (!ai.key) return res.status(401).json({ error: `API key missing for ${provider}` });
  try {
    let response = '';
    switch (provider) {
      case 'openai':
        const oa = await axios.post(ai.url, { model: ai.model, messages: [{ role: 'user', content: prompt }] }, { headers: { 'Authorization': `Bearer ${ai.key}` } });
        response = oa.data.choices[0].message.content;
        break;
      case 'gemini':
        const gm = await axios.post(ai.url, { contents: [{ parts: [{ text: prompt }] }] });
        response = gm.data.candidates[0].content.parts[0].text;
        break;
      case 'cohere':
        const ch = await axios.post(ai.url, { prompt, max_tokens: 500, model: ai.model }, { headers: { 'Authorization': `Bearer ${ai.key}` } });
        response = ch.data.generations[0].text;
        break;
      case 'huggingface':
        const hf = await axios.post(ai.url, { inputs: prompt }, { headers: { 'Authorization': `Bearer ${ai.key}` } });
        response = hf.data[0].generated_text;
        break;
      default:
        const generic = await axios.post(ai.url, { model: ai.model, messages: [{ role: 'user', content: prompt }] }, { headers: { 'Authorization': `Bearer ${ai.key}` } });
        response = generic.data.choices[0].message.content;
    }
    await pool.query('INSERT INTO ai_chats (user_id, provider, prompt, response) VALUES (?, ?, ?, ?)', [req.user.id, provider, prompt, response]);
    res.json({ response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// File upload
app.post('/api/storage/upload', authenticate, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file' });
  const userStorage = path.join(storageDir, req.user.id.toString());
  if (!fs.existsSync(userStorage)) fs.mkdirSync(userStorage, { recursive: true });
  const newPath = path.join(userStorage, file.originalname);
  fs.renameSync(file.path, newPath);
  res.json({ message: 'Uploaded', path: `/storage/${req.user.id}/${file.originalname}` });
});

// Projects
app.get('/api/projects', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM projects WHERE user_id = ?', [req.user.id]);
  res.json(rows);
});
app.post('/api/projects', authenticate, async (req, res) => {
  const { name, content } = req.body;
  const [result] = await pool.query('INSERT INTO projects (user_id, name, content) VALUES (?, ?, ?)', [req.user.id, name, content]);
  res.json({ id: result.insertId });
});
app.put('/api/projects/:id', authenticate, async (req, res) => {
  const { content } = req.body;
  await pool.query('UPDATE projects SET content = ? WHERE id = ? AND user_id = ?', [content, req.params.id, req.user.id]);
  res.json({ success: true });
});
app.delete('/api/projects/:id', authenticate, async (req, res) => {
  await pool.query('DELETE FROM projects WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// GitHub backup
app.post('/api/github/backup', authenticate, async (req, res) => {
  const git = simpleGit(path.join(storageDir, req.user.id.toString()));
  try {
    await git.init();
    await git.add('.');
    await git.commit('Backup from CyberPwr');
    await git.addRemote('origin', `https://${process.env.GITHUB_TOKEN}@github.com/${req.body.repo}.git`);
    await git.push('origin', 'main', ['-f']);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Terminal WebSocket
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ output: 'Terminal ready. Use Linux commands.\n' }));
  ws.on('message', (message) => {
    const command = message.toString();
    exec(command, { cwd: storageDir, shell: '/system/bin/sh' }, (error, stdout, stderr) => {
      const output = stdout + (stderr || '');
      ws.send(JSON.stringify({ output: output || (error ? error.message : 'Command executed') }));
    });
  });
});

// Auth
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    await pool.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
    res.json({ message: 'User created' });
  } catch (err) {
    res.status(400).json({ error: 'Username exists' });
  }
});
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET || 'default_secret', { expiresIn: '7d' });
  res.json({ token, user: { id: rows[0].id, username: rows[0].username } });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
