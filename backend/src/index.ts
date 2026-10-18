import express from "express";
import { Pool } from "pg";
import cors from "cors";

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: "postgres://postgres:postgres@db.default.svc.cluster.local:5432/postgres",
});

app.get("/", (req, res) => {
  res.json({
    message: "Kubernetes Backend is running",
  });
});

app.get("/users", async (req, res) => {
  const result = await pool.query("SELECT * FROM users");
  res.json(result.rows);
});

app.post("/users", async (req, res) => {
  const result = await pool.query(
    "INSERT INTO users (name) VALUES ($1) RETURNING *",
    [req.body.name]
  );
  res.json(result.rows[0]);
});

async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
  )`);
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  initDb();
});
