// Frow Python Web Worker
// This offloads heavy WASM initialization and execution from the main thread
importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js");

let pyodide = null;

async function initPyodide() {
  if (!pyodide) {
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/"
    });
  }
}

self.onmessage = async (e) => {
  const { code } = e.data;
  
  try {
    await initPyodide();
    
    let logs = "";
    pyodide.setStdout({
      batched: (str) => { logs += str + "\n"; }
    });

    const result = await pyodide.runPythonAsync(code);
    
    self.postMessage({
      type: "success",
      output: result !== undefined ? (logs + String(result)) : (logs || "Execution complete (no output).")
    });
  } catch (err) {
    self.postMessage({
      type: "error",
      error: err.message
    });
  }
};

