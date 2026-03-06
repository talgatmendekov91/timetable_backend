// src/routes/claudeRoutes.js
// Secure proxy — keeps ANTHROPIC_API_KEY on the server, never exposed to browser
const express = require('express');
const router  = express.Router();
const { authenticateToken } = require('../middleware/auth');

router.post('/fix-schedule', authenticateToken, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ success: false, error: 'prompt required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'ANTHROPIC_API_KEY not set in Railway environment variables',
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error?.message || 'Anthropic API error',
      });
    }

    const text = (data.content || []).map(b => b.text || '').join('');
    res.json({ success: true, text });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;