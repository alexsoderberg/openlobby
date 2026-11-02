import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApiProvider, createHttpApiClient } from "./api";
import { App } from "./app/App";
import "./styles/global.css";

// Composition root: the one place where the concrete API client is chosen.
const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element in index.html");

createRoot(container).render(
  <StrictMode>
    <ApiProvider client={createHttpApiClient()}>
      <App />
    </ApiProvider>
  </StrictMode>,
);
