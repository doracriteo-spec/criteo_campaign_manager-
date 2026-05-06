// install_extra.js - installs additional dependencies for the upgraded project
// Run with: node install_extra.js

"use strict";
const { execSync } = require("child_process");

const packages = [
  "xlsx",
  "papaparse",
  "node-fetch",
  "lru-cache",
  "@supabase/supabase-js",
  "@ai-sdk/anthropic",
  "@ai-sdk/google",
  "@ai-sdk/react",
  "@google/generative-ai",
  "ai",
  "chart.js",
  "react-chartjs-2",
  "lucide-react",
];

console.log("Installing extra packages...");
execSync(`npm install ${packages.join(" ")}`, { stdio: "inherit" });
console.log("Done.");
