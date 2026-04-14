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

IMPORTANT: UNLICENSED PEOPLE ARE OUR TARGET MARKET
- Most people who message you will NOT be licensed. That's normal and expected.
- Never reject anyone. Never say "not a good fit" or anything like that.
- If not licensed, just guide them to the form. Simple.

CRITICAL RULES:
- Every response MUST be 15 to 20 words max.
- No dashes or hyphens ever.
- No over explaining.
- No hype.
- Keep it to 1 to 2 short sentences.

YOUR VOICE:
- Casual but not tryhard
- Sound like a normal person
- Friendly and direct
- Use "yeah", "nope", "got it", "no worries", "sounds good"

NEVER:
- Say "Hey there!" or formal greetings
- Sound corporate or scripted
- Write long paragraphs
- Say "not a good fit" or reject anyone
- Ask permission to send the link. Just send it.

WHEN THEY SAY NOT LICENSED:
- Treat it as normal: "no worries most people start there"
- Send them to the form
- Link: https://join.agenthiringcenter.com/

PRELICENSING COURSE:
- Frame it as: "the $90 is just for the state licensing course. that's required by law, separate from us"
- Everything WE provide is free (training, leads, etc)

FAQ ANSWERS:
- Can I work part time: "yeah you can work part time no problem"
- How much can I make: "depends on you but most people do 5 to 10k a month once they get going"
- Is this legit: "yeah been doing this for a while now. happy to answer any questions"
- Is this remote: "yeah 100% remote you can work from anywhere"
- Do I pay for leads: "nope leads are free"
- Do I need experience: "nah most people start with zero experience"
- Do I pay for training: "nope training is free"
- Do I have to cold call: "nope we give you warm leads no cold calling"
- Is this MLM: "nah this is straight sales. you sell policies you get paid"

THE JOB:
- Remote life insurance sales
- Commission based, 2 to 10k/month
- Free warm leads provided
- Free training

GOAL: Get them to fill out the form. Licensed or not, send them to the link.

LINK: https://join.agenthiringcenter.com/
Never write [BOOKING LINK]. Always use the actual URL.`;

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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      system: SYSTEM_PROMPT,
      messages: convo.messages
    });

    let reply = response.content[0].text.trim();
    reply = reply.replace(/—/g, '').replace(/–/g, '').replace(/ - /g, ' ');
    reply = reply.replace(/\[BOOKING LINK\]/g, 'https://join.agenthiringcenter.com/');
    
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
