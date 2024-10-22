require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { OpenAI } = require("openai");
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const db = new sqlite3.Database('./chat.db', (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to the SQLite database.');
    db.run("DROP TABLE IF EXISTS messages", (err) => {
      if (err) {
        console.error('Error dropping table:', err);
      } else {
        console.log('Existing table dropped successfully');
        db.run(`CREATE TABLE messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          is_sent INTEGER NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            console.error('Error creating table:', err);
          } else {
            console.log('Table created successfully');
          }
        });
      }
    });
  }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get('/api/messages', (req, res) => {
  db.all('SELECT * FROM messages ORDER BY timestamp ASC', [], (err, rows) => {
    if (err) {
      console.error('Error fetching messages:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/messages', async (req, res) => {
  console.log('Received message:', req.body);
  const { content, isSent } = req.body;
  
  if (!content || typeof isSent !== 'boolean') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  db.run('INSERT INTO messages (content, is_sent) VALUES (?, ?)', [content, isSent ? 1 : 0], async function(err) {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Database error', details: err.message });
      return;
    }

    const userMessage = { id: this.lastID, content, is_sent: isSent };

    if (!isSent) {
      return res.status(201).json(userMessage);
    }

    try {
      console.log('Sending request to OpenAI API...');
      console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');
      
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key is not set');
      }

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: content }
        ],
        max_tokens: 150,
        n: 1,
        temperature: 0.8,
      });
      console.log('Received response from OpenAI API:', JSON.stringify(aiResponse, null, 2));

      const aiMessage = aiResponse.choices[0].message.content.trim();

      db.run('INSERT INTO messages (content, is_sent) VALUES (?, ?)', [aiMessage, 0], function(err) {
        if (err) {
          console.error('Database error:', err);
          res.status(500).json({ error: 'Database error', details: err.message });
          return;
        }

        res.status(201).json({
          userMessage: userMessage,
          aiMessage: { id: this.lastID, content: aiMessage, is_sent: 0 }
        });
      });
    } catch (error) {
      console.error('Error generating AI response:', error);
      res.status(500).json({ error: 'Error generating AI response', details: error.message });
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});