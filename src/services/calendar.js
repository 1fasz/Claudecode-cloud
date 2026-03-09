/**
 * Microsoft Graph API - Office365 Calendar Service
 * Books appointments on the configured Exchange calendar.
 *
 * Azure App Registration requires:
 *   - Calendars.ReadWrite (Application permission)
 *   - User.Read.All (Application permission, if booking on behalf of users)
 *
 * Setup: https://portal.azure.com -> Azure Active Directory -> App registrations
 */

const { Client } = require("@microsoft/microsoft-graph-client");
const { ConfidentialClientApplication } = require("@azure/msal-node");
const { format, addMinutes, parseISO } = require("date-fns");
const { toZonedTime, fromZonedTime } = require("date-fns-tz");
const logger = require("../utils/logger");

// MSAL config for client credentials flow (application permissions)
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
  },
};

let msalClient = null;

function getMsalClient() {
  if (!msalClient) {
    msalClient = new ConfidentialClientApplication(msalConfig);
  }
  return msalClient;
}

/**
 * Acquire an access token using client credentials (app-only auth).
 */
async function getAccessToken() {
  const app = getMsalClient();
  const result = await app.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });
  if (!result?.accessToken) {
    throw new Error("Failed to acquire Microsoft Graph access token");
  }
  return result.accessToken;
}

/**
 * Get an authenticated Microsoft Graph client.
 */
async function getGraphClient() {
  const token = await getAccessToken();
  return Client.init({
    authProvider: (done) => done(null, token),
  });
}

/**
 * Check calendar availability for the given time slot.
 * Returns true if the slot is free.
 *
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {string} timeStr - "HH:MM" (24h, in business timezone)
 * @param {number} durationMinutes
 */
async function checkAvailability(dateStr, timeStr, durationMinutes = null, calendarEmail = null) {
  const duration = durationMinutes || parseInt(process.env.DEFAULT_APPOINTMENT_DURATION) || 30;
  const tz = process.env.TIMEZONE || "America/New_York";
  calendarEmail = calendarEmail || process.env.CALENDAR_USER_EMAIL;

  const startLocal = parseISO(`${dateStr}T${timeStr}:00`);
  const startUtc = fromZonedTime(startLocal, tz);
  const endUtc = addMinutes(startUtc, duration);

  const graphClient = await getGraphClient();

  const freeBusy = await graphClient
    .api(`/users/${calendarEmail}/calendar/getSchedule`)
    .post({
      schedules: [calendarEmail],
      startTime: {
        dateTime: startUtc.toISOString(),
        timeZone: "UTC",
      },
      endTime: {
        dateTime: endUtc.toISOString(),
        timeZone: "UTC",
      },
      availabilityViewInterval: duration,
    });

  const scheduleItem = freeBusy?.value?.[0];
  if (!scheduleItem) return true; // assume available if can't check

  // availabilityView: '0' = free, '1' = tentative, '2' = busy, '3' = OOF, '4' = working elsewhere
  const availability = scheduleItem.availabilityView;
  return !availability || availability === "0";
}

/**
 * Book an appointment on the Office365 Exchange calendar.
 *
 * @param {Object} appointmentData
 * @param {string} appointmentData.name - Caller's name
 * @param {string} appointmentData.email - Caller's email
 * @param {string} appointmentData.date - "YYYY-MM-DD"
 * @param {string} appointmentData.time - "HH:MM" (24h, in business timezone)
 * @param {string} appointmentData.appointmentType - Type of meeting
 * @param {string} appointmentData.company - Company name
 * @param {string} appointmentData.callerPhone - Caller's phone number
 * @param {number} [appointmentData.durationMinutes]
 */
async function bookAppointment(appointmentData) {
  const {
    name,
    email,
    date,
    time,
    appointmentType,
    company,
    callerPhone,
    durationMinutes,
  } = appointmentData;

  const duration = durationMinutes || parseInt(process.env.DEFAULT_APPOINTMENT_DURATION) || 30;
  const tz = process.env.TIMEZONE || "America/New_York";
  const calendarEmail = appointmentData.staffEmail || process.env.CALENDAR_USER_EMAIL;

  const startLocal = parseISO(`${date}T${time}:00`);
  const startUtc = fromZonedTime(startLocal, tz);
  const endUtc = addMinutes(startUtc, duration);

  const displayStart = format(toZonedTime(startUtc, tz), "EEEE, MMMM d, yyyy 'at' h:mm a zzz", { timeZone: tz });

  const event = {
    subject: `${appointmentType || "Consultation"} - ${name} (via Phone)`,
    body: {
      contentType: "HTML",
      content: `
        <p>Appointment booked via AI phone system.</p>
        <table>
          <tr><td><b>Caller Name:</b></td><td>${name}</td></tr>
          <tr><td><b>Caller Email:</b></td><td>${email}</td></tr>
          <tr><td><b>Caller Phone:</b></td><td>${callerPhone || "N/A"}</td></tr>
          <tr><td><b>Company:</b></td><td>${company}</td></tr>
          <tr><td><b>Appointment Type:</b></td><td>${appointmentType || "General Consultation"}</td></tr>
          <tr><td><b>Time:</b></td><td>${displayStart}</td></tr>
        </table>
      `,
    },
    start: {
      dateTime: startUtc.toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: endUtc.toISOString(),
      timeZone: "UTC",
    },
    attendees: [
      {
        emailAddress: {
          address: email,
          name: name,
        },
        type: "required",
      },
    ],
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
    reminderMinutesBeforeStart: 15,
  };

  logger.info("Booking appointment via Graph API", {
    calendarEmail,
    name,
    email,
    date,
    time,
    company,
  });

  const graphClient = await getGraphClient();
  const created = await graphClient
    .api(`/users/${calendarEmail}/events`)
    .post(event);

  logger.info("Appointment booked successfully", {
    eventId: created.id,
    webLink: created.webLink,
  });

  return {
    success: true,
    eventId: created.id,
    webLink: created.webLink,
    displayTime: displayStart,
    teamsLink: created.onlineMeeting?.joinUrl || null,
  };
}

