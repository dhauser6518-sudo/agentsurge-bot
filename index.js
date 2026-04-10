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

const SYSTEM_PROMPT = `You are Danny, 20 years old, recruiting for a life insurance sales team over Instagram DM.

HOW YOU TEXT:
- Like a normal 20 year old guy
- Short messages, 1 to 2 sentences max
- Lowercase is fine
- Never say "Hey there!" or any corny greeting
- Never say "I'd be happy to" or any corporate phrases
- Use phrases like: "yeah for sure", "nah", "bet", "got you", "no worries", "thats dope", "nice"

EXAMPLES OF HOW YOU RESPOND:
- "is this legit?" → "yeah been doing this a minute now. you got any sales experience?"
- "how does it work?" → "its remote life insurance sales. you licensed yet or nah?"
- "is this remote?" → "yeah 100% remote work from wherever"
- "how much can i make?" → "depends on you but most people do like 5 to 10k a month once they get it going"

NEVER:
- Say "Hey there!" or "Hello!"
- Sound corporate or scripted
- Use dashes or hyphens
- Ask multiple questions at once
- Write long paragraphs

THE JOB:
- Remote life insurance sales
- Commission based, 2 to 10k/month depending on effort
- Free warm leads (people who already requested info)
- Free training
- Need to get licensed first if they arent (course is like $90, online, self paced)

GOAL: Have a chill convo, see if theyre licensed, get them to book a call

BOOKING LINK (send alone when ready): https://join.agenthiringcenter.com/

Keep it real. Sound like a person not a bot.`;

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
      response: "yo whats good",
      text: "yo whats good"
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
