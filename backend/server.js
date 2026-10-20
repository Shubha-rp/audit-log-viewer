
const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
    ],
  })
);

app.use(express.json());

function parseJson(value) {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getTokenUrl() {
  const configuredUrl = process.env.OAUTH_URL;

  if (!configuredUrl) {
    throw new Error("OAUTH_URL is missing in backend/.env");
  }

  // Enter the exact token URL that worked in Postman.
  // This function deliberately does not guess the SAP UAA host.
  return configuredUrl;
}

async function getAccessToken() {
  const tokenUrl = getTokenUrl();
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("OAuth client credentials are missing.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
  });

  const response = await axios.post(tokenUrl, body.toString(), {
    auth: {
      username: clientId,
      password: clientSecret,
    },
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 30000,
  });

  return response.data.access_token;
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Audit dashboard backend is running" });
});

app.get("/api/audit-logs", async (req, res) => {
  try {
    const { from, to, category } = req.query;

    const now = new Date();
    const defaultFrom = new Date("2026-09-25T00:00:00Z");
const defaultTo = new Date("2026-09-26T00:00:00Z");

    function formatSapTime(date) {
  return date.toISOString().slice(0, 19);
}

const timeFrom = from
  ? new Date(from).toISOString().slice(0, 19)
  : defaultFrom.toISOString().slice(0, 19);

const timeTo = to
  ? new Date(to).toISOString().slice(0, 19)
  : defaultTo.toISOString().slice(0, 19);
    const token = await getAccessToken();

    const apiUrl =
      `${process.env.AUDITLOG_BASE_URL}/auditlog/v2/auditlogrecords`;

    const params = {
      time_from: timeFrom,
      time_to: timeTo,
    };

    const response = await axios.get(apiUrl, {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      timeout: 60000,
    });

    const payload = response.data;

    // Adapt to common response envelopes while preserving original records.
    let records = Array.isArray(payload)
      ? payload
      : payload.auditlogrecords ||
        payload.records ||
        payload.items ||
        payload.data ||
        [];

    if (!Array.isArray(records)) {
      records = [];
    }

    if (category && category !== "all") {
      records = records.filter(
        (record) => record.category === category
      );
    }

    res.json({
      count: records.length,
      records,
      paging: response.headers.paging || null,
    });
  } catch (error) {
    const status = error.response?.status || 500;

    // Do not send credentials or the full upstream response to the browser.
    console.error("Audit API request failed:", {
  status: error.response?.status,
  response: error.response?.data,
  url: error.config?.url,
  params: error.config?.params,
});

    res.status(status).json({
      error: "Unable to retrieve audit logs.",
      status,
      details:
        status === 401 || status === 403
          ? "Check the service key, token URL, and API permissions."
          : "Check the backend configuration and SAP API response.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
