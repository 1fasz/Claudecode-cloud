/**
 * CS Legal Tech / Vulcan Cloud — AI Phone Answering System
 * Entry point
 */

require("dotenv").config();

const express = require("express");
const logger = require("./utils/logger");
const twilioRoutes = require("./routes/twilio");

const app = express();
const PORT = process.env.PORT || 3000;

// Parse URL-encoded bodies (Twilio sends form-encoded webhooks)
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "CS Legal Tech / Vulcan Cloud Phone Answering",
    timestamp: new Date().toISOString(),
  });
});

// Twilio webhook routes
app.use("/twilio", twilioRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  logger.info(`Phone answering server running on port ${PORT}`);
  logger.info(`Webhook URL: ${process.env.PUBLIC_URL || `http://localhost:${PORT}`}/twilio/incoming`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;
