/**
 * Twilio Voice Webhook Routes
 *
 * Webhook URLs to configure in Twilio Console:
 *   Incoming call: POST https://your-domain.com/twilio/incoming
 *   Status callback: POST https://your-domain.com/twilio/status
 *
 * All routes return TwiML (XML) that Twilio executes.
 */

const express = require("express");
const router = express.Router();
const twilio = require("twilio");
const VoiceResponse = twilio.twiml.VoiceResponse;

const logger = require("../utils/logger");
const {
  STATES,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  addToHistory,
} = require("../utils/sessionStore");
const { processCallerInput, extractSchedulingData, generateConfirmationMessage } = require("../services/claude");
const { bookAppointment, checkAvailability, getAvailableSlots } = require("../services/calendar");

// Twilio request validation middleware
function validateTwilioRequest(req, res, next) {
  if (process.env.SKIP_TWILIO_VALIDATION === "true") {
    return next();
  }
  const valid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    req.headers["x-twilio-signature"] || "",
    `${process.env.PUBLIC_URL}${req.originalUrl}`,
    req.body
  );
  if (!valid) {
    logger.warn("Invalid Twilio signature", { ip: req.ip });
    return res.status(403).send("Forbidden");
  }
  next();
}

router.use(validateTwilioRequest);

/**
 * Helper: respond with TwiML that speaks text and gathers speech input.
 */
function gatherSpeech(res, { say, action, hints = "", timeout = 5, bargeIn = true }) {
  const twiml = new VoiceResponse();
  const gather = twiml.gather({
    input: "speech",
    action,
    method: "POST",
    timeout,
    speechTimeout: "auto",
    language: "en-US",
    hints: hints || undefined,
    bargeIn,
  });
  gather.say({ voice: "Polly.Joanna-Neural" }, say);

  // Fallback if no speech detected
  twiml.redirect({ method: "POST" }, action + "?noInput=true");

  res.type("text/xml");
  res.send(twiml.toString());
}

/**
 * Helper: respond with TwiML that just says something and hangs up.
 */
function sayAndHangup(res, text) {
  const twiml = new VoiceResponse();
  twiml.say({ voice: "Polly.Joanna-Neural" }, text);
  twiml.hangup();
  res.type("text/xml");
  res.send(twiml.toString());
}

/**
 * POST /twilio/incoming
 * Entry point for all incoming calls.
 */
router.post("/incoming", async (req, res) => {
  const { CallSid, From, To } = req.body;
  logger.info("Incoming call", { CallSid, From, To });

  createSession(CallSid, From, To);

  const baseUrl = process.env.PUBLIC_URL;
  gatherSpeech(res, {
    say: "Thank you for calling. You've reached CS Legal Tech and Vulcan Cloud. How can I help you today?",
    action: `${baseUrl}/twilio/process`,
    hints: "schedule appointment, legal tech, cloud services, pricing, support",
    timeout: 6,
  });
});

/**
 * POST /twilio/process
 * Main conversation loop — processes caller speech and responds.
 */
router.post("/process", async (req, res) => {
  const { CallSid, SpeechResult, Confidence, From } = req.body;
  const noInput = req.query.noInput === "true";
  const baseUrl = process.env.PUBLIC_URL;

  const session = getSession(CallSid);
  if (!session) {
    // Session expired or missing — restart
    return sayAndHangup(res, "I'm sorry, something went wrong. Please call back and we'll be happy to help.");
  }

  const callerSpeech = noInput ? "" : (SpeechResult || "").trim();
  logger.info("Processing speech", { CallSid, speech: callerSpeech, confidence: Confidence });

  // Handle silence
  if (!callerSpeech) {
    addToHistory(CallSid, "user", "[silence]");
    return gatherSpeech(res, {
      say: "I didn't catch that. Could you please repeat what you said?",
      action: `${baseUrl}/twilio/process`,
      timeout: 7,
    });
  }

  addToHistory(CallSid, "user", callerSpeech);

  try {
    const aiResult = await processCallerInput(session, callerSpeech);
    addToHistory(CallSid, "assistant", aiResult.spoken);

    // Update detected company if identified
    if (aiResult.company && !session.detectedCompany) {
      updateSession(CallSid, { detectedCompany: aiResult.company });
    }

    // Handle intent
    switch (aiResult.intent) {
      case "SCHEDULE":
        updateSession(CallSid, { state: STATES.SCHEDULING_GET_NAME });
        return gatherSpeech(res, {
          say: aiResult.spoken,
          action: `${baseUrl}/twilio/schedule/name`,
          hints: "my name is, I am, it's",
          timeout: 8,
        });

      case "TRANSFER":
        return transferToHuman(res, session);

      case "END":
        deleteSession(CallSid);
        return sayAndHangup(res, aiResult.spoken || "Thank you for calling. Have a great day!");

      default:
        // ANSWER — continue conversation
        return gatherSpeech(res, {
          say: aiResult.spoken,
          action: `${baseUrl}/twilio/process`,
          hints: "schedule, appointment, pricing, support, more information",
          timeout: 6,
        });
    }
  } catch (err) {
    logger.error("Error processing call", { CallSid, error: err.message });
    return gatherSpeech(res, {
      say: "I'm sorry, I had a little trouble with that. Could you say it again?",
      action: `${baseUrl}/twilio/process`,
      timeout: 6,
    });
  }
});

