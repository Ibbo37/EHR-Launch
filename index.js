const express = require("express");
const app = express();

const PORT = 3000;


const CLIENT_ID = "nd-QGxWI9TjqSC4B4IlzJAdxc0yY9BOuJSmENtVSVC8";
const REDIRECT_URI = "http://localhost:3000/callback";
const AUTH_URL = "https://staging-oauthserver.ecwcloud.com/oauth/oauth2/authorize";


app.get("/", (req, res) => {
    const iss = req.query.iss;
    const launch = req.query.launch;

    if (!iss || !launch) {
        return res.send("Missing iss or launch parameter");
    }

    console.log("ISS:", iss);
    console.log("Launch:", launch);

    const state = "abc123";

    const authUrl = `${AUTH_URL}?response_type=code` +
        `&client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=launch openid patient/*.* user/*.*` +
        `&launch=${launch}` +
        `&aud=${iss}` +
        `&state=${state}`;

    res.redirect(authUrl);
});


app.get("/callback", (req, res) => {
    console.log("FULL QUERY:", req.query);

    const { code, error, state } = req.query;

    if (error) {
        return res.send("Error from ECW: " + error);
    }

    if (!code) {
        return res.send("No auth code received: " + JSON.stringify(req.query));
    }

    res.send(`
        <h2>Authorization Code Received</h2>
        <p>Code: ${code}</p>
        <p>State: ${state}</p>
    `);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});