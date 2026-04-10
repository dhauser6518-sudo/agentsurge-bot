const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({ extended: true }));

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const conversations = new Map();

const SYSTEM_PROMPT = `You are a 20 year old life insurance recruiter actively building a sales team. You sound casual, confident, and human. Short messages. Never robotic. You use phrases like "got you", "yeah for sure", "bet". Your goal is to guide leads to book a call. Keep responses under 20 words. Booking link: https://join.agenthiringcenter.com/`;

app.post('/webhook', async (req, res) => {
  try {
    console.log('Raw body:', req.body);
    console.log('Body type:', typeof req.body);
    
    let message = 'hello';
    let userId = 'unknown';
    let name = 'friend';
    
    // Handle any format ManyChat sends
    if (typeof req.body === 'object') {
      message = req.body.message || req.body.last_input_text || req.body.text || JSON.stringify(req.body).slice(0,50) || 'hello';
      userId = req.body.user_id || req.body.contact_id || req.body.id || 'unknown';
      name = req.body.name || req.body.first_name || 'friend';
    } else if (typeof req.body === 'string') {
      message = req.body.slice(0, 100) || 'hello';
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }]
    });

    const reply = response.content[0].text.trim();
    
    // Return in multiple formats ManyChat might expect
    res.json({ 
      response: reply,
      text: reply,
      message: reply,
      messages: [{ text: reply }]
    });

  } catch (error) {
    console.error('Error:', error);
    res.json({ 
      response: "hey whats up",
      text: "hey whats up",
      message: "hey whats up"
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
