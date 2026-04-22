const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const SCOPES =
  "launch openid fhirUser offline_access user/Encounter.read";


// 🔑 CONFIG (replace if needed)
const CLIENT_ID = "nd-QGxWI9TjqSC4B4IlzJAdxc0yY9BOuJSmENtVSVC8";
const REDIRECT_URI = "https://ehr-launch.onrender.com/callback";


const AUTH_URL = "https://staging-oauthserver.ecwcloud.com/oauth/oauth2/authorize";
const TOKEN_URL = "https://staging-oauthserver.ecwcloud.com/oauth/oauth2/token";

// 🧠 Temporary in-memory store (for demo only)
let sessionStore = {};

// 🔐 PKCE Generator
function generatePKCE() {
    const code_verifier = crypto.randomBytes(32).toString("base64url");

    const code_challenge = crypto
        .createHash("sha256")
        .update(code_verifier)
        .digest("base64url");

    return { code_verifier, code_challenge };
}

// 🚀 Step 1: Launch endpoint (EHR hits this)
app.get("/", (req, res) => {
    const { iss, launch } = req.query;

    if (!iss || !launch) {
        return res.send("❌ Missing iss or launch parameter");
    }

    console.log("ISS:", iss);
    console.log("Launch:", launch);

    // Generate secure state + PKCE
    const state = crypto.randomBytes(16).toString("hex");
    const { code_verifier, code_challenge } = generatePKCE();

    // Store session data
    sessionStore[state] = {
        code_verifier,
        iss
    };

    // Build Authorization URL
    const authUrl =
        `${AUTH_URL}?response_type=code` +
        `&client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&launch=${launch}` +
        `&aud=${iss}` +
        `&state=${state}` +
        `&code_challenge=${code_challenge}` +
        `&code_challenge_method=S256`;

    console.log("Redirecting to:", authUrl);

    res.redirect(authUrl);
});

// 🔄 Step 2: Callback (receive code → exchange token)
app.get("/callback", async (req, res) => {
    const { code, state, error } = req.query;

    console.log("Callback Query:", req.query);

    if (error) {
        return res.send("❌ Error from ECW: " + error);
    }

    if (!code || !state) {
        return res.send("❌ Missing code or state");
    }

    const session = sessionStore[state];

    if (!session) {
        return res.send("❌ Invalid or expired state");
    }

    try {
        // 🔁 Exchange code for token
        const tokenResponse = await axios.post(
            TOKEN_URL,
            new URLSearchParams({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: REDIRECT_URI,
                client_id: CLIENT_ID,
                code_verifier: session.code_verifier
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        console.log("Token Response:", tokenResponse.data);

        const { access_token, patient } = tokenResponse.data;

        // 🔍 Example FHIR call (Patient)
        let patientData = null;

        if (access_token && patient) {
            try {
                const fhirResponse = await axios.get(
                    `${session.iss}/Patient/${patient}`,
                    {
                        headers: {
                            Authorization: `Bearer ${access_token}`
                        }
                    }
                );

                patientData = fhirResponse.data;
            } catch (fhirErr) {
                console.error("FHIR Error:", fhirErr.response?.data || fhirErr.message);
            }
        }

        // ✅ Final Output
        res.json({
            message: "✅ Success",
            token: tokenResponse.data,
            patientData: patientData
        });

    } catch (err) {
        console.error("Token Error:", err.response?.data || err.message);

        res.status(500).json({
            error: "❌ Token exchange failed",
            details: err.response?.data || err.message
        });
    }
});

// 🚀 Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});