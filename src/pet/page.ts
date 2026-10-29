/**
 * The pet window itself: one transparent page with an animated companion, a
 * state label and the box you type into. It talks to the local host over HTTP so
 * it needs no preload script, no Node integration and no build-time assets.
 */
export const petPageHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Nix pet</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: transparent; overflow: hidden;
    font-family: "Segoe UI", system-ui, sans-serif; -webkit-user-select: none; user-select: none; }
  body { display: flex; flex-direction: column; justify-content: flex-end; padding: 12px; gap: 10px; }
  .stage { display: grid; place-items: center; }
  .pet { width: 132px; height: 132px; position: relative; transition: filter .3s ease; }
  .body { position: absolute; inset: 14px; border-radius: 50% 50% 46% 46%;
    background: radial-gradient(circle at 34% 30%, #7dd3fc, #2563eb 62%, #1e3a8a);
    box-shadow: 0 12px 32px rgba(0,0,0,.45), inset 0 -10px 24px rgba(0,0,0,.25);
    animation: breathe 3.4s ease-in-out infinite; }
  .eye { position: absolute; top: 52px; width: 13px; height: 17px; border-radius: 50%;
    background: #0b1220; animation: blink 5s infinite; }
  .eye.left { left: 46px; } .eye.right { right: 46px; }
  .mouth { position: absolute; left: 50%; top: 82px; width: 26px; height: 12px; margin-left: -13px;
    border-bottom: 3px solid #0b1220; border-radius: 0 0 26px 26px; }
  .label { text-align: center; font-size: 12px; letter-spacing: .08em; text-transform: uppercase;
    color: #cbd5e1; text-shadow: 0 1px 3px rgba(0,0,0,.8); }
  form { display: flex; gap: 6px; }
  input { flex: 1; min-width: 0; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(148,163,184,.4);
    background: rgba(15,23,42,.86); color: #e2e8f0; font-size: 13px; outline: none; }
  input:focus { border-color: #38bdf8; }
  button { padding: 8px 12px; border-radius: 10px; border: 0; background: #2563eb; color: white;
    font-weight: 600; font-size: 13px; cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }

  body[data-state="thinking"] .pet { animation: tilt 1.6s ease-in-out infinite; }
  body[data-state="thinking"] .label::after { content: " …"; }
  body[data-state="working"] .pet { animation: bounce .9s ease-in-out infinite; }
  body[data-state="waiting"] .body { background: radial-gradient(circle at 34% 30%, #fde68a, #f59e0b 60%, #92400e); }
  body[data-state="waiting"] .pet { animation: nudge .8s ease-in-out infinite; }
  body[data-state="success"] .body { background: radial-gradient(circle at 34% 30%, #86efac, #22c55e 60%, #15803d); }
  body[data-state="error"] .body { background: radial-gradient(circle at 34% 30%, #fca5a5, #ef4444 60%, #991b1b); }
  body[data-state="error"] .pet { animation: shake .35s ease-in-out 3; }

  @keyframes breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03); } }
  @keyframes blink { 0%,94%,100% { transform: scaleY(1); } 97% { transform: scaleY(.1); } }
  @keyframes tilt { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
  @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  @keyframes nudge { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
  @keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
</head>
<body data-state="idle">
  <div class="stage">
    <div class="pet"><div class="body"></div><div class="eye left"></div><div class="eye right"></div><div class="mouth"></div></div>
  </div>
  <div class="label" id="label">idle</div>
  <form id="form">
    <input id="text" placeholder="Reply to the agent…" autocomplete="off" />
    <button id="send" type="submit">Send</button>
  </form>
<script>
  const label = document.getElementById("label");
  const input = document.getElementById("text");
  const button = document.getElementById("send");
  const stream = new EventSource("/mood");
  stream.onmessage = (event) => {
    try {
      const mood = JSON.parse(event.data);
      document.body.dataset.state = mood.state;
      label.textContent = mood.label;
      input.placeholder = mood.state === "waiting" ? "The agent needs you…" : "Reply to the agent…";
    } catch {}
  };
  document.getElementById("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    button.disabled = true;
    try {
      const response = await fetch("/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text })
      });
      if (response.ok) input.value = "";
    } finally {
      button.disabled = false;
      input.focus();
    }
  });
  input.focus();
</script>
</body>
</html>
`;