// ============================================================
// SCHEDULING FLOW
// ============================================================

/**
 * POST /twilio/schedule/name
 */
router.post("/schedule/name", async (req, res) => {
  const { CallSid, SpeechResult } = req.body;
  const noInput = req.query.noInput === "true";
  const baseUrl = process.env.PUBLIC_URL;

  const session = getSession(CallSid);
  if (!session) return sayAndHangup(res, "Session expired. Please call back.");

  const speech = noInput ? "" : (SpeechResult || "").trim();
  addToHistory(CallSid, "user", speech || "[silence]");

  const currentData = session.pendingAppointment || {};
  const { spoken, collected } = await extractSchedulingData(session, speech, currentData);
  updateSession(CallSid, { pendingAppointment: collected });

  if (collected.name) {
    return gatherSpeech(res, {
      say: spoken || `Great, ${collected.name}. Could I get your email address for the calendar invite?`,
      action: `${baseUrl}/twilio/schedule/email`,
      hints: "my email is, at gmail, at outlook",
      timeout: 10,
    });
  }

  gatherSpeech(res, {
    say: spoken || "Could you please tell me your full name?",
    action: `${baseUrl}/twilio/schedule/name`,
    timeout: 8,
  });
});

/**
 * POST /twilio/schedule/email
 */
router.post("/schedule/email", async (req, res) => {
  const { CallSid, SpeechResult } = req.body;
  const noInput = req.query.noInput === "true";
  const baseUrl = process.env.PUBLIC_URL;

  const session = getSession(CallSid);
  if (!session) return sayAndHangup(res, "Session expired. Please call back.");

  const speech = noInput ? "" : (SpeechResult || "").trim();
  addToHistory(CallSid, "user", speech || "[silence]");

  const currentData = session.pendingAppointment || {};
  const { spoken, collected } = await extractSchedulingData(session, speech, currentData);
  updateSession(CallSid, { pendingAppointment: collected });

  if (collected.email) {
    return gatherSpeech(res, {
      say: spoken || `Thanks. What date works best for you?`,
      action: `${baseUrl}/twilio/schedule/date`,
      hints: "tomorrow, next week, Monday, Tuesday, next Monday",
      timeout: 10,
    });
  }

  gatherSpeech(res, {
    say: spoken || "What's your email address? I'll spell it back to confirm.",
    action: `${baseUrl}/twilio/schedule/email`,
    timeout: 10,
  });
});

/**
 * POST /twilio/schedule/date
 */
