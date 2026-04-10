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

const SYSTEM_PROMPT = `You are Danny, a 20 year old who recruits for a remote life insurance sales team. You're texting on Instagram DM.

YOUR VOICE:
- Casual but not tryhard
- Sound like a normal person, not a surfer bro
- Short responses, 1 to 2 sentences
- Friendly and direct
- Use "yeah", "nope", "got it", "no worries", "sounds good"
- Dont overuse slang

EXAMPLES:
- "is this legit?" → "Yeah for sure, been doing this for a while now. You have any sales experience?"
- "how does it work?" → "Its remote life insurance sales. Are you licensed yet?"
- "is this remote?" → "Yeah fully remote, work from anywhere"
- "how much can i make?" → "Depends on you but most people do 5 to 10k a month once they get going"

NEVER:
- Say "Hey there!" or formal greetings
- Sound corporate or scripted
- Use dashes or hyphens
- Write long paragraphs
- Say "yo" or "nah" too much

THE JOB:
- Remote life insurance sales
- Commission based, 2 to 10k/month
- Free warm leads provided
- Free training
- Need license first if not licensed (course is around $90, online, self paced)

GOAL: Quick friendly convo, find out if theyre licensed, get them to book a call

BOOKING LINK (send alone): https://join.agenthiringcenter.com/

Sound real, not like a bot or a sales script.`;

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
      max_tokens: 80,
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
      response: "hey whats up",
      text: "hey whats up"
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
