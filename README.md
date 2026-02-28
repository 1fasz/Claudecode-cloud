# CS Legal Tech / Vulcan Cloud — AI Phone Answering System

An AI-powered phone answering system that handles inbound calls for **CS Legal Tech** (cslegaltech.com) and **Vulcan Cloud** (vulcancloud.com), answers questions about both companies, and schedules appointments directly into your **Office365 Exchange calendar**.

---

## How It Works

1. A caller dials your Twilio phone number
2. The system greets them and listens for speech
3. **Claude AI** interprets their request and responds naturally
4. If they want to book an appointment, the system collects their name, email, preferred date/time, and appointment type
5. It checks your **Office365 calendar** for availability, then books the meeting with a Teams link
6. The caller gets a verbal confirmation; a calendar invite is emailed to them automatically

---

## Tech Stack

| Component | Technology |
|---|---|
| Phone calls | [Twilio Voice](https://www.twilio.com/docs/voice) |
| AI brain | [Anthropic Claude](https://www.anthropic.com) (Sonnet 4.6) |
| Calendar | [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/resources/calendar) (Office365 / Exchange) |
| Server | Node.js + Express |

---

## Setup Guide

### Prerequisites
- Node.js 18+
- A [Twilio account](https://www.twilio.com) with a phone number
- An [Anthropic API key](https://console.anthropic.com)
- An [Azure App Registration](https://portal.azure.com) (for Office365 calendar)

---

### Step 1 — Install Dependencies

```bash
npm install
```

---

### Step 2 — Configure Environment

```bash
cp .env.example .env
```

Fill in your `.env` file (see details below).

---

### Step 3 — Azure App Registration (Office365 Calendar)

1. Go to [portal.azure.com](https://portal.azure.com)
2. **Azure Active Directory → App registrations → New registration**
   - Name: `Phone Answering App`
   - Supported account types: *Accounts in this organizational directory only*
3. After creating, go to **Certificates & secrets → New client secret**
   - Copy the secret value → `AZURE_CLIENT_SECRET`
4. Note your **Application (client) ID** → `AZURE_CLIENT_ID`
5. Note your **Directory (tenant) ID** → `AZURE_TENANT_ID`
6. Go to **API permissions → Add a permission → Microsoft Graph → Application permissions**
   - Add: `Calendars.ReadWrite`
   - Add: `User.Read.All`
7. Click **Grant admin consent**

---

### Step 4 — Twilio Configuration

1. Buy a phone number in [Twilio Console](https://console.twilio.com)
2. Set the webhook URLs (after deploying or using ngrok):
   - **Voice → A call comes in:** `POST https://your-domain.com/twilio/incoming`
   - **Call status callback:** `POST https://your-domain.com/twilio/status`

---

### Step 5 — Local Development with ngrok

```bash
# Terminal 1: Start the server
npm run dev

# Terminal 2: Expose it publicly
ngrok http 3000
```

Copy the ngrok URL (e.g. `https://abc123.ngrok.io`) into your `.env` as `PUBLIC_URL` and into Twilio's webhook settings.

---

### Step 6 — Run

```bash
# Production
npm start

# Development (auto-restart on changes)
npm run dev
```

---

## Environment Variables Reference

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3000) |
| `PUBLIC_URL` | Your public URL (ngrok or domain) |
| `TWILIO_ACCOUNT_SID` | From Twilio console |
| `TWILIO_AUTH_TOKEN` | From Twilio console |
| `TWILIO_PHONE_NUMBER` | Your Twilio number in E.164 format |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | Azure app client ID |
| `AZURE_CLIENT_SECRET` | Azure app client secret |
| `CALENDAR_USER_EMAIL` | Office365 email to book appointments on |
| `TIMEZONE` | IANA timezone (e.g. `America/New_York`) |
| `BUSINESS_HOURS_START` | Start of business hours, 24h (e.g. `09:00`) |
| `BUSINESS_HOURS_END` | End of business hours, 24h (e.g. `17:00`) |
| `DEFAULT_APPOINTMENT_DURATION` | Appointment length in minutes (default: 30) |
| `STAFF_PHONE_NUMBERS` | Comma-separated numbers for call transfers |

---

## Customizing Company Info

Edit `src/data/companies.js` to update:
- Services offered by each company
- Business hours
- Appointment types
- Contact details

The AI reads this file to answer caller questions accurately.

---

## Call Flow

```
Incoming Call
     │
     ▼
  Greeting
     │
     ▼
  Listen for speech ──────────────────────────┐
     │                                        │
     ▼                                        │
  Claude AI processes intent                  │
     │                                        │
     ├── ANSWER ──→ Respond & listen again ───┘
     │
     ├── SCHEDULE ──→ Collect: name → email → date → time → type
     │                        │
     │                        ▼
     │               Check O365 availability
     │                        │
     │                        ▼
     │               Confirm with caller
     │                        │
     │                        ▼
     │               Book via Microsoft Graph
     │                        │
     │                        ▼
     │               Verbal confirmation + hang up
     │
     ├── TRANSFER ──→ Dial staff number
     │
     └── END ──→ Goodbye + hang up
```

---

## Deployment

For production, deploy to any Node.js host:

- **Railway**: `railway up`
- **Render**: Connect GitHub repo, set env vars
- **Heroku**: `git push heroku main`
- **AWS EC2 / DigitalOcean**: PM2 + nginx recommended

Set `NODE_ENV=production` and your real `PUBLIC_URL`.
