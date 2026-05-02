const express = require("express");
const router = express.Router();
const axios = require("axios");

// 👇 Store cache for multiple cities
const cityCache = new Map(); // { "toronto": { price: 2.129, timestamp: 123456789 } }

router.get("/price", async (req, res) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.json({ success: false, message: "City is required" });
    }

    const cityKey = city.toLowerCase().trim();
    const cached = cityCache.get(cityKey);

    // Check cache for this specific city
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
      console.log(`⛽ Cache hit for ${city}: $${cached.price}`);
      return res.json({
        success: true,
        price: cached.price,
        currency: "CAD",
        unit: "liter",
        source: "cache",
        city: city,
      });
    }

    // Fetch from API
    const response = await axios.get(
      "https://api.collectapi.com/gasPrice/canada",
      {
        headers: {
          "content-type": "application/json",
          authorization: `apikey ${process.env.GAS_PRICE_API_KEY}`,
        },
      }
    );

    const states = response.data.result;
    let foundPrice = null;

    // Search for city
    for (const state of states) {
      for (const c of state.cities) {
        if (c.name.toLowerCase().includes(cityKey)) {
          foundPrice = parseFloat(c.gasoline);
          break;
        }
      }
      if (foundPrice) break;
    }

    const price = foundPrice && !isNaN(foundPrice) ? foundPrice : null;

    if (!price) {
      console.log(`⚠️ No price found for ${city}`);
      return res.json({
        success: false,
        message: `No gas price found for ${city}`,
        city: city,
      });
    }

    // Store in cache with city key
    cityCache.set(cityKey, {
      price: price,
      timestamp: Date.now(),
    });

    console.log(`⛽ Gas Price for ${city}: $${price} (cached for 10 min)`);

    res.json({
      success: true,
      price: price,
      city: city,
      currency: "CAD",
      unit: "liter",
      source: "api",
    });

  } catch (error) {
    console.log("❌ API failed:", error.message);
    
    // ✅ No fallback — send error status
    res.status(503).json({
      success: false,
      error: "Gas price API unavailable",
      message: error.message,
      source: "error"
    });
  }
});

module.exports = router;