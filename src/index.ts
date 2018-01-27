const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const fs = require('fs');

// Load the settings.
const SETTINGS = JSON.parse(fs.readFileSync(__dirname + '/../settings.json'));

// Create the server.
const SERVER = express();
SERVER.use(bodyParser.json());
SERVER.use(handleRequest);
SERVER.listen(SETTINGS.server.port, SETTINGS.server.host);

// Handle incoming requests, which should only be events coming from Slack.
function handleRequest(req, res) {
    if (req.body.token !== SETTINGS.slack.token) {
        // Drop requests without the correct verification token.
        res.status(403).send();
    } else if (req.body.type === 'url_verification') {
        // In case of URL verification, return the given challenge.
        res.send(req.body.challenge);
    } else if (req.body.type === 'event_callback') {
        // In case the request signifies an event, pass it through to Firebase.
        res.send();
        handleEvent(req.body);
    } else {
        // In all other cases, consider the request invalid.
        res.status(400).send();
    }
}

// Pass an event from Slack to Firebase, and in turn, handle its response.
function handleEvent(body) {
    // Set the verification token so Firebase knows it's us.
    body.token = SETTINGS.firebase.token;

    // Send the event to Firebase, listen for a response, and handle it.
    request({
        uri: SETTINGS.firebase.uri,
        body: JSON.stringify(body),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, handleResponse);
}

// Handle a response from Firebase on an event by sending it back to Slack.
function handleResponse(err, res) {
    if (err) { throw err; }

    // Run through the list of actions sent back and execute them one by one.
    for (const action of JSON.parse(res.body).actions) {
        request({
            uri: 'https://slack.com/api/' + encodeURIComponent(action.method),
            body: JSON.stringify(action.body),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': SETTINGS.slack.authorization
            }
        });
    }
}
