# Mivo — Dutch-speaking tutor (Lesson 1)

Mivo is a mobile-friendly, voice-first Dutch greetings lesson. It includes eight phrases, listening, speaking or typing practice, a structured dialogue, role reversal, gentle corrections, and a completion challenge. Progress is saved locally in your browser, and you can resume from the home screen.

## What you need

- A Windows, macOS, or Linux computer
- **Node.js 20 or later** from https://nodejs.org
- A modern browser; Chrome works best for browser speech recognition
- No npm install, paid account, or API key is needed for the guided lesson

## First launch

1. Unzip **Mivo-v1-install-bundle.zip**.
2. Open a terminal / Command Prompt inside the **mivo-app** folder.
3. Enter **`npm start`**.
4. Visit **http://localhost:3000** in a browser.
5. Click **Start my first lesson**.

To stop the local server, press **Ctrl+C** in the terminal.

### Easy launch scripts

On Windows, double-click **start-mivo.bat** inside `mivo-app` (requires Node.js). On macOS/Linux, from Terminal run `bash start-mivo.sh`. These run the same local server.

### Testing checklist

- Welcome page has the Mivo name.
- Hear all eight Dutch greetings using the speaker button.
- Practise the five prompts by speaking (supported browsers) or typing.
- Complete the conversation and reverse-role dialogue.
- Try “Goed gaat het” when asked “Hoe gaat het?”; it should be corrected.
- Finish the final challenge: say **“Goedenavond”**, then answer **“Het gaat goed, dank je. En met jou?”** (the final turn requires the return question).
- Click the Mivo logo in the middle of the lesson, then **Resume lesson** from home.
- Refresh the page: lesson progress should be retained.

## Optional live AI voice tutoring (API charges apply)

The guided lesson works on its own, with browser-generated speech. For a separate natural AI voice chat, configure an OpenAI API key *on the local server*. The frontend never needs it.

On macOS/Linux:
```bash
OPENAI_API_KEY=your-secret-key npm start
```
On Windows PowerShell:
```powershell
$env:OPENAI_API_KEY='your-secret-key'
npm start
```
Do not put a real key in the ZIP or commit it to version control. A ChatGPT subscription does **not** cover API usage; billing is separate. The optional live tutor uses OpenAI Realtime WebRTC and does not automatically advance the guided lesson. The live integration cannot be validated fully without actual paid API access, so test it privately before wider deployment.

By default Mivo listens only on `127.0.0.1`, to avoid exposing this developmental app to a network. For deployment, set `HOST=0.0.0.0` behind HTTPS *and* implement proper authentication and durable per-user quotas to protect paid usage. Browser microphone permission and internet connectivity may be required. Speech-to-text errors are not pronunciation grades.

## Build and tests

```bash
npm test
```

This project deliberately has zero external npm dependencies. Source: `app.js` (UI), `lesson.js` (teaching content and assessment), `styles.css` (visuals), `server.mjs` (local server and optional short-lived voice token), `index.html` (entry), and `tests/` (automated tests).

## Limitations

- No sign-in, payments, learner accounts or cloud synchronization yet.
- Progress is stored in `localStorage` on the same browser/device.
- Pronunciation/audio recognition varies by device and browser, so typing is always supported.
- Live AI voice is optional and not end-to-end validated with a real API key.
- Before public deployment, add authentication, privacy notices, data handling/security review, usage caps, monitoring, and hosting.

OpenAI reference: https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime


## Beginner-friendly Sofie voice behavior (updated)

The live AI tutor now receives explicit teaching instructions: use **English for every explanation, correction, praise, and transition**. Dutch speech is limited to the taught Lesson 1 greetings, one at a time. Sofie should speak slowly, wait for each learner turn, not add extra Dutch vocabulary, and not advance until the learner asks. When you start a live chat, it begins from the current guided screen's active phrase. AI behavior may still vary in practice, so this is a strong prompt-level guardrail rather than a mechanical word filter. These changes apply after replacing your local Mivo folder and restarting `npm start`.
