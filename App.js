import { basicSetup } from "https://cdn.jsdelivr.net/npm/@codemirror/basic-setup@0.20.0/+esm";
import { EditorView } from "https://cdn.jsdelivr.net/npm/@codemirror/view@6.36.2/+esm";
import { EditorState } from "https://cdn.jsdelivr.net/npm/@codemirror/state@6.4.1/+esm";
import { javascript } from "https://cdn.jsdelivr.net/npm/@codemirror/lang-javascript@6.2.2/+esm";
import { html } from "https://cdn.jsdelivr.net/npm/@codemirror/lang-html@6.4.9/+esm";
import { css } from "https://cdn.jsdelivr.net/npm/@codemirror/lang-css@6.3.1/+esm";
import { oneDark } from "https://cdn.jsdelivr.net/npm/@codemirror/theme-one-dark@6.1.2/+esm";

const els = {
  lang: document.getElementById("lang"),
  filename: document.getElementById("filename"),
  saveBtn: document.getElementById("saveBtn"),
  loadBtn: document.getElementById("loadBtn"),
  runBtn: document.getElementById("runBtn"),
  clearBtn: document.getElementById("clearBtn"),
  log: document.getElementById("log"),
  runner: document.getElementById("runner"),
  status: document.getElementById("status"),
};

function langExt(kind) {
  if (kind === "html") return html();
  if (kind === "css") return css();
  return javascript({ jsx: false, typescript: false });
}

const defaults = {
  js: `// Example: JS\nconsole.log("hello from mobile");\n\nfunction add(a,b){ return a+b; }\nconsole.log("2+3 =", add(2,3));\n`,
  html: `<!-- Example: HTML -->\n<h1>Hello</h1>\n<p>Edit HTML then Run.</p>\n`,
  css: `/* Example: CSS */\nbody{ font-family: system-ui; padding: 16px; }\nh1{ color: #2563eb; }\n`,
};

function keyFor() {
  return `mside:${els.lang.value}:${els.filename.value}`.trim();
}

function setStatus(msg) {
  els.status.textContent = msg || "";
}

function logLine(line) {
  els.log.textContent += line + "\n";
  els.log.scrollTop = els.log.scrollHeight;
}

function clearLog() {
  els.log.textContent = "";
}

function guessName() {
  const kind = els.lang.value;
  return kind === "html" ? "index.html" : kind === "css" ? "styles.css" : "main.js";
}

function editorStateFor(kind, doc) {
  return EditorState.create({
    doc,
    extensions: [
      basicSetup,
      oneDark,
      langExt(kind),
      EditorView.lineWrapping,
      EditorView.updateListener.of((v) => {
        if (v.docChanged) setStatus("Unsaved changes");
      }),
    ],
  });
}

let view = new EditorView({
  state: editorStateFor("js", defaults.js),
  parent: document.getElementById("editor"),
});

function setEditor(kind, doc) {
  view.setState(editorStateFor(kind, doc));
  setStatus("");
}

function save() {
  const k = keyFor();
  localStorage.setItem(k, view.state.doc.toString());
  setStatus("Saved");
}

function load() {
  const k = keyFor();
  const val = localStorage.getItem(k);
  if (val == null) {
    // if nothing saved, load default template
    setEditor(els.lang.value, defaults[els.lang.value] || "");
    setStatus("Loaded template");
    return;
  }
  setEditor(els.lang.value, val);
  setStatus("Loaded");
}

function run() {
  clearLog();

  const kind = els.lang.value;
  const code = view.state.doc.toString();

  // We render in a sandboxed iframe, and pipe console.log/error back out.
  const runnerHTML = `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body{ margin:0; padding:12px; font-family:system-ui; }
</style>
</head>
<body>
<script>
  const send = (type, ...args) => parent.postMessage({ type, args }, "*");
  console.log = (...a)=>send("log", ...a);
  console.error = (...a)=>send("error", ...a);
  window.addEventListener("error", (e)=>send("error", e.message));
  window.addEventListener("unhandledrejection", (e)=>send("error", String(e.reason)));
</script>

${kind === "html" ? code : ""}
${kind === "css" ? `<style>${code}</style><div>CSS applied. (Put HTML in HTML mode)</div>` : ""}
${kind === "js" ? `<script>${code}<\/script>` : ""}

</body>
</html>`.trim();

  // Recreate iframe document
  els.runner.srcdoc = runnerHTML;
  setStatus("Ran");
}

window.addEventListener("message", (ev) => {
  if (!ev.data || !ev.data.type) return;
  if (ev.data.type === "log") logLine(ev.data.args.map(String).join(" "));
  if (ev.data.type === "error") logLine("ERROR: " + ev.data.args.map(String).join(" "));
});

els.lang.addEventListener("change", () => {
  els.filename.value = guessName();
  load();
});

els.saveBtn.addEventListener("click", save);
els.loadBtn.addEventListener("click", load);
els.runBtn.addEventListener("click", run);
els.clearBtn.addEventListener("click", clearLog);

els.filename.value = guessName();
load();

// PWA service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
