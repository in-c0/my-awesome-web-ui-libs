import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Embed } from "./embed";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<StrictMode>{location.hash.startsWith("#embed") ? <Embed /> : <App />}</StrictMode>);
