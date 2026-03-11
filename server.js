import express from "express";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8000;
const CONFIG_FILE = "holiday_2.json";
const ADMIN_PIN = "031982";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/authenticate", (req, res) => {
  const { pin } = req.body;

  if (pin === ADMIN_PIN) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: "Invalid PIN" });
  }
});

async function calculateDayOrderJS(targetDate = new Date()) {
  try {
    const data = await fs.readFile(CONFIG_FILE, "utf8");
    const config = JSON.parse(data);
    const {
      semester_start_date: startStr,
      day_order_cycle: cycle,
      holidays
    } = config;

    const holidayMap = new Map(
      holidays.map(h => {
        const [y, m, d] = h.date.split("-").map(Number);
        return [new Date(y, m - 1, d).toDateString(), h.name];
      })
    );

    const today = new Date(targetDate);
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(startStr);
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

    if (today < startDate) {
      result.status = "Semester Not Started";
      return result;
    }

    const dayOfWeek = today.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      result.status = "NON-WORKING DAY";
      result.reason = "Weekend";
      return result;
    }

    if (holidayMap.has(today.toDateString())) {
      result.status = "NON-WORKING DAY";
      result.reason = holidayMap.get(today.toDateString());
      return result;
    }

    let workingDays = 0;
    let curr = new Date(startDate);
    while (curr <= today) {
      if (
        curr.getDay() !== 0 &&
        curr.getDay() !== 6 &&
        !holidayMap.has(curr.toDateString())
      ) {
        workingDays++;
      }

      curr.setDate(curr.getDate() + 1);
    }

    result.status = "WORKING DAY";
    result.day_order = `Day ${((workingDays - 1) % cycle) + 1}`;

    return result;

  } catch (err) {

    console.error(err);
    return { error: "Database Sync Error" };
  }
}


app.get("/api/day-order", async (req, res) => {
  res.json(await calculateDayOrderJS());
});


app.get("/api/day-order/:date", async (req, res) => {
  const date = new Date(req.params.date);
  res.json(await calculateDayOrderJS(date));
});


app.post("/api/add-holiday", async (req, res) => {
  const { date, name, pin } = req.body;

  if (pin !== ADMIN_PIN) {
    return res.status(403).json({ error: "Unauthorized" });
  }

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

app.listen(PORT, () => {
  console.log(`Portal Live: http://localhost:${PORT}`);
});