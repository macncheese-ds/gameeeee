# gameeeee

This folder contains a small browser game: "Tennis for Two" — a simple Pong-like demo.

Files
 - `index.html` — game page
 - `styles.css` — styles
 - `script.js` — game logic

Controls
 - W / S — left paddle up / down
 - Arrow Up / Arrow Down — right paddle up / down
 - Space — Start / Pause
 - R — Reset scores and ball

Run
 - Open `index.html` in a desktop browser (double-click) or serve the folder with a static server.
 - For a quick local server (Node.js):
	 - `npx http-server .` from inside `c:\app\gameeeee` (or use VS Code Live Server)

Notes
 - Click the canvas to ensure it receives keyboard focus.
 - Works best on desktop browsers.
# Multiplayer (LAN)

This project includes a simple Node.js authoritative server (Socket.IO) to play between two devices on the same LAN.

Run steps:
 - Install dependencies: open PowerShell in `c:\app\gameeeee\server` and run `npm install`.
 - Start server: `npm start` (server listens on port 10002 by default).
 - Make sure firewall allows inbound TCP 10002 on the server machine.
 - Open `http://<server-ip>:10001` in two different devices (the static files are served by nginx on port 10001 if configured) and click "Play on LAN" in both clients. Alternatively open the page directly and click "Play on LAN" which will connect to the socket server at port 10002.

Notes:
 - The server accepts only two players; a third connection will be rejected.
 - This is a minimal authoritative server — it keeps the ball and scoreboard state.
# gameeeee