const express = require("express");
const router = express.Router();
const dotenv = require("dotenv");
const axios = require("axios");
const { MongoClient } = require("mongodb");

dotenv.config();

let carDB;
let carCollection;

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// ================= CONNECT DB =================
async function connect() {
  await client.connect();
  console.log("✅ Connected successfully to MongoDB");

  carDB = client.db("greenway");
  carCollection = carDB.collection("carData");
}

connect();

// ================= CAR DATA =================
async function getCarYears() {
  return await carCollection.distinct("year");
}

async function getCarMakes(year) {
  return await carCollection.distinct("make", { year: year });
}

async function getCarModels(year, make) {
  return await carCollection.distinct("model", {
    year: year,
    make: make,
  });
}

// ✅ FIXED: Get fuel consumption (supports both petrol and electric vehicles)
async function getCarData(year, make, model) {
  // Try to get combined field first
  let fuelData = await carCollection.distinct("combined", {
    year: year,
    make: make,
    model: model,
  });
  
  // Check if we have valid data
  if (fuelData && fuelData.length > 0) {
    const value = parseFloat(fuelData[0]);
    if (!isNaN(value) && value > 0) {
      // Return the actual value from database
      console.log(`⛽ ${year} ${make} ${model} → ${value} L/100km`);
      return [value];
    }
  }
  
  // Default fallback for unknown cars
  console.log(`⚠️ No fuel data found for ${year} ${make} ${model}, using default 8.5 L/100km`);
  return [8.5];
}

// ================= ELEVATION (Direct Google API) =================
router.post("/retrieveElevation", async (req, res) => {
  const { points } = req.body;
  
  if (!points || points.length === 0) {
    return res.json({ elevation: [] });
  }

  try {
    const elevationList = [];
    const API_KEY = process.env.MAPS_API_KEY;
    
    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      const locations = batch.map(p => `${p.latitude},${p.longitude}`).join('|');
      
      const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${locations}&key=${API_KEY}`;
      const response = await axios.get(url);
      
      if (response.data.results) {
        response.data.results.forEach(result => {
          elevationList.push(result.elevation);
        });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`📈 Fetched ${elevationList.length} elevation points`);
    res.json({ elevation: elevationList });
    
  } catch (err) {
    console.error("❌ Elevation API error:", err.message);
    const zeros = new Array(points.length).fill(0);
    res.json({ elevation: zeros });
  }
});

// ================= ROUTES =================
router.get("/cardata/years", async (req, res) => {
  const years = await getCarYears();
  res.json(years);
});

router.get("/cardata/makes/:year", async (req, res) => {
  const makes = await getCarMakes(req.params.year);
  res.json(makes);
});

router.get("/cardata/models/:year/:make", async (req, res) => {
  const models = await getCarModels(req.params.year, req.params.make);
  res.json(models);
});

router.get("/cardata/getMilage/:year/:make/:model", async (req, res) => {
  const fuel = await getCarData(req.params.year, req.params.make, req.params.model);
  res.json(fuel);
});

module.exports = router;