router.post("/schedule/date", async (req, res) => {
  const { CallSid, SpeechResult } = req.body;
  const noInput = req.query.noInput === "true";
  const baseUrl = process.env.PUBLIC_URL;

  const session = getSession(CallSid);
  if (!session) return sayAndHangup(res, "Session expired. Please call back.");

  const speech = noInput ? "" : (SpeechResult || "").trim();
  addToHistory(CallSid, "user", speech || "[silence]");

  const currentData = session.pendingAppointment || {};
  const { spoken, collected } = await extractSchedulingData(session, speech, currentData);
  updateSession(CallSid, { pendingAppointment: collected });

  if (collected.date) {
    // Optionally mention available slots
    let availabilityHint = "";
    try {
      const slots = await getAvailableSlots(collected.date);
      if (slots.length > 0) {
        const readableSlots = slots.slice(0, 3).map((s) => {
          const [h, m] = s.split(":").map(Number);
          const ampm = h >= 12 ? "PM" : "AM";
          const h12 = h % 12 || 12;
          return `${h12}${m ? ":" + String(m).padStart(2, "0") : ""} ${ampm}`;
        });
        availabilityHint = `Some available times include ${readableSlots.join(", ")}. `;
      }
    } catch (err) {
      logger.warn("Could not fetch slots", { error: err.message });
    }

    return gatherSpeech(res, {
      say: spoken || `${availabilityHint}What time works best for you?`,
      action: `${baseUrl}/twilio/schedule/time`,
      hints: "9 AM, 10 AM, 2 PM, 3 PM, morning, afternoon",
      timeout: 10,
    });
  }

  gatherSpeech(res, {
    say: spoken || "What date would you like to schedule the appointment?",
    action: `${baseUrl}/twilio/schedule/date`,
    hints: "tomorrow, next Monday, next week",
    timeout: 10,
  });
});

/**
 * POST /twilio/schedule/time
 */
router.post("/schedule/time", async (req, res) => {
  const { CallSid, SpeechResult } = req.body;
  const noInput = req.query.noInput === "true";
  const baseUrl = process.env.PUBLIC_URL;

  const session = getSession(CallSid);
  if (!session) return sayAndHangup(res, "Session expired. Please call back.");

  const speech = noInput ? "" : (SpeechResult || "").trim();
  addToHistory(CallSid, "user", speech || "[silence]");

  const currentData = session.pendingAppointment || {};
  const { spoken, collected } = await extractSchedulingData(session, speech, currentData);
  updateSession(CallSid, { pendingAppointment: collected });

  if (collected.time && collected.date) {
    // Check availability before confirming
    let isAvailable = true;
    try {
      isAvailable = await checkAvailability(collected.date, collected.time);
    } catch (err) {
      logger.warn("Availability check failed, proceeding", { error: err.message });
    }

    if (!isAvailable) {
      return gatherSpeech(res, {
        say: `I'm sorry, that time slot is already taken. Could you suggest another time?`,
        action: `${baseUrl}/twilio/schedule/time`,
        hints: "10 AM, 11 AM, 2 PM, 3 PM",
        timeout: 10,
      });
    }

    const company = session.detectedCompany || "cslegaltech";
    const appointmentTypes = {
      cslegaltech: ["product demo", "consultation", "technical support", "sales inquiry"],
      vulcancloud: ["cloud assessment", "migration consultation", "technical demo", "sales inquiry"],
    };

    return gatherSpeech(res, {
      say: spoken || `Great. What type of appointment would you like? For example: ${appointmentTypes[company]?.slice(0, 2).join(" or ")}.`,
      action: `${baseUrl}/twilio/schedule/type`,
      hints: appointmentTypes[company]?.join(", "),
      timeout: 10,
    });
  }

  gatherSpeech(res, {
    say: spoken || "What time would you prefer for the appointment?",
    action: `${baseUrl}/twilio/schedule/time`,
    timeout: 10,
  });
});

/**
 * POST /twilio/schedule/type
 */
router.post("/schedule/type", async (req, res) => {
  const { CallSid, SpeechResult } = req.body;
  const noInput = req.query.noInput === "true";
  const baseUrl = process.env.PUBLIC_URL;

  const session = getSession(CallSid);
  if (!session) return sayAndHangup(res, "Session expired. Please call back.");

  const speech = noInput ? "" : (SpeechResult || "").trim();
  addToHistory(CallSid, "user", speech || "[silence]");

  const currentData = session.pendingAppointment || {};
  const { spoken, collected } = await extractSchedulingData(session, speech, {
    ...currentData,
    appointmentType: currentData.appointmentType || speech || "consultation",
  });
  updateSession(CallSid, { pendingAppointment: collected });

  // Build confirmation text
  const appt = collected;
  const [year, month, day] = (appt.date || "").split("-");
  const dateDisplay = appt.date
    ? new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      })
    : "the selected date";
  const [h, m] = (appt.time || "00:00").split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  const timeDisplay = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;

  const confirmText = `Let me confirm: I'm booking a ${appt.appointmentType || "consultation"} for ${appt.name} on ${dateDisplay} at ${timeDisplay}. Your confirmation will be sent to ${appt.email}. Does that sound right?`;

  gatherSpeech(res, {
    say: confirmText,
    action: `${baseUrl}/twilio/schedule/confirm`,
    hints: "yes, correct, that's right, no, wrong, change",
    timeout: 8,
  });
});

