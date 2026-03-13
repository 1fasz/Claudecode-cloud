/**
 * Google Gemini AI Service
 * Handles all AI logic: intent detection, Q&A, and conversation flow.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { buildCompanyContext } = require("../data/companies");
const logger = require("../utils/logger");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function withRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < retries && err.status === 503) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
}

const SYSTEM_PROMPT = `Your name is Kourtney. You are a professional AI receptionist for C and S Legal Tech.

Your role:
- Warmly greet callers and assist them with C and S Legal Tech
- Answer questions about services, pricing inquiries (direct to sales), and general info
- Help schedule appointments in the company's calendar
- Handle calls professionally, concisely, and helpfully

IMPORTANT: Always refer to the company as "C and S Legal Tech" — never say "CS Legal Tech", "cslegaltech", or run the letters together.
Do NOT mention Vulcan Cloud unless the caller brings it up first. If the caller mentions Vulcan Cloud, acknowledge it and assist them accordingly.

${buildCompanyContext()}

=== CONVERSATION RULES ===
1. Keep responses SHORT and conversational — this is spoken aloud over the phone.
   No bullet points, no markdown, no long paragraphs. Speak naturally.
2. One question at a time. Never ask multiple things at once.
3. If you don't know the answer, say you'll have someone follow up.
4. For pricing specifics, tell them a team member will follow up with a quote.
5. Always be warm, professional, and helpful.
6. Business timezone: ${process.env.TIMEZONE || "America/New_York"}
7. Business hours: ${process.env.BUSINESS_HOURS_START || "9:00 AM"} – ${process.env.BUSINESS_HOURS_END || "5:00 PM"}, ${process.env.BUSINESS_DAYS || "Monday through Friday"}

=== INTENT DETECTION ===
At the end of EVERY response, output a JSON block on its own line in this exact format:
{"intent":"ANSWER"|"SCHEDULE"|"TRANSFER"|"END","company":"cslegaltech"|"vulcancloud"|null}

- ANSWER: You answered their question or are still in conversation
- SCHEDULE: The caller wants to book an appointment (you detected scheduling intent)
- TRANSFER: Caller needs to speak with a live person urgently
- END: Call is wrapping up / goodbye

Example response:
"Thank you for calling CS Legal Tech! How can I help you today?"
{"intent":"ANSWER","company":"cslegaltech"}
`;

const SCHEDULING_ASSISTANT_PROMPT = `You are helping collect appointment booking details over the phone.
Extract only what was asked. Respond very briefly and naturally (this is spoken aloud).
Current timezone: ${process.env.TIMEZONE || "America/New_York"}

=== EMAIL CONFIRMATION RULE ===
When you receive an email address, always read it back slowly and clearly to confirm it.
Spell out each part — for example: "Let me confirm that — j o h n, at, gmail, dot, com. Is that correct?"
Use pauses between characters so it's easy to follow over the phone.

After your spoken response, always output on a new line:
{"collected": {"name": <string|null>, "email": <string|null>, "date": <"YYYY-MM-DD"|null>, "time": <"HH:MM"|null>, "appointmentType": <string|null>}}
`;

/**
 * Parse AI response: splits spoken text from the JSON metadata line.
 */
function parseAIResponse(rawText) {
  const lines = rawText.trim().split("\n");
  let jsonLine = null;
  let spokenLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        jsonLine = JSON.parse(trimmed);
      } catch {
        spokenLines.push(line);
      }
    } else {
      spokenLines.push(line);
    }
  }

  return {
    spoken: spokenLines.join(" ").trim(),
    meta: jsonLine,
  };
}

/**
 * Main conversation handler: takes caller input and returns spoken response + intent.
 */
async function processCallerInput(session, callerSpeech) {
  logger.info("Sending to Gemini", {
    callSid: session.callSid,
    input: callerSpeech,
    historyLen: session.history.length,
  });

  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite-preview",
    systemInstruction: SYSTEM_PROMPT,
  });

  // Convert history to Gemini format (role must be "user" or "model")
  const history = session.history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history });
  const result = await withRetry(() => chat.sendMessage(callerSpeech || "[silence / unclear]"));
  const rawText = result.response.text();

  const { spoken, meta } = parseAIResponse(rawText);

  logger.info("Gemini response", { callSid: session.callSid, spoken, meta });

  return {
    spoken: spoken || "I'm sorry, could you repeat that?",
    intent: meta?.intent || "ANSWER",
    company: meta?.company || session.detectedCompany || null,
    rawText,
  };
}

/**
 * Scheduling sub-flow: extract structured data from caller's speech.
 */
async function extractSchedulingData(session, callerSpeech, currentData) {
  const context = `
Currently collected:
- Name: ${currentData.name || "not yet collected"}
- Email: ${currentData.email || "not yet collected"}
- Preferred date: ${currentData.date || "not yet collected"}
- Preferred time: ${currentData.time || "not yet collected"}
- Appointment type: ${currentData.appointmentType || "not yet collected"}

The caller just said: "${callerSpeech}"

Extract any new information from what the caller said and ask for the next missing piece.
If a date was mentioned like "next Tuesday" or "March 5th", convert to YYYY-MM-DD using today's date context: ${new Date().toISOString().split("T")[0]}.
If a time like "2 PM" or "afternoon" was mentioned, convert to 24h HH:MM format.
`.trim();

  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite-preview",
    systemInstruction: SCHEDULING_ASSISTANT_PROMPT,
  });

  const result = await withRetry(() => model.generateContent(context));
  const rawText = result.response.text();

  const lines = rawText.trim().split("\n");
  let collected = { ...currentData };
  let spoken = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{"collected"')) {
      try {
        const parsed = JSON.parse(trimmed);
        for (const [k, v] of Object.entries(parsed.collected || {})) {
          if (v !== null && v !== undefined) collected[k] = v;
        }
      } catch {
        // ignore parse error
      }
    } else {
      spoken += line + " ";
    }
  }

  return { spoken: spoken.trim(), collected };
}

/**
 * Generate a confirmation message for a pending appointment.
 */
async function generateConfirmationMessage(appointment, company) {
  const prompt = `Generate a brief, friendly spoken confirmation for this appointment booking:
Company: ${company}
Name: ${appointment.name}
Date: ${appointment.date}
Time: ${appointment.time}
Type: ${appointment.appointmentType || "consultation"}
Duration: ${process.env.DEFAULT_APPOINTMENT_DURATION || 30} minutes

Keep it to 2 sentences. Confirm the details and say a confirmation will be sent to their email.`;

  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
  const result = await model.generateContent(prompt);
  return result.response.text()?.trim() || "Your appointment has been booked. You'll receive a confirmation shortly.";
}

module.exports = {
  processCallerInput,
  extractSchedulingData,
  generateConfirmationMessage,
};
