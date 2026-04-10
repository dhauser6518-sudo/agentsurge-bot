# AgentSurge Instagram DM Bot

ManyChat webhook server for Instagram DM automation with GPT-4o.

## Deploy to Railway

1. Push this repo to GitHub
2. Go to Railway → New Project → GitHub Repo → Select this repo
3. Add environment variable: `OPENAI_API_KEY` = your OpenAI API key
4. Railway auto-deploys and gives you a URL like `https://your-app.up.railway.app`

## ManyChat Setup

1. Create a new Flow in ManyChat
2. Set trigger to Instagram DM (or specific keyword)
3. Add "External Request" action:
   - Method: `POST`
   - URL: `https://your-railway-url.up.railway.app/webhook`
   - Body:
   ```json
   {
     "message": "{{last_input_text}}",
     "user_id": "{{user_id}}",
     "name": "{{first_name}}"
   }
   ```
   - Response mapping: Save `response` to custom field `ai_reply`

4. Add "Send Message" action:
   - Text: `{{ai_reply}}`

## Endpoints

- `POST /webhook` - Main endpoint for ManyChat
- `GET /health` - Health check

## Test Locally

```bash
npm install
OPENAI_API_KEY=your-key node index.js
```

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"message": "is this remote?", "name": "John"}'
```