/**
 * POST /twilio/schedule/confirm
 */
router.post("/schedule/confirm", async (req, res) => {
  const { CallSid, SpeechResult, From } = req.body;
  const noInput = req.query.noInput === "true";
  const baseUrl = process.env.PUBLIC_URL;

  const session = getSession(CallSid);
  if (!session) return sayAndHangup(res, "Session expired. Please call back.");

  const speech = (SpeechResult || "").toLowerCase().trim();
  const confirmed = speech.match(/\b(yes|yeah|correct|right|sure|confirm|yep|absolutely|sounds good)\b/);
  const denied = speech.match(/\b(no|wrong|incorrect|change|different|cancel)\b/);

  if (denied) {
    updateSession(CallSid, { pendingAppointment: {}, state: STATES.SCHEDULING_GET_NAME });
    return gatherSpeech(res, {
      say: "No problem, let's start over. Could you give me your name again?",
      action: `${baseUrl}/twilio/schedule/name`,
      timeout: 8,
    });
  }

  if (!confirmed && !noInput) {
    return gatherSpeech(res, {
      say: "Sorry, I didn't catch that. Did you say yes to confirm the appointment?",
      action: `${baseUrl}/twilio/schedule/confirm`,
      hints: "yes, no, correct, wrong",
      timeout: 8,
    });
  }

  // Book the appointment
  const appt = session.pendingAppointment;
  const company = session.detectedCompany || "cslegaltech";

  try {
    const result = await bookAppointment({
      name: appt.name,
      email: appt.email,
      date: appt.date,
      time: appt.time,
      appointmentType: appt.appointmentType || "consultation",
      company,
      callerPhone: session.from,
    });

    logger.info("Appointment booked", { CallSid, eventId: result.eventId });

    const confirmMsg = await generateConfirmationMessage(appt, company);
    deleteSession(CallSid);
    return sayAndHangup(res, confirmMsg + " Thank you for calling, and we look forward to speaking with you. Have a great day!");

  } catch (err) {
    logger.error("Failed to book appointment", { CallSid, error: err.message, stack: err.stack });
    return sayAndHangup(
      res,
      "I'm sorry, I ran into an issue booking that appointment. A team member will call you back to confirm the booking. Thank you for your patience!"
    );
  }
});

/**
 * Transfer to human agent.
 */
function transferToHuman(res, session) {
  const staffNumbers = (process.env.STAFF_PHONE_NUMBERS || "").split(",").filter(Boolean);
  const transferTo = staffNumbers[0];

  if (!transferTo) {
    return sayAndHangup(
      res,
      "I'll have a team member reach out to you shortly. Thank you for calling!"
    );
  }

  const twiml = new VoiceResponse();
  twiml.say(
    { voice: "Polly.Joanna-Neural" },
    "One moment, I'm connecting you with a team member now."
  );
  const dial = twiml.dial({
    action: `${process.env.PUBLIC_URL}/twilio/dial-complete`,
    method: "POST",
    timeout: 30,
  });
  dial.number(transferTo);

  res.type("text/xml");
  res.send(twiml.toString());
}

/**
 * POST /twilio/dial-complete
 * Called after a transfer attempt.
 */
router.post("/dial-complete", (req, res) => {
  const { DialCallStatus, CallSid } = req.body;
  logger.info("Dial complete", { CallSid, DialCallStatus });

  if (DialCallStatus !== "completed" && DialCallStatus !== "answered") {
    return sayAndHangup(
      res,
      "I'm sorry, no one is available right now. Please leave us a message at our website, cslegaltech.com, or try again during business hours. Thank you!"
    );
  }

  const twiml = new VoiceResponse();
  twiml.hangup();
  res.type("text/xml");
  res.send(twiml.toString());
});

/**
 * POST /twilio/status
 * Status callback for call lifecycle events (optional — for logging).
 */
router.post("/status", (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  logger.info("Call status update", { CallSid, CallStatus, CallDuration });

  if (["completed", "busy", "failed", "no-answer"].includes(CallStatus)) {
    deleteSession(CallSid);
  }

  res.sendStatus(200);
});

module.exports = router;
