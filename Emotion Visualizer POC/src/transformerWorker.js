import { pipeline, env } from "@huggingface/transformers";

// Load from the files we downloaded into public/models/ — no network calls.
env.localModelPath = "/models/";
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.useBrowserCache = false; // use local files directly, not the Cache API

let classifier = null;

self.onmessage = async (e) => {
  const { type, id, sentences } = e.data;

  if (type === "load") {
    try {
      classifier = await pipeline(
        "text-classification",
        "Xenova/distilbert-base-uncased-emotion",
        {
          top_k: null,
          progress_callback: (p) => self.postMessage({ type: "progress", data: p }),
        }
      );
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "load_error", message: err.message });
    }
    return;
  }

  if (type === "classify") {
    try {
      const results = [];
      for (const sentence of sentences) {
        const out = await classifier(sentence, { top_k: null });
        results.push(Array.isArray(out[0]) ? out[0] : out);
      }
      self.postMessage({ type: "result", id, results });
    } catch (err) {
      self.postMessage({ type: "classify_error", id, message: err.message });
    }
  }
};