/**
 * Get available time slots for a given date.
 * Returns an array of available HH:MM strings.
 */
async function getAvailableSlots(dateStr, durationMinutes = null, calendarEmail = null) {
  const duration = durationMinutes || parseInt(process.env.DEFAULT_APPOINTMENT_DURATION) || 30;
  const tz = process.env.TIMEZONE || "America/New_York";
  calendarEmail = calendarEmail || process.env.CALENDAR_USER_EMAIL;

  const startHour = parseInt((process.env.BUSINESS_HOURS_START || "09:00").split(":")[0]);
  const endHour = parseInt((process.env.BUSINESS_HOURS_END || "17:00").split(":")[0]);

  // Generate candidate slots
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += duration) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  // Check all slots at once using getSchedule
  const startLocal = parseISO(`${dateStr}T${String(startHour).padStart(2, "0")}:00:00`);
  const endLocal = parseISO(`${dateStr}T${String(endHour).padStart(2, "0")}:00:00`);
  const startUtc = fromZonedTime(startLocal, tz);
  const endUtc = fromZonedTime(endLocal, tz);

  try {
    const graphClient = await getGraphClient();
    const freeBusy = await graphClient
      .api(`/users/${calendarEmail}/calendar/getSchedule`)
      .post({
        schedules: [calendarEmail],
        startTime: { dateTime: startUtc.toISOString(), timeZone: "UTC" },
        endTime: { dateTime: endUtc.toISOString(), timeZone: "UTC" },
        availabilityViewInterval: duration,
      });

    const availabilityView = freeBusy?.value?.[0]?.availabilityView || "";
    const availableSlots = [];

    for (let i = 0; i < slots.length && i < availabilityView.length; i++) {
      if (availabilityView[i] === "0") {
        availableSlots.push(slots[i]);
      }
    }

    return availableSlots;
  } catch (err) {
    logger.error("Error fetching availability", { error: err.message });
    return slots; // Return all slots if we can't check
  }
}

/**
 * Send a booking notification email to the staff member via Microsoft Graph.
 * Requires Mail.Send application permission on the Azure app.
 *
 * @param {Object} params
 * @param {string} params.toEmail - Staff member's email
 * @param {string} params.toName  - Staff member's name
 * @param {Object} params.appt    - Appointment details
 * @param {string} params.displayTime - Human-readable time string
 * @param {string} params.teamsLink   - Teams meeting join URL (may be null)
 */
async function sendStaffNotificationEmail({ toEmail, toName, appt, displayTime, teamsLink }) {
  const senderEmail = process.env.CALENDAR_USER_EMAIL;
  const teamsSection = teamsLink
    ? `<p><b>Teams Meeting:</b> <a href="${teamsLink}">${teamsLink}</a></p>`
    : "";

  const message = {
    subject: `New Appointment: ${appt.appointmentType || "Consultation"} with ${appt.name}`,
    body: {
      contentType: "HTML",
      content: `
        <p>Hi ${toName},</p>
        <p>Kourtney has booked a new appointment on your calendar:</p>
        <table cellpadding="6" style="border-collapse:collapse;">
          <tr><td><b>Client Name:</b></td><td>${appt.name}</td></tr>
          <tr><td><b>Client Email:</b></td><td>${appt.email}</td></tr>
          <tr><td><b>Client Phone:</b></td><td>${appt.callerPhone || "N/A"}</td></tr>
          <tr><td><b>Appointment Type:</b></td><td>${appt.appointmentType || "Consultation"}</td></tr>
          <tr><td><b>Date &amp; Time:</b></td><td>${displayTime}</td></tr>
        </table>
        ${teamsSection}
        <p>This appointment was scheduled automatically via the Kourtney phone answering system.</p>
      `,
    },
    toRecipients: [
      { emailAddress: { address: toEmail, name: toName } },
    ],
  };

  const graphClient = await getGraphClient();
  await graphClient
    .api(`/users/${senderEmail}/sendMail`)
    .post({ message, saveToSentItems: false });

  logger.info("Staff notification email sent", { to: toEmail, appt: appt.name });
}

module.exports = { bookAppointment, checkAvailability, getAvailableSlots, sendStaffNotificationEmail };
