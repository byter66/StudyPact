import express from "express";
import cors from "cors";
import healthRoutes from "./routes/health.routes";
import { errorHandler } from "./middleware/error.middleware";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "StudyPact API",
    version: "1.0.0",
  });
});

app.use("/api/health", healthRoutes);

app.use(errorHandler);

export default app;
