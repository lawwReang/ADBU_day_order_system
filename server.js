import express from "express";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;
const CONFIG_FILE = "holiday_2.json";
const ADMIN_PIN = "473625";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/holiday_2.json", (req, res) => {
  res.sendFile(path.join(__dirname, "holiday_2.json"));
});

app.post("/api/authenticate", (req, res) => {
  const { pin } = req.body;
  if (pin === ADMIN_PIN) res.json({ success: true });
  else res.status(401).json({ success: false, error: "Invalid PIN" });
});

async function calculateDayOrderJS() {
  try {
    const data = await fs.readFile(CONFIG_FILE, "utf8");
    const config = JSON.parse(data);
    const {
      semester_start_date: startStr,
      day_order_cycle: cycle,
      holidays,
    } = config;

    const holidayData = new Map(
      holidays.map((h) => {
        const [y, m, d] = h.date.split("-").map(Number);
        return [new Date(y, m - 1, d).toDateString(), h.name];
      }),
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Robust parsing: split YYYY-MM-DD to avoid UTC timezone shifts
    const [y_start, m_start, d_start] = startStr.split("-").map(Number);
    const startDate = new Date(y_start, m_start - 1, d_start);
    startDate.setHours(0, 0, 0, 0);

    const result = {
      date: today.toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
      status: "",
      reason: "",
      day_order: "",
    };

    if (today < startDate) return { ...result, status: "Semester Not Started" };

    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0)
      return { ...result, status: "NON-WORKING DAY", reason: "Sunday" };

    if (dayOfWeek === 6) {
      if (holidayData.has(today.toDateString()))
        return {
          ...result,
          status: "NON-WORKING DAY",
          reason: holidayData.get(today.toDateString()),
        };
      const dayOfMonth = today.getDate();
      const occurrence = Math.ceil(dayOfMonth / 7);
      if (occurrence % 2 !== 0) {
        return { ...result, status: "NON-WORKING DAY", reason: "Odd Saturday" };
      } else {
        return { ...result, status: "WORKING SATURDAY" };
      }
    }

    if (holidayData.has(today.toDateString()))
      return {
        ...result,
        status: "NON-WORKING DAY",
        reason: holidayData.get(today.toDateString()),
      };

    let workingDayCount = 0;
    let curr = new Date(startDate);
    while (curr <= today) {
      const currDayOfWeek = curr.getDay();
      if (
        currDayOfWeek !== 0 &&
        currDayOfWeek !== 6 &&
        !holidayData.has(curr.toDateString())
      )
        workingDayCount++;
      curr.setDate(curr.getDate() + 1);
    }

    result.status = "WORKING DAY";
    result.day_order = `Day ${((workingDayCount - 1) % cycle) + 1}`;
    return result;
  } catch (e) {
    return { error: "Database Sync Error" };
  }
}

app.get("/api/day-order", async (req, res) =>
  res.json(await calculateDayOrderJS()),
);

app.post("/api/add-holiday", async (req, res) => {
  const { date, name, pin } = req.body;
  if (pin !== ADMIN_PIN) return res.status(403).json({ error: "Unauthorized" });
  try {
    const data = await fs.readFile(CONFIG_FILE, "utf8");
    const config = JSON.parse(data);
    config.holidays.push({ date, name });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
    res.json({ message: "Success" });
  } catch (e) {
    res.status(500).json({ error: "Update Failed" });
  }
});

app.listen(PORT, () => console.log(`Portal Live: http://localhost:${PORT}`));
