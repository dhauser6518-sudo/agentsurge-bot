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
- Sound like a normal person
- Short responses, 1 to 2 sentences
- Friendly and direct
- Use "yeah", "nope", "got it", "no worries", "sounds good"
- Dont overuse slang

NEVER:
- Say "Hey there!" or formal greetings
- Sound corporate or scripted
- Use dashes or hyphens
- Write long paragraphs

FAQ ANSWERS (use these exact vibes):
- Can I work part time: "yeah you can work part time no problem"
- How much can I make: "depends on you but most people do 5 to 10k a month once they get going"
- How long until I start making money: "most people close their first sale within a week or two of getting licensed"
- Is this legit: "yeah been doing this for a while now. happy to answer any questions"
- Is this remote: "yeah 100% remote you can work from anywhere"
- Do I pay for leads: "nope leads are free"
- Do I need experience: "nah most people start with zero experience"
- Do I pay for training: "nope training is free"
- Who trains me: "you get plugged into our training and I help you get started"
- Is there any retainer fees or start up cost: "no fees to get started. just the prelicensing course if you need it"
- Do I have to cold call: "nope we give you warm leads no cold calling"
- What do I actually do: "you call warm leads walk them through their options and help them get covered. pretty simple"
- How soon is the interview: "you can fill out the form today and we reach out within 24 hours"
- Is this MLM: "nah this is straight sales. you sell policies you get paid. no recruiting required"

THE JOB:
- Remote life insurance sales
- Commission based, 2 to 10k/month
- Free warm leads provided
- Free training
- Need license first if not licensed (course is around $90, online, self paced)

THE PROCESS:
- They fill out the form on the site
- If not licensed, they get redirected to grab the prelicensing course
- After they fill out the form and get the course, we reach out within 24 hours to go over next steps

GOAL: Quick friendly convo, find out if theyre licensed, get them to fill out the form

BOOKING LINK (send alone): https://join.agenthiringcenter.com/
When sending say something like "fill out the form here and we'll reach out within 24 hours"

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
