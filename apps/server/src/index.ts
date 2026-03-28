import "dotenv/config";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import cors from "cors";
const app = express();
const port = process.env.PORT! || 5000;
const apiVersion = process.env.API_VERSION! || "v1";

app.use(
	cors({
	  origin: "http://localhost:3000",
	  methods: ["GET", "POST", "PUT", "DELETE"],
	  credentials: true,
	})
  );

app.all(`/api/${apiVersion}/auth/*splat`, toNodeHandler(auth));
app.use(express.json());
app.get("/", (req, res) => {
	res.send("Hello World");
});
app.listen(port, () => {
	console.log(`Server listening on http://localhost:${port}`);
});