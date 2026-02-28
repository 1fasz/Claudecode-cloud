/**
 * In-memory call session store.
 * Each active phone call gets a session keyed by Twilio CallSid.
 * Sessions expire after 30 minutes of inactivity.
 */

const NodeCache = require("node-cache");

// TTL: 30 minutes
const cache = new NodeCache({ stdTTL: 1800, checkperiod: 120 });

/**
 * @typedef {Object} CallSession
 * @property {string} callSid - Twilio call SID
 * @property {string} from - Caller phone number
 * @property {string} to - Called number
 * @property {string} state - Current conversation state
 * @property {Array<{role: string, content: string}>} history - Conversation messages
 * @property {Object|null} pendingAppointment - Appointment being scheduled
 * @property {string|null} detectedCompany - 'cslegaltech' | 'vulcancloud' | null
 * @property {number} startTime - Unix timestamp of call start
 */

const STATES = {
  GREETING: "GREETING",
  LISTENING: "LISTENING",
  SCHEDULING_GET_NAME: "SCHEDULING_GET_NAME",
  SCHEDULING_GET_EMAIL: "SCHEDULING_GET_EMAIL",
  SCHEDULING_GET_DATE: "SCHEDULING_GET_DATE",
  SCHEDULING_GET_TIME: "SCHEDULING_GET_TIME",
  SCHEDULING_GET_TYPE: "SCHEDULING_GET_TYPE",
  SCHEDULING_CONFIRM: "SCHEDULING_CONFIRM",
  COMPLETED: "COMPLETED",
};

function createSession(callSid, from, to) {
  const session = {
    callSid,
    from,
    to,
    state: STATES.GREETING,
    history: [],
    pendingAppointment: null,
    detectedCompany: null,
    startTime: Date.now(),
  };
  cache.set(callSid, session);
  return session;
}

function getSession(callSid) {
  return cache.get(callSid) || null;
}

function updateSession(callSid, updates) {
  const session = getSession(callSid);
  if (!session) return null;
  const updated = { ...session, ...updates };
  cache.set(callSid, updated);
  return updated;
}

function deleteSession(callSid) {
  cache.del(callSid);
}

function addToHistory(callSid, role, content) {
  const session = getSession(callSid);
  if (!session) return null;
  const history = [...session.history, { role, content }];
  // Keep last 20 messages to avoid huge prompts
  const trimmed = history.slice(-20);
  return updateSession(callSid, { history: trimmed });
}

module.exports = {
  STATES,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  addToHistory,
};
