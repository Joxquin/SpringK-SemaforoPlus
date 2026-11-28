#pragma once

// Web UI served at "/". Framesize values match the framesize_t enum in sensor.h.
static const char INDEX_HTML[] = R"rawliteral(<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ESP32-CAM</title>
<style>
  :root { --bg:#111418; --panel:#1b2027; --text:#e6e9ee; --muted:#8a94a3; --accent:#3d8bfd; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.4 system-ui,sans-serif; }
  main { max-width:1000px; margin:0 auto; padding:16px; display:grid; gap:16px; }
  @media (min-width:800px) { main { grid-template-columns:1fr 260px; } }
  .view { background:#000; border-radius:8px; overflow:hidden; min-height:200px;
          display:flex; align-items:center; justify-content:center; }
  .view img { width:100%; height:auto; display:block; }
  .view span { color:var(--muted); }
  aside { background:var(--panel); border-radius:8px; padding:16px; display:grid; gap:14px; align-content:start; }
  h1 { font-size:17px; margin:0; }
  label { display:grid; gap:4px; color:var(--muted); font-size:13px; }
  select, input[type=range] { width:100%; }
  select { background:var(--bg); color:var(--text); border:1px solid #333b46; border-radius:6px; padding:6px; }
  .row { display:flex; gap:8px; }
  .check { display:flex; align-items:center; gap:8px; color:var(--text); font-size:15px; }
  button { flex:1; background:var(--accent); color:#fff; border:0; border-radius:6px; padding:9px; font-size:14px; cursor:pointer; }
  button.secondary { background:#333b46; }
  #stats { color:var(--muted); font-size:13px; font-variant-numeric:tabular-nums; }
</style>
</head>
<body>
<main>
  <div class="view"><img id="stream" alt="Camera stream"><span id="placeholder">Stream stopped</span></div>
  <aside>
    <h1>ESP32-CAM &middot; GC2145</h1>
    <div class="row">
      <button id="toggle">Stop stream</button>
      <button id="snap" class="secondary">Snapshot</button>
    </div>
    <label>Resolution
      <select id="framesize">
        <option value="13">HD 1280&times;720</option>
        <option value="12">XGA 1024&times;768</option>
        <option value="11">SVGA 800&times;600</option>
        <option value="10">VGA 640&times;480</option>
        <option value="9">HVGA 480&times;320</option>
        <option value="8">CIF 400&times;296</option>
        <option value="6">QVGA 320&times;240</option>
        <option value="1">QQVGA 160&times;120</option>
      </select>
    </label>
    <label>JPEG quality <span id="qval"></span>
      <input type="range" id="quality" min="10" max="95" step="5">
    </label>
    <label class="check"><input type="checkbox" id="hmirror"> Mirror</label>
    <label class="check"><input type="checkbox" id="vflip"> Flip</label>
    <label class="check"><input type="checkbox" id="led"> Flash LED</label>
    <div id="stats">&nbsp;</div>
  </aside>
</main>
<script>
const $ = id => document.getElementById(id);
const streamUrl = `http://${location.hostname}:81/stream`;
let streaming = false;

function setStreaming(on) {
  streaming = on;
  $('stream').src = on ? streamUrl : '';
  $('stream').style.display = on ? 'block' : 'none';
  $('placeholder').style.display = on ? 'none' : 'block';
  $('toggle').textContent = on ? 'Stop stream' : 'Start stream';
}

function control(v, val) { return fetch(`/control?var=${v}&val=${val}`); }

async function refresh(first) {
  try {
    const s = await (await fetch('/status')).json();
    if (first) {
      $('framesize').value = s.framesize;
      $('quality').value = s.quality;
      $('qval').textContent = s.quality;
      $('hmirror').checked = !!s.hmirror;
      $('vflip').checked = !!s.vflip;
      $('led').checked = !!s.led;
    }
    $('stats').textContent = s.camera
      ? `${s.width}×${s.height} · ${s.fps} fps · ${(s.frame_bytes / 1024).toFixed(0)} KB/frame · sensor ${s.pid}`
      : 'Camera not detected - check the ribbon cable';
  } catch (e) {
    $('stats').textContent = 'Board not responding';
  }
}

$('toggle').onclick = () => setStreaming(!streaming);
$('snap').onclick = () => window.open('/capture?t=' + Date.now(), '_blank');
$('framesize').onchange = e => control('framesize', e.target.value);
$('quality').oninput = e => { $('qval').textContent = e.target.value; };
$('quality').onchange = e => control('quality', e.target.value);
['hmirror', 'vflip', 'led'].forEach(id => $(id).onchange = e => control(id, e.target.checked ? 1 : 0));

refresh(true);
setInterval(refresh, 2000);
setStreaming(true);
</script>
</body>
</html>
)rawliteral";
