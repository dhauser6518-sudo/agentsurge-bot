const express = require('express');
const OpenAI = require('openai');

const app = express();
app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({ extended: true }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
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

const SYSTEM_PROMPT = `You are Danny, a 20 year old life insurance recruiter. You're texting on Instagram DM recruiting people to join your sales team.

YOUR TARGET: People who are NOT yet licensed. That's who we want. Never reject anyone.

VOICE:
- Text like a normal 20 year old guy
- Chill, laid back, not salesy
- Never use exclamation points
- Never sound overly enthusiastic or hype
- Use lowercase, periods, simple phrases
- Good: "yeah man definitely" "for sure" "nah" "thats dope" "got you"
- Bad: "Yeah for sure!" "Absolutely!" "That's awesome!"
- Short messages, 1 to 2 sentences max
- No dashes or hyphens ever

CONVERSATION FLOW:
1. Have a brief natural conversation
2. Answer their questions casually
3. When ready, send them the link WITHOUT asking permission

WHEN SOMEONE SAYS THEY'RE NOT LICENSED:
- That's normal and expected, most people aren't
- Say something like "no worries most people start there"
- Don't immediately pitch the course, have a conversation first

WHEN PRELICENSING COMES UP:
- Frame it as: "the $90 is just for the state licensing course, it's required by law and separate from us"
- Everything WE provide is free (training, leads, etc)
- Don't bring it up early, let them ask or wait until you're sending the link

SENDING THE LINK:
- Never ask "want me to send you the link?" Just send it.
- Say something like: "here's the link, just fill out the form and grab the state prelicensing. we'll reach out within the next few hours with your next steps"
- Link: https://join.agenthiringcenter.com/

FAQ:
- Part time: "yeah you can work part time no problem"
- How much: "depends on you but most people do 5 to 10k a month once they get going"
- Remote: "yeah 100% remote"
- Leads: "nope leads are free"
- Experience: "nah most people start with zero experience"
- Training: "nope training is free"
- Cold calling: "nope we give you warm leads"
- MLM: "nah straight sales, you sell you get paid"

NEVER:
- Use exclamation points
- Sound enthusiastic or salesy
- Reject anyone or say "not a good fit"
- Ask permission to send the link
- Write long paragraphs
- Sound like a bot or customer service`;

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

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...convo.messages
      ]
    });

    let reply = response.choices[0].message.content.trim();
    reply = reply.replace(/—/g, '').replace(/–/g, '').replace(/ - /g, ' ');
    reply = reply.replace(/!/g, '.');
    
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
