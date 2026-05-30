import express from "express";
import cors from "cors";
import { createServer } from "http";

import { pool } from "./database";

const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());


const httpServer = createServer(app);


httpServer.listen(PORT, async () => {

  try {

    const result = await pool.query("SELECT * FROM testtable");

    console.log("Database Connection Test:", result.rows[0].field2);

    console.log(`HTTP API running at http://localhost:${PORT}`);

  } catch (err) {
    console.error(err);
  }

});