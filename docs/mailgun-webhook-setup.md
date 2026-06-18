# Mailgun Webhook + Cloudflare Tunnel Setup

### 1. Install & run Cloudflare Tunnel

```bash
npm install -g cloudflared
cloudflared tunnel --url http://localhost:8080
```

This gives you a URL like: `https://bond--various-omissions.trycloudflare.com`

### 2. Our endpoint

The backend receives webhooks at:

```
POST /webhooks/mailgun/inbound
```

So your full URL is:

```
https://bond--various-omissions.trycloudflare.com/webhooks/mailgun/inbound
```

### 3. Test with Mailgun

1. Go to **https://app.mailgun.com/mg/receiving/routes**
2. Click **"Send a sample POST"**
3. Paste your tunnel URL (from step 1 + `/webhooks/mailgun/inbound`)
4. Click send
5. Watch your terminal — you'll see `[mailgun] Email received` and `[mailgun] Email saved to database`