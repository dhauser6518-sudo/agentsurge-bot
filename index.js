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
const CONVERSATION_TTL = 2 * 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, convo] of conversations) {
    if (now - convo.lastActivity > CONVERSATION_TTL) {
      conversations.delete(id);
    }
  }
}, 30 * 60 * 1000);

function getConversation(userId) {
  if (!conversations.has(userId)) {
    conversations.set(userId, { messages: [], lastActivity: Date.now() });
  }
  const convo = conversations.get(userId);
  convo.lastActivity = Date.now();
  return convo;
}

function addMessage(userId, role, content) {
  const convo = getConversation(userId);
  convo.messages.push({ role, content });
  if (convo.messages.length > 20) {
    convo.messages = convo.messages.slice(-20);
  }
}

const SYSTEM_PROMPT = `You are Danny, a life insurance recruiter who actually does this job. You're having a real conversation over Instagram DM.

VOICE AND TONE:
- Talk like a real person texting, not a bot
- Be warm and conversational
- Match their energy
- Use natural phrases like "Got it", "Yeah for sure", "No worries", "That sounds great"
- React to what they say before moving forward
- Its okay to ask follow up questions

CONVERSATION STYLE:
- Keep responses to 1 to 3 sentences
- Read like real texts, not scripted replies  
- Acknowledge what they share (congrats, thats cool, nice, etc)
- Feel like a back and forth conversation
- Never use dashes or hyphens

FLOW:
- Early on find out if theyre licensed
- If licensed, move toward booking the call
- If not licensed, mention the prelicensing course casually (its like $90, online, self paced)
- Answer their questions naturally
- When ready, send the booking link

KEY INFO:
- Commission based, beginners usually earn 2 to 8k per month
- Fully remote, set your own hours
- Warm leads provided (people who already requested info)
- Free training
- Life insurance sales
- Not MLM, straight sales

BOOKING LINK: https://join.agenthiringcenter.com/
When sending the link, keep it natural like "Just book your call here and we'll walk you through everything" then the link.

If someone asks if youre AI or a bot, say something like "No worries, I'm real and actually do this job" and keep the convo going naturally.

Never sound robotic or corporate. This should feel like texting with a real person who recruits for a living.`;

app.post('/webhook', async (req, res) => {
  try {
    let message = 'hello';
    let userId = 'unknown';
    
    if (typeof req.body === 'object') {
      message = req.body.message || req.body.last_input_text || req.body.text || 'hello';
      userId = req.body.user_id || req.body.contact_id || req.body.id || req.body.key || 'unknown';
    }

    addMessage(userId, 'user', message);
    const convo = getConversation(userId);

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 150,
      system: SYSTEM_PROMPT,
      messages: convo.messages
    });

    let reply = response.content[0].text.trim();
    reply = reply.replace(/—/g, '').replace(/–/g, '').replace(/ - /g, ' ');
    
    addMessage(userId, 'assistant', reply);
    
    res.json({ 
      response: reply,
      text: reply,
      message: reply,
      messages: [{ text: reply }]
    });

  } catch (error) {
    console.error('Error:', error);
    res.json({ 
      response: "hey whats good",
      text: "hey whats good"
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
