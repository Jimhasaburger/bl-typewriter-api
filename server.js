const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Load charset
const CHARSET = JSON.parse(fs.readFileSync(path.join(__dirname, 'index.json'), 'utf8'));

// Multi-panel buffers: { panelId: [256 chars] }
const PANELS = {};

// ---- Helper to get buffer for a panel ----
function getPanelBuffer(panelId) {
  if (!PANELS[panelId]) {
    PANELS[panelId] = new Array(256).fill('0000000'); // new panel, empty
  }
  return PANELS[panelId];
}

// ---- /api route (HTTP Transmitter) ----
app.post('/api', (req, res) => {
  const addressBits = req.body.value || '00000000';
  const panelId = req.headers['x-panel-id'] || 'default'; // default panel
  const buffer = getPanelBuffer(panelId);

  let index = 0;
  try {
    index = parseInt(addressBits, 2);
  } catch {}
  if (index < 0 || index > 255) index = 0;

  const char7 = buffer[index] || '0000000';
  const responseBits = '0' + char7; // prepend MSB 0

  res.json({ value: responseBits });
});

// ---- /panel route (web panel) ----
app.get('/panel', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Build Logic Multi-Panel Web UI</title>
<style>
body { font-family: sans-serif; padding: 20px; }
textarea { width: 400px; height: 100px; font-size: 16px; }
button { font-size: 16px; margin-top: 10px; }
</style>
</head>
<body>
<h2>Send Text to Build Logic Panel</h2>
<label>Panel ID: <input id="panelId" value="default" /></label><br><br>
<textarea id="textInput" placeholder="Type here..."></textarea><br>
<button onclick="sendText()">Send</button>
<p id="status"></p>

<script>
const CHARSET = ${JSON.stringify(CHARSET)};

async function sendText() {
  const text = document.getElementById('textInput').value;
  const panelId = document.getElementById('panelId').value || 'default';
  if (!text) return alert('Type something!');
  try {
    const res = await fetch('/panel/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, panelId })
    });
    const data = await res.json();
    document.getElementById('status').innerText = 'Text sent! ' + data.written + ' chars.';
  } catch (e) {
    console.error(e);
    document.getElementById('status').innerText = 'Error sending text';
  }
}
</script>
</body>
</html>
  `);
});

// ---- /panel/update route ----
app.post('/panel/update', (req, res) => {
  const text = req.body.text || '';
  const panelId = req.body.panelId || 'default';
  const buffer = getPanelBuffer(panelId);

  let addr = 0;
  for (let c of text) {
    if (CHARSET[c] && addr < 256) {
      buffer[addr] = CHARSET[c];
      addr++;
    }
  }
  res.json({ status: 'ok', written: addr });
});

// ---- Render PORT ----
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
