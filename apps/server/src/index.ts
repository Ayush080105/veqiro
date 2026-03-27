import "dotenv/config";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";

const app = express();
const port = 5000;

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());
app.get("/", (req, res) => {
	res.send("Hello World");
});
app.listen(port, () => {
	console.log(`Server listening on http://localhost:${port}`);
});