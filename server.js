const express = require('express');
const dotenv = require('dotenv');
const cors = require("cors");
dotenv.config();

const app = express();

app.use(express.json());
app.use(cors({
  origin : "https://gastimation-frontend.vercel.app"
            ));


const dbRouter = require("./routes/database");
app.use("/db", dbRouter);

const gasPriceRouter = require("./routes/gasprice");
app.use("/gasprice", gasPriceRouter);

// ✅ NEW: Calculate endpoint
app.post("/calculate", async (req, res) => {
  try {
    const { distance, mileage, gasPrice, elevationFactor } = req.body;
    
    // Formula: (distance in km / 100) * fuel per 100km * gas price * elevation factor
    const totalFuel = (distance / 100) * mileage;
    const totalCost = totalFuel * gasPrice * (elevationFactor || 1.0);
    
    res.json({ 
      success: true, 
      totalCost: totalCost.toFixed(2),
      totalFuel: totalFuel.toFixed(2),
      breakdown: {
        distance_km: distance,
        fuel_per_100km: mileage,
        gas_price_per_liter: gasPrice,
        elevation_factor: elevationFactor || 1.0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